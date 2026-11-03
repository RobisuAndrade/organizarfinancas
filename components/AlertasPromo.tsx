// ALERTA de promoções no Telegram.
//
// O app só cadastra o que vigiar. Quem vigia de verdade é o script do GitHub Actions
// (scripts/alerta-promo.mjs), que a cada poucos minutos lê os canais públicos do Telegram e
// manda um aviso para o grupo de vocês quando aparece uma das palavras abaixo.
//
// Dados no Firebase:
//   alertasPromo/palavras/{id}: termo, ativo, duracao ('24h'|'7d'|'14d'|'sempre'), criadoEm, expiraEm (0 = sem prazo), avisos
//   alertasPromo/canais/{id}:   usuario (nome do canal em t.me/usuario), ativo
//   alertasPromo/config:        executor ('github' | 'pc'): quem vigia (escolhido aqui)
//   alertasPromo/historico/{t}: quando, origem, canais, palavras, avisos, ok (uma linha por execução do vigia)
//   alertasPromo/estado:        ultimaVerificacao, ultimaOrigem, pcBatimento, pedirTeste, testeAtendido, lidos/{canal} (escritos pelo script)
import { Feather } from '@expo/vector-icons';
import { onValue, push, ref, remove, update } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';
import { useDialogo } from '../hooks/useDialogo';
import AvoidTeclado, { ScrollTeclado, useAlinharAoTeclado } from './AvoidTeclado';
import CampoSuave from './CampoSuave';
import { eventoRolagem } from './BarraScroll';
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
type Execucao = { quando: number; origem: 'github' | 'pc'; avisos: number; ok: boolean };
type Executor = 'github' | 'pc';

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

