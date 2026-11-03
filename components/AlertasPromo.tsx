// ALERTA de promoções no Telegram.
//
// O app só cadastra o que vigiar. Quem vigia de verdade é o script do GitHub Actions
// (scripts/alerta-promo.mjs), que a cada poucos minutos lê os canais públicos do Telegram e
// manda um aviso para o grupo de vocês quando aparece uma das palavras abaixo.
//
// Dados no Firebase:
//   alertasPromo/palavras/{id}: termo, ativo, duracao ('24h'|'7d'|'14d'|'sempre'), criadoEm, expiraEm (0 = sem prazo), avisos
//   alertasPromo/canais/{id}:   usuario (nome do canal em t.me/usuario), ativo
//   alertasPromo/estado:        ultimaVerificacao, pedirTeste, testeAtendido, lidos/{canal} (escritos pelo script)
import { Feather } from '@expo/vector-icons';
import { onValue, push, ref, remove, update } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';
import { useDialogo } from '../hooks/useDialogo';
import { ScrollTeclado } from './AvoidTeclado';
import CampoSuave from './CampoSuave';
import { COR } from './corLista';

type Duracao = '24h' | '7d' | '14d' | 'sempre';

const HORA = 3600 * 1000;
const DURACOES: { chave: Duracao; rotulo: string; ms: number }[] = [
  { chave: '24h', rotulo: '24 horas', ms: 24 * HORA },
  { chave: '7d', rotulo: '1 semana', ms: 7 * 24 * HORA },
  { chave: '14d', rotulo: '2 semanas', ms: 14 * 24 * HORA },
  { chave: 'sempre', rotulo: 'Até desligar', ms: 0 },
];

type Palavra = { id: string; termo: string; ativo: boolean; duracao: Duracao; criadoEm: number; expiraEm: number; avisos: number };
type Canal = { id: string; usuario: string; ativo: boolean };

const ehDuracao = (d: any): d is Duracao => d === '24h' || d === '7d' || d === '14d' || d === 'sempre';