function horaCompleta(ms: number) {
  const d = new Date(ms);
  const hora = `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:${doisDigitos(d.getSeconds())}`;
  const hoje = new Date();
  const mesmoDia = d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  return mesmoDia ? hora : `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} ${hora}`;
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


// ───────────────────────── dados e ações (compartilhados pelo painel e pela tela) ─────────────────────────
function useAlertas() {
  const { avisar, confirmar } = useDialogo();
  const [palavras, setPalavras] = useState<Palavra[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [ultimaVerificacao, setUltimaVerificacao] = useState(0);
  const [testePedido, setTestePedido] = useState(0);
  const [testeAtendido, setTesteAtendido] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  const [executor, setExecutor] = useState<Executor>('github');
  const [pcBatimento, setPcBatimento] = useState(0);
  const [historico, setHistorico] = useState<Execucao[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const [termo, setTermo] = useState('');
  const [duracao, setDuracao] = useState<Duracao>('7d');
  const [novoCanal, setNovoCanal] = useState('');

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
      setPcBatimento(Number(est.pcBatimento) || 0);
      setExecutor(v.config && v.config.executor === 'pc' ? 'pc' : 'github');

      const listaH: Execucao[] = [];
      for (const h of Object.values<any>(v.historico || {})) {
        if (!h || !Number(h.quando)) continue;
        listaH.push({ quando: Number(h.quando), origem: h.origem === 'pc' ? 'pc' : 'github', avisos: Number(h.avisos) || 0, ok: h.ok !== false });
      }
      listaH.sort((a, b) => b.quando - a.quando);
      setHistorico(listaH.slice(0, 10));
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

  const mudarExecutor = async (novo: Executor) => {
    if (novo === executor) return;
    try {
      await update(ref(db, 'alertasPromo/config'), { executor: novo });
    } catch {
      avisar('Não foi possível trocar', 'Verifique a internet e tente de novo.', 'erro');
    }
  };

  const pedirTeste = async () => {
    try {
      await update(ref(db, 'alertasPromo/estado'), { pedirTeste: Date.now() });
      avisar('Teste pedido', 'Em instantes chega uma mensagem de teste no grupo do Telegram.', 'sucesso');
    } catch {
      avisar('Não foi possível pedir o teste', 'Tente de novo.', 'erro');
    }
  };

  // situação do vigia
  const idadeMin = ultimaVerificacao > 0 ? Math.floor((agora - ultimaVerificacao) / 60000) : -1;
  const vigiaParado = idadeMin > 20;
  const textoVigia =
    ultimaVerificacao === 0
      ? 'O vigia ainda não rodou'
      : idadeMin > 0
        ? `Última checagem há ${tempoRestante(idadeMin * 60000)}`
        : 'Checou agora há pouco';
  const testeEsperando = testePedido > testeAtendido;
  const ativas = palavras.filter((p) => situacao(p, agora) === 'ativa').length;

  // PC com sinal nos últimos 3 minutos = conectado
  const pcOnline = pcBatimento > 0 && agora >= pcBatimento && 3 * 60000 > agora - pcBatimento;
  const textoPc = pcOnline
    ? `PC conectado (sinal há ${tempoRestante(Math.max(60000, agora - pcBatimento))})`
    : pcBatimento > 0
      ? 'PC sem sinal. O GitHub assume sozinho'
      : 'O vigia do PC nunca foi aberto';

  // histórico: só as 5 mais recentes, com aviso quando houve uma pausa grande entre duas execuções
  const linhasHist = historico.slice(0, 5).map((h, i) => {
    const anterior = historico[i + 1];
    const pausa = anterior ? h.quando - anterior.quando : 0;
    return { h, pausa: pausa > 20 * 60000 ? pausa : 0 };
  });

  return {
    palavras, canais, executor, historicoAberto, setHistoricoAberto, termo, setTermo, duracao, setDuracao, novoCanal, setNovoCanal,
    agora, ativas, ultimaVerificacao, vigiaParado, textoVigia, testeEsperando, pcOnline, textoPc, linhasHist, historicoTotal: historico.length,
    ativarPalavra, alternarPalavra, renovarPalavra, apagarPalavra, adicionarCanal, alternarCanal, apagarCanal, mudarExecutor, pedirTeste,
  };
}
type Alertas = ReturnType<typeof useAlertas>;

// ───────────────────────── conteúdo (igual no painel e na tela) ─────────────────────────
function CorpoAlertas({ A }: { A: Alertas }) {
  const corSituacao = (s: Situacao) => (s === 'ativa' ? COR.verde : s === 'pausada' ? COR.cinza : COR.vermelho);
  const ultimaExec = A.linhasHist.length > 0 ? A.linhasHist[0].h : null;

  return (
    <>
      {/* situação do vigia */}
      <View style={[styles.vigia, A.vigiaParado && { borderColor: `${COR.vermelho}66` }]}>
        <View style={[styles.bolinha, { backgroundColor: A.ultimaVerificacao === 0 ? COR.cinza : A.vigiaParado ? COR.vermelho : COR.verde }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.vigiaTexto}>{A.textoVigia}</Text>
          {A.vigiaParado && <Text style={styles.vigiaAviso}>Parece parado. Veja a aba Actions no GitHub ou o vigia do PC.</Text>}
        </View>
        <TouchableOpacity onPress={A.pedirTeste} disabled={A.testeEsperando} style={[styles.btnTeste, A.testeEsperando && { opacity: 0.5 }]}>
          <Text style={styles.btnTesteTexto}>{A.testeEsperando ? 'Aguardando…' : 'Enviar teste'}</Text>
        </TouchableOpacity>
      </View>

      {/* quem vigia */}
      <Text style={styles.secao}>Quem vigia</Text>
      <View style={styles.seg}>
        {([
          { chave: 'github' as Executor, rotulo: 'GitHub', icone: 'cloud' as const },
          { chave: 'pc' as Executor, rotulo: 'Meu PC', icone: 'monitor' as const },
        ]).map((op) => {
          const ativo = A.executor === op.chave;
          return (
            <TouchableOpacity
              key={op.chave}
              onPress={() => A.mudarExecutor(op.chave)}
              activeOpacity={0.85}
              style={[styles.segBtn, ativo && { backgroundColor: COR.lavanda }]}
            >
              <Feather name={op.icone} size={14} color={ativo ? COR.grafite : COR.cinza} />
              <Text style={[styles.segTexto, ativo && { color: COR.grafite }]}>{op.rotulo}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.dica}>
        {A.executor === 'pc'
          ? `${A.textoPc}. Confere a cada 1 minuto enquanto o vigia do PC estiver aberto.`
          : `Confere a cada ~5 minutos (o GitHub às vezes atrasa). ${A.pcOnline ? 'O PC está conectado: escolha "Meu PC" para conferir a cada 1 minuto.' : ''}`}
      </Text>

      {/* últimas execuções (recolhido; toque para ver as 5 últimas) */}
      <TouchableOpacity style={styles.histCab} onPress={() => A.setHistoricoAberto(!A.historicoAberto)} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={styles.secaoSemMargem}>Últimas execuções</Text>
          {!A.historicoAberto && (
            <Text style={styles.histResumo} numberOfLines={1}>
              {ultimaExec
                ? `${horaCompleta(ultimaExec.quando)} · ${ultimaExec.origem === 'pc' ? 'Meu PC' : 'GitHub'} · ${ultimaExec.ok ? (ultimaExec.avisos > 0 ? `${ultimaExec.avisos} ${ultimaExec.avisos > 1 ? 'avisos' : 'aviso'}` : 'sem avisos') : 'falha'}`
                : 'Ainda nenhuma execução registrada'}
            </Text>
          )}
        </View>
        <View style={styles.histSeta}>
          <Feather name={A.historicoAberto ? 'chevron-up' : 'chevron-down'} size={18} color={COR.lavanda} />
        </View>
      </TouchableOpacity>
      {A.historicoAberto && A.linhasHist.length === 0 && <Text style={styles.vazio}>Ainda nenhuma execução registrada.</Text>}
      {A.historicoAberto &&
        A.linhasHist.map(({ h, pausa }) => (
          <View key={h.quando}>
            <View style={styles.linhaHist}>
              <View style={[styles.bolinha, { backgroundColor: h.ok ? COR.verde : COR.vermelho }]} />
              <Text style={styles.histHora}>{horaCompleta(h.quando)}</Text>
              <Text style={styles.histOrigem}>{h.origem === 'pc' ? 'Meu PC' : 'GitHub'}</Text>
              <Text style={[styles.histAvisos, h.avisos > 0 && { color: COR.lima }]}>
                {h.ok ? (h.avisos > 0 ? `${h.avisos} ${h.avisos > 1 ? 'avisos' : 'aviso'}` : 'sem avisos') : 'falha'}
              </Text>
            </View>
            {pausa > 0 && <Text style={styles.histPausa}>⚠ ficou {tempoRestante(pausa)} sem rodar antes desta</Text>}
          </View>
        ))}

      {/* nova palavra */}
      <Text style={[styles.secao, { marginTop: 22 }]}>Vigiar uma palavra</Text>
      <CampoSuave
        rotulo="Ex.: lava e seca"
        valor={A.termo}
        aoMudar={A.setTermo}
        aoEnviar={A.ativarPalavra}
        icone="search"
        maxLength={60}
        autoCapitalizar="none"
      />
      <Text style={styles.dica}>Avisa quando a mensagem tiver todas as palavras (não importa a ordem).</Text>

      <Text style={[styles.rotuloPeq, { marginTop: 12 }]}>Por quanto tempo?</Text>
      <View style={styles.chipsLinha}>
        {DURACOES.map((d) => {
          const ativo = d.chave === A.duracao;
          return (
            <TouchableOpacity
              key={d.chave}
              onPress={() => A.setDuracao(d.chave)}
              activeOpacity={0.85}
              style={[styles.chip, ativo && { backgroundColor: COR.lima, borderColor: COR.lima }]}
            >
              <Text style={[styles.chipTexto, ativo && { color: COR.grafite }]}>{d.rotulo}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.btnPrimario} onPress={A.ativarPalavra} activeOpacity={0.85}>
        <Feather name="bell" size={16} color={COR.grafite} />
        <Text style={styles.btnPrimarioTexto}>  Ativar alerta</Text>
      </TouchableOpacity>

      {/* palavras */}
      <Text style={[styles.secao, { marginTop: 22 }]}>Palavras vigiadas</Text>
      {A.palavras.length === 0 && <Text style={styles.vazio}>Nenhuma ainda. Cadastre a primeira acima.</Text>}
      {A.palavras.map((p) => {
        const s = situacao(p, A.agora);
        const cor = corSituacao(s);
        let detalhe = '';
        if (s === 'ativa') detalhe = p.expiraEm > 0 ? `vence em ${tempoRestante(p.expiraEm - A.agora)} (${dataHora(p.expiraEm)})` : 'sem prazo, até você desligar';
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
              <TouchableOpacity onPress={() => A.renovarPalavra(p)} style={styles.btnPequeno}>
                <Feather name="refresh-cw" size={15} color={COR.lima} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => A.alternarPalavra(p)} style={styles.btnPequeno}>
                <Feather name={p.ativo ? 'pause' : 'play'} size={15} color={COR.lavanda} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => A.apagarPalavra(p)} style={styles.btnPequeno}>
              <Feather name="trash-2" size={15} color={COR.vermelho} />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* canais */}
      <Text style={[styles.secao, { marginTop: 22 }]}>Canais vigiados</Text>
      {A.canais.length === 0 && <Text style={styles.vazio}>Nenhum canal. Cadastre um abaixo.</Text>}
      {A.canais.map((c) => (
        <View key={c.id} style={[styles.linha, !c.ativo && { opacity: 0.6 }]}>
          <View style={[styles.faixa, { backgroundColor: c.ativo ? COR.lavanda : COR.cinza }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linhaTitulo} numberOfLines={1}>@{c.usuario}</Text>
            <Text style={styles.linhaDetalhe}>{c.ativo ? 'vigiando' : 'pausado'}</Text>
          </View>
          <TouchableOpacity onPress={() => A.alternarCanal(c)} style={styles.btnPequeno}>
            <Feather name={c.ativo ? 'pause' : 'play'} size={15} color={COR.lavanda} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => A.apagarCanal(c)} style={styles.btnPequeno}>
            <Feather name="trash-2" size={15} color={COR.vermelho} />
          </TouchableOpacity>
        </View>
      ))}
      <View style={{ marginTop: 10 }}>
        <CampoSuave
          rotulo="Link do canal (t.me/nome)"
          valor={A.novoCanal}
          aoMudar={A.setNovoCanal}
          aoEnviar={A.adicionarCanal}
          icone="link"
          maxLength={120}
          autoCapitalizar="none"
        />
      </View>
      <TouchableOpacity style={styles.btnSecundario} onPress={A.adicionarCanal} activeOpacity={0.85}>
        <Feather name="plus" size={15} color={COR.lavanda} />
        <Text style={styles.btnSecundarioTexto}>  Adicionar canal</Text>
      </TouchableOpacity>
    </>
  );
}

// ───────────────────────── painel (aberto pelo botão ALERTA ao lado de Comparar) ─────────────────────────
export function PainelAlertas({ aoFechar }: { aoFechar: () => void }) {
  const A = useAlertas();
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const fechar = () => {
    Keyboard.dismiss();
    Animated.timing(entrada, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => aoFechar());
  };

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
              {A.ativas > 0 ? `${A.ativas} ${A.ativas > 1 ? 'palavras ativas' : 'palavra ativa'} · aviso no Telegram` : 'Aviso no Telegram'}
            </Text>
          </View>
          <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
            <Feather name="x" size={20} color={COR.texto} />
          </TouchableOpacity>
        </View>

        {/* paddingBottom grande: a barra de baixo flutua por cima e não pode cobrir o último botão */}
        <ScrollTeclado showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
          <CorpoAlertas A={A} />
        </ScrollTeclado>
      </Animated.View>
    </View>
  );
}

// ───────────────────────── tela cheia (ícone de sino na barra de baixo) ─────────────────────────
export function TelaAlertas({ aoVoltar }: { aoVoltar: () => void }) {
  const A = useAlertas();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const { onTouchEnd } = useAlinharAoTeclado(scrollRef);

  // mesma mecânica da tela "Para a Nossa Casa": ao descer, o cabeçalho some; ao subir um pouco, ele volta
  const headerTranslateY = Animated.diffClamp(scrollY, 0, 100).interpolate({ inputRange: [0, 100], outputRange: [0, -100], extrapolate: 'clamp' });

  return (
    <SafeAreaView style={styles.tela}>
      <AvoidTeclado>
        <View style={styles.telaMiolo}>
          <Animated.ScrollView
            ref={scrollRef as any}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 120, paddingBottom: 170, paddingHorizontal: 20 }}
            onScroll={eventoRolagem(scrollY)}
            scrollEventThrottle={16}
            onTouchEnd={onTouchEnd}
          >
            <CorpoAlertas A={A} />
          </Animated.ScrollView>

          <Animated.View style={[styles.headerFlutuante, { transform: [{ translateY: headerTranslateY }] }]}>
            <View style={styles.headerLinha}>
              <TouchableOpacity onPress={aoVoltar} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color={COR.lima} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.tituloTela}>Alerta de promoções</Text>
                <Text style={styles.subtituloTela}>
                  {A.ativas > 0 ? `${A.ativas} ${A.ativas > 1 ? 'palavras ativas' : 'palavra ativa'} · aviso no Telegram` : 'Aviso no Telegram'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </AvoidTeclado>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  secaoSemMargem: { color: COR.texto, fontSize: 14, fontWeight: 'bold' },
  histCab: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 8, backgroundColor: COR.grafite, borderRadius: 14, borderWidth: 1, borderColor: COR.borda, paddingVertical: 10, paddingHorizontal: 12 },
  histResumo: { color: COR.cinza, fontSize: 11, marginTop: 3 },
  histSeta: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COR.card, borderWidth: 1, borderColor: COR.borda },

  tela: { flex: 1, backgroundColor: COR.grafite },
  telaMiolo: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  headerFlutuante: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: COR.grafite, zIndex: 10, paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 15, paddingHorizontal: 20 },
  headerLinha: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: COR.card, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: COR.borda },
  tituloTela: { fontSize: 22, fontWeight: 'bold', color: COR.texto },
  subtituloTela: { fontSize: 12, color: COR.lima, fontWeight: 'bold', marginTop: 2 },
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

  seg: { flexDirection: 'row', backgroundColor: COR.grafite, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: COR.borda },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  segTexto: { color: COR.cinza, fontSize: 12, fontWeight: 'bold' },
  linhaHist: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COR.grafite, borderRadius: 12, borderWidth: 1, borderColor: COR.borda, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 6 },
  histHora: { color: COR.texto, fontSize: 12, fontWeight: 'bold', flex: 1 },
  histOrigem: { color: COR.lavanda, fontSize: 11, fontWeight: 'bold' },
  histAvisos: { color: COR.cinza, fontSize: 11, minWidth: 58, textAlign: 'right' },
  histPausa: { color: COR.vermelho, fontSize: 11, marginBottom: 6, marginLeft: 4 },

  vazio: { color: COR.cinza, fontSize: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COR.grafite, borderRadius: 16, borderWidth: 1, borderColor: COR.borda, padding: 12, marginBottom: 8 },
  faixa: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  linhaTitulo: { color: COR.texto, fontSize: 14, fontWeight: 'bold' },
  linhaDetalhe: { color: COR.cinza, fontSize: 11, marginTop: 3 },
  btnPequeno: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COR.card, borderWidth: 1, borderColor: COR.borda },
});