// Aceita "t.me/nome", "https://t.me/s/nome", "@nome" ou só "nome". Retorna '' se não der para vigiar.
export function extrairCanal(texto: string): string {
  let t = (texto || '').trim();
  t = t.replace(/^https?:\/\//i, '').replace(/^(www\.)?(t\.me|telegram\.me)\//i, '').replace(/^s\//i, '').replace(/^@/, '');
  t = t.split(/[/?#\s]/)[0];
  return /^[A-Za-z][A-Za-z0-9_]{3,63}$/.test(t) ? t : '';
}

const doisDigitos = (n: number) => (n > 9 ? `${n}` : `0${n}`);
function dataHora(ms: number) {
  const d = new Date(ms);
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

function tempoRestante(ms: number) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min > 2880) return `${Math.round(min / 1440)} dias`;
  if (min > 120) return `${Math.round(min / 60)} h`;
  return `${min} min`;
}

type Situacao = 'ativa' | 'pausada' | 'expirada';
function situacao(p: Palavra, agora: number): Situacao {
  if (p.expiraEm > 0 && agora >= p.expiraEm) return 'expirada';
  if (!p.ativo) return 'pausada';
  return 'ativa';
}

export function PainelAlertas({ aoFechar }: { aoFechar: () => void }) {
  const { avisar, confirmar } = useDialogo();
  const [palavras, setPalavras] = useState<Palavra[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [ultimaVerificacao, setUltimaVerificacao] = useState(0);
  const [testePedido, setTestePedido] = useState(0);
  const [testeAtendido, setTesteAtendido] = useState(0);
  const [agora, setAgora] = useState(Date.now());

  const [termo, setTermo] = useState('');
  const [duracao, setDuracao] = useState<Duracao>('7d');
  const [novoCanal, setNovoCanal] = useState('');

  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const fechar = () => {
    Keyboard.dismiss();
    Animated.timing(entrada, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => aoFechar());
  };

  // relógio para atualizar "vence em..." e "última checagem"
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, 'alertasPromo'), (snap) => {
      const v: any = snap.val() || {};
      const listaP: Palavra[] = [];
      for (const [id, p] of Object.entries<any>(v.palavras || {})) {
        if (!p || typeof p.termo !== 'string') continue;
        listaP.push({
          id,
          termo: p.termo,
          ativo: p.ativo !== false,
          duracao: ehDuracao(p.duracao) ? p.duracao : 'sempre',
          criadoEm: Number(p.criadoEm) || 0,
          expiraEm: Number(p.expiraEm) || 0,
          avisos: Number(p.avisos) || 0,
        });
      }
      listaP.sort((a, b) => b.criadoEm - a.criadoEm);
      setPalavras(listaP);

      const listaC: Canal[] = [];
      for (const [id, c] of Object.entries<any>(v.canais || {})) {
        if (!c || typeof c.usuario !== 'string') continue;
        listaC.push({ id, usuario: c.usuario, ativo: c.ativo !== false });
      }
      setCanais(listaC);

      const est = v.estado || {};
      setUltimaVerificacao(Number(est.ultimaVerificacao) || 0);
      setTestePedido(Number(est.pedirTeste) || 0);
      setTesteAtendido(Number(est.testeAtendido) || 0);
    });
    return () => unsub();
  }, []);

  const ativarPalavra = async () => {
    const limpo = termo.trim().replace(/\s+/g, ' ');
    if (!(limpo.length > 1)) {
      avisar('Digite a palavra', 'Escreva o que você quer vigiar, por exemplo: lava e seca.', 'aviso');
      return;
    }
    const jaExiste = palavras.some((p) => p.termo.toLowerCase() === limpo.toLowerCase() && situacao(p, agora) !== 'expirada');
    if (jaExiste) {
      avisar('Já está vigiando', 'Essa palavra já está na lista. Use o botão de pausar ou apagar para mudar.', 'info');
      return;
    }
    const d = DURACOES.find((x) => x.chave === duracao) || DURACOES[1];
    const criadoEm = Date.now();
    try {
      await push(ref(db, 'alertasPromo/palavras'), {
        termo: limpo,
        ativo: true,
        duracao: d.chave,
        criadoEm,
        expiraEm: d.ms > 0 ? criadoEm + d.ms : 0,
        avisos: 0,
      });
      setTermo('');
      Keyboard.dismiss();
    } catch {
      avisar('Não foi possível salvar', 'Verifique a internet e tente de novo.', 'erro');
    }
  };

  const alternarPalavra = async (p: Palavra) => {
    try {
      await update(ref(db, `alertasPromo/palavras/${p.id}`), { ativo: !p.ativo });
    } catch {
      avisar('Não foi possível alterar', 'Tente de novo.', 'erro');
    }
  };

  const renovarPalavra = async (p: Palavra) => {
    const d = DURACOES.find((x) => x.chave === p.duracao) || DURACOES[3];
    const criadoEm = Date.now();
    try {
      await update(ref(db, `alertasPromo/palavras/${p.id}`), { ativo: true, criadoEm, expiraEm: d.ms > 0 ? criadoEm + d.ms : 0 });
    } catch {
      avisar('Não foi possível renovar', 'Tente de novo.', 'erro');
    }
  };

  const apagarPalavra = async (p: Palavra) => {
    const ok = await confirmar({ titulo: 'Apagar alerta?', mensagem: `Parar de vigiar "${p.termo}".`, perigo: true });
    if (!ok) return;
    try {
      await remove(ref(db, `alertasPromo/palavras/${p.id}`));
    } catch {
      avisar('Não foi possível apagar', 'Tente de novo.', 'erro');
    }
  };

  const adicionarCanal = async () => {
    const usuario = extrairCanal(novoCanal);
    if (!usuario) {
      avisar(
        'Canal não reconhecido',
        'Cole o link público do canal, como t.me/gatunopromos. Canais privados (link com +) não dá para vigiar.',
        'aviso'
      );
      return;
    }
    if (canais.some((c) => c.usuario.toLowerCase() === usuario.toLowerCase())) {
      avisar('Canal já cadastrado', `@${usuario} já está na lista.`, 'info');
      return;
    }
    try {
      await push(ref(db, 'alertasPromo/canais'), { usuario, ativo: true, criadoEm: Date.now() });
      setNovoCanal('');
      Keyboard.dismiss();
    } catch {
      avisar('Não foi possível salvar', 'Verifique a internet e tente de novo.', 'erro');
    }
  };

  const alternarCanal = async (c: Canal) => {
    try {
      await update(ref(db, `alertasPromo/canais/${c.id}`), { ativo: !c.ativo });
    } catch {
      avisar('Não foi possível alterar', 'Tente de novo.', 'erro');
    }
  };

  const apagarCanal = async (c: Canal) => {
    const ok = await confirmar({ titulo: 'Remover canal?', mensagem: `Parar de vigiar @${c.usuario}.`, perigo: true });
    if (!ok) return;
    try {
      await remove(ref(db, `alertasPromo/canais/${c.id}`));
    } catch {
      avisar('Não foi possível remover', 'Tente de novo.', 'erro');
    }
  };

  const pedirTeste = async () => {
    try {
      await update(ref(db, 'alertasPromo/estado'), { pedirTeste: Date.now() });
      avisar('Teste pedido', 'Em até uns 5 minutos chega uma mensagem de teste no grupo do Telegram.', 'sucesso');
    } catch {
      avisar('Não foi possível pedir o teste', 'Tente de novo.', 'erro');
    }
  };

  // situação do vigia
  const idadeMin = ultimaVerificacao > 0 ? Math.floor((agora - ultimaVerificacao) / 60000) : -1;
  const vigiaParado = idadeMin > 45;
  const textoVigia =
    ultimaVerificacao === 0
      ? 'O vigia ainda não rodou'
      : idadeMin > 0
        ? `Última checagem há ${tempoRestante(idadeMin * 60000)}`
        : 'Checou agora há pouco';
  const testeEsperando = testePedido > testeAtendido;

  const ativas = palavras.filter((p) => situacao(p, agora) === 'ativa').length;

  const corSituacao = (s: Situacao) => (s === 'ativa' ? COR.verde : s === 'pausada' ? COR.cinza : COR.vermelho);

  return (
    <View style={styles.fundo}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', opacity: entrada }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={fechar} />
      </Animated.View>

      <Animated.View
        style={[styles.folha, { opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [260, 0] }) }] }]}
      >
        <View style={styles.cabecalho}>
          <View style={styles.sino}>
            <Feather name="bell" size={18} color={COR.grafite} />
          </View>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.titulo}>Alerta de promoções</Text>
            <Text style={styles.sub}>
              {ativas > 0 ? `${ativas} ${ativas > 1 ? 'palavras ativas' : 'palavra ativa'} · aviso no Telegram` : 'Aviso no Telegram'}
            </Text>
          </View>
          <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
            <Feather name="x" size={20} color={COR.texto} />
          </TouchableOpacity>
        </View>

        <ScrollTeclado showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          {/* situação do vigia */}
          <View style={[styles.vigia, vigiaParado && { borderColor: `${COR.vermelho}66` }]}>
            <View style={[styles.bolinha, { backgroundColor: ultimaVerificacao === 0 ? COR.cinza : vigiaParado ? COR.vermelho : COR.verde }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.vigiaTexto}>{textoVigia}</Text>
              {vigiaParado && <Text style={styles.vigiaAviso}>Parece parado. Veja a aba Actions no GitHub.</Text>}
            </View>
            <TouchableOpacity onPress={pedirTeste} disabled={testeEsperando} style={[styles.btnTeste, testeEsperando && { opacity: 0.5 }]}>
              <Text style={styles.btnTesteTexto}>{testeEsperando ? 'Aguardando…' : 'Enviar teste'}</Text>
            </TouchableOpacity>
          </View>

          {/* nova palavra */}
          <Text style={styles.secao}>Vigiar uma palavra</Text>
          <CampoSuave
            rotulo="Ex.: lava e seca"
            valor={termo}
            aoMudar={setTermo}
            aoEnviar={ativarPalavra}
            icone="search"
            maxLength={60}
            autoCapitalizar="none"
          />
          <Text style={styles.dica}>Avisa quando a mensagem tiver todas as palavras (não importa a ordem).</Text>

          <Text style={[styles.rotuloPeq, { marginTop: 12 }]}>Por quanto tempo?</Text>
          <View style={styles.chipsLinha}>
            {DURACOES.map((d) => {
              const ativo = d.chave === duracao;
              return (
                <TouchableOpacity
                  key={d.chave}
                  onPress={() => setDuracao(d.chave)}
                  activeOpacity={0.85}
                  style={[styles.chip, ativo && { backgroundColor: COR.lima, borderColor: COR.lima }]}
                >
                  <Text style={[styles.chipTexto, ativo && { color: COR.grafite }]}>{d.rotulo}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.btnPrimario} onPress={ativarPalavra} activeOpacity={0.85}>
            <Feather name="bell" size={16} color={COR.grafite} />
            <Text style={styles.btnPrimarioTexto}>  Ativar alerta</Text>
          </TouchableOpacity>

          {/* palavras */}
          <Text style={[styles.secao, { marginTop: 22 }]}>Palavras vigiadas</Text>
          {palavras.length === 0 && <Text style={styles.vazio}>Nenhuma ainda. Cadastre a primeira acima.</Text>}
          {palavras.map((p) => {
            const s = situacao(p, agora);
            const cor = corSituacao(s);
            let detalhe = '';
            if (s === 'ativa') detalhe = p.expiraEm > 0 ? `vence em ${tempoRestante(p.expiraEm - agora)} (${dataHora(p.expiraEm)})` : 'sem prazo, até você desligar';
            else if (s === 'pausada') detalhe = 'pausada';
            else detalhe = `terminou em ${dataHora(p.expiraEm)}`;
            return (
              <View key={p.id} style={[styles.linha, s !== 'ativa' && { opacity: 0.8 }]}>
                <View style={[styles.faixa, { backgroundColor: cor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linhaTitulo} numberOfLines={2}>{p.termo}</Text>
                  <Text style={[styles.linhaDetalhe, { color: s === 'ativa' ? COR.cinza : cor }]}>
                    {detalhe}
                    {p.avisos > 0 ? ` · ${p.avisos} ${p.avisos > 1 ? 'avisos' : 'aviso'}` : ''}
                  </Text>
                </View>
                {s === 'expirada' ? (
                  <TouchableOpacity onPress={() => renovarPalavra(p)} style={styles.btnPequeno}>
                    <Feather name="refresh-cw" size={15} color={COR.lima} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => alternarPalavra(p)} style={styles.btnPequeno}>
                    <Feather name={p.ativo ? 'pause' : 'play'} size={15} color={COR.lavanda} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => apagarPalavra(p)} style={styles.btnPequeno}>
                  <Feather name="trash-2" size={15} color={COR.vermelho} />
                </TouchableOpacity>
              </View>
            );
          })}

          {/* canais */}
          <Text style={[styles.secao, { marginTop: 22 }]}>Canais vigiados</Text>
          {canais.length === 0 && <Text style={styles.vazio}>Nenhum canal. Cadastre um abaixo.</Text>}
          {canais.map((c) => (
            <View key={c.id} style={[styles.linha, !c.ativo && { opacity: 0.6 }]}>
              <View style={[styles.faixa, { backgroundColor: c.ativo ? COR.lavanda : COR.cinza }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.linhaTitulo} numberOfLines={1}>@{c.usuario}</Text>
                <Text style={styles.linhaDetalhe}>{c.ativo ? 'vigiando' : 'pausado'}</Text>
              </View>
              <TouchableOpacity onPress={() => alternarCanal(c)} style={styles.btnPequeno}>
                <Feather name={c.ativo ? 'pause' : 'play'} size={15} color={COR.lavanda} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => apagarCanal(c)} style={styles.btnPequeno}>
                <Feather name="trash-2" size={15} color={COR.vermelho} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ marginTop: 10 }}>
            <CampoSuave
              rotulo="Link do canal (t.me/nome)"
              valor={novoCanal}
              aoMudar={setNovoCanal}
              aoEnviar={adicionarCanal}
              icone="link"
              maxLength={120}
              autoCapitalizar="none"
            />
          </View>
          <TouchableOpacity style={styles.btnSecundario} onPress={adicionarCanal} activeOpacity={0.85}>
            <Feather name="plus" size={15} color={COR.lavanda} />
            <Text style={styles.btnSecundarioTexto}>  Adicionar canal</Text>
          </TouchableOpacity>
        </ScrollTeclado>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fundo: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 50 },
  folha: {
    backgroundColor: COR.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 22,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: COR.borda,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  sino: { width: 38, height: 38, borderRadius: 19, backgroundColor: COR.lima, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: COR.texto, fontSize: 18, fontWeight: 'bold' },
  sub: { color: COR.lima, fontSize: 12, fontWeight: 'bold', marginTop: 3 },
  closeBtn: { backgroundColor: COR.grafite, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: COR.borda },

  vigia: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COR.grafite, borderRadius: 16, borderWidth: 1, borderColor: COR.borda, padding: 12 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  vigiaTexto: { color: COR.texto, fontSize: 12, fontWeight: 'bold' },
  vigiaAviso: { color: COR.vermelho, fontSize: 11, marginTop: 2 },
  btnTeste: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: `${COR.lavanda}66` },
  btnTesteTexto: { color: COR.lavanda, fontSize: 12, fontWeight: 'bold' },

  secao: { color: COR.texto, fontSize: 14, fontWeight: 'bold', marginTop: 18, marginBottom: 10 },
  dica: { color: COR.cinza, fontSize: 11, marginTop: 8 },
  rotuloPeq: { color: COR.cinza, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  chipsLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: COR.borda, backgroundColor: COR.grafite },
  chipTexto: { color: COR.texto, fontSize: 12, fontWeight: 'bold' },

  btnPrimario: { flexDirection: 'row', backgroundColor: COR.lima, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  btnPrimarioTexto: { color: COR.grafite, fontSize: 15, fontWeight: 'bold' },
  btnSecundario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: `${COR.lavanda}66`, marginTop: 10 },
  btnSecundarioTexto: { color: COR.lavanda, fontSize: 13, fontWeight: 'bold' },

  vazio: { color: COR.cinza, fontSize: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COR.grafite, borderRadius: 16, borderWidth: 1, borderColor: COR.borda, padding: 12, marginBottom: 8 },
  faixa: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  linhaTitulo: { color: COR.texto, fontSize: 14, fontWeight: 'bold' },
  linhaDetalhe: { color: COR.cinza, fontSize: 11, marginTop: 3 },
  btnPequeno: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COR.card, borderWidth: 1, borderColor: COR.borda },
});
