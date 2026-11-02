// Acompanhar preços de produtos da Lista de Compras (registro 100% manual).
//
// Dados no Firebase, dentro do próprio item:
//   listasCompras/{lista}/itens/{item}/acompanhamento
//     link, loja, precoAvista, parcelas, valorParcela, totalParcelado, frete, observacao,
//     menorPreco, precoAlvo, atualizadoEm,
//     historico/{id}: valores ANTIGOS com a data em que foram registrados
import { Feather } from '@expo/vector-icons';
import { push, ref, remove, update } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';
import { useDialogo } from '../hooks/useDialogo';
import { converterParaNumero, formatarInputMoeda, formatarMoeda } from '../utils/formatadores';
import { ScrollTeclado } from './AvoidTeclado';
import CampoSuave from './CampoSuave';
import { COR } from './corLista';

// ───────────────────────── tipos e leitura ─────────────────────────
export type RegistroPreco = {
  id: string;
  data: string;
  precoAvista: number;
  parcelas: number;
  valorParcela: number;
  totalParcelado: number;
  frete: number;
  loja: string;
};

export type Acompanhamento = {
  link: string;
  loja: string;
  precoAvista: number;
  parcelas: number;
  valorParcela: number;
  totalParcelado: number;
  frete: number;
  observacao: string;
  menorPreco: number;
  precoAlvo: number;
  atualizadoEm: string;
  historico: RegistroPreco[]; // do mais recente para o mais antigo
};

export type ItemComparavel = { id: string; nome: string; listaNome: string; acomp: Acompanhamento };

const num = (v: any) => Number(v) || 0;

export function lerAcompanhamento(raw: any): Acompanhamento | null {
  if (!raw || typeof raw !== 'object') return null;
  const historico: RegistroPreco[] = [];
  const h = raw.historico || {};
  for (const id of Object.keys(h)) {
    const r = h[id];
    if (!r) continue;
    historico.push({
      id,
      data: String(r.data || ''),
      precoAvista: num(r.precoAvista),
      parcelas: num(r.parcelas),
      valorParcela: num(r.valorParcela),
      totalParcelado: num(r.totalParcelado),
      frete: num(r.frete),
      loja: String(r.loja || ''),
    });
  }
  historico.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return {
    link: String(raw.link || ''),
    loja: String(raw.loja || ''),
    precoAvista: num(raw.precoAvista),
    parcelas: num(raw.parcelas),
    valorParcela: num(raw.valorParcela),
    totalParcelado: num(raw.totalParcelado),
    frete: num(raw.frete),
    observacao: String(raw.observacao || ''),
    menorPreco: num(raw.menorPreco),
    precoAlvo: num(raw.precoAlvo),
    atualizadoEm: String(raw.atualizadoEm || ''),
    historico,
  };
}

// variação do preço à vista desde o registro anterior (negativo = baixou)
export function variacaoPreco(a: Acompanhamento): number | null {
  if (a.historico.length === 0) return null;
  return a.precoAvista - a.historico[0].precoAvista;
}

export const alvoAtingido = (a: Acompanhamento) => a.precoAlvo > 0 && a.precoAlvo >= a.precoAvista;

export const dataCurta = (iso: string) => {
  if (!iso) return '--/--/----';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('pt-BR');
};

const paraInput = (v: number) => (v > 0 ? formatarInputMoeda(String(Math.round(v * 100))) : '');

const garantirHttp = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// ───────────────────────── resumo dentro do item ─────────────────────────
export function ResumoPreco({ acomp, aoAbrir }: { acomp: Acompanhamento; aoAbrir: () => void }) {
  const v = variacaoPreco(acomp);
  let corVar = COR.cinza;
  let textoVar = '';
  if (v !== null) {
    if (v > 0) {
      corVar = COR.vermelho;
      textoVar = `↑ ${formatarMoeda(v)}`;
    } else if (v === 0) {
      textoVar = '= igual';
    } else {
      corVar = COR.verde;
      textoVar = `↓ ${formatarMoeda(Math.abs(v))}`;
    }
  }
  return (
    <TouchableOpacity style={styles.resumo} onPress={aoAbrir} activeOpacity={0.8}>
      <Feather name="trending-down" size={12} color={COR.lavanda} />
      <Text style={styles.resumoTexto} numberOfLines={1}>
        {formatarMoeda(acomp.precoAvista)}
        {!!textoVar && <Text style={{ color: corVar, fontWeight: 'bold' }}>{'  '}{textoVar}</Text>}
        {acomp.menorPreco > 0 && <Text style={{ color: COR.cinza }}>{'  •  menor '}{formatarMoeda(acomp.menorPreco)}</Text>}
        {alvoAtingido(acomp) && <Text style={{ color: COR.lima, fontWeight: 'bold' }}>{'  🎯'}</Text>}
      </Text>
    </TouchableOpacity>
  );
}

// ───────────────────────── mini gráfico ─────────────────────────
function MiniGrafico({ valores }: { valores: number[] }) {
  if (valores.length === 0) return null;
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const faixa = maior - menor || 1;
  return (
    <View style={styles.grafico}>
      {valores.map((v, i) => {
        const ultimo = i === valores.length - 1;
        const altura = 12 + ((v - menor) / faixa) * 44;
        const cor = ultimo ? COR.lima : v === menor ? COR.verde : COR.borda;
        return <View key={i} style={[styles.graficoBarra, { height: altura, backgroundColor: cor }]} />;
      })}
    </View>
  );
}

// ───────────────────────── painel: formulário + detalhe ─────────────────────────
// caminhoItem: nó do produto no Firebase (ex: listasCompras/L/itens/I ou acompanharPrecos/ID).
// Se vier null, é um produto novo e ele é criado dentro de `colecaoNova`.
export function PainelPreco({
  caminhoItem,
  colecaoNova,
  nomeItem,
  editarNome = false,
  removerTudo = false,
  acomp,
  aoFechar,
}: {
  caminhoItem: string | null;
  colecaoNova?: string;
  nomeItem: string;
  editarNome?: boolean;
  removerTudo?: boolean;
  acomp: Acompanhamento | null;
  aoFechar: () => void;
}) {
  const { confirmar, avisar } = useDialogo();
  const [modo, setModo] = useState<'detalhe' | 'form'>(acomp ? 'detalhe' : 'form');
  const [salvando, setSalvando] = useState(false);

  const [nomeProduto, setNomeProduto] = useState(nomeItem || '');
  const [link, setLink] = useState(acomp?.link || '');
  const [loja, setLoja] = useState(acomp?.loja || '');
  const [avista, setAvista] = useState(acomp ? paraInput(acomp.precoAvista) : '');
  const [parcelas, setParcelas] = useState(acomp && acomp.parcelas > 0 ? String(acomp.parcelas) : '');
  const [valorParcela, setValorParcela] = useState(acomp ? paraInput(acomp.valorParcela) : '');
  const [frete, setFrete] = useState(acomp ? paraInput(acomp.frete) : '');
  const [alvo, setAlvo] = useState(acomp ? paraInput(acomp.precoAlvo) : '');
  const [obs, setObs] = useState(acomp?.observacao || '');

  // animação de entrada/saída
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const fechar = () => {
    Keyboard.dismiss();
    Animated.timing(entrada, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => aoFechar());
  };

  const nAvista = converterParaNumero(avista);
  const nParcelas = parseInt(parcelas, 10) || 0;
  const nValorParcela = converterParaNumero(valorParcela);
  const nFrete = converterParaNumero(frete);
  const nAlvo = converterParaNumero(alvo);
  const total = nParcelas > 0 ? Math.round(nParcelas * nValorParcela * 100) / 100 : 0;
  const juros = total > 0 && nAvista > 0 && total > nAvista ? total - nAvista : 0;
  const jurosPct = juros > 0 && nAvista > 0 ? (juros / nAvista) * 100 : 0;

  const caminho = caminhoItem ? `${caminhoItem}/acompanhamento` : '';

  const salvar = async () => {
    if (editarNome && !nomeProduto.trim()) {
      avisar('Falta o nome', 'Informe o nome do produto.', 'aviso');
      return;
    }
    if (nAvista <= 0) {
      avisar('Falta o valor', 'Informe o valor à vista do produto.', 'aviso');
      return;
    }
    setSalvando(true);
    try {
      const agora = new Date().toISOString();
      const novo: any = {
        link: link.trim(),
        loja: loja.trim(),
        precoAvista: nAvista,
        parcelas: nParcelas,
        valorParcela: nParcelas > 0 ? nValorParcela : 0,
        totalParcelado: total,
        frete: nFrete,
        observacao: obs.trim(),
        precoAlvo: nAlvo > 0 ? nAlvo : null,
        atualizadoEm: agora,
      };
      if (!caminhoItem) {
        // produto novo: cria o nó inteiro
        novo.menorPreco = nAvista;
        const id = push(ref(db, colecaoNova || 'acompanharPrecos')).key;
        await update(ref(db, `${colecaoNova || 'acompanharPrecos'}/${id}`), {
          nome: nomeProduto.trim(),
          criadoEm: agora,
          acompanhamento: novo,
        });
        Keyboard.dismiss();
        fechar();
        return;
      }
      if (editarNome && nomeProduto.trim() !== nomeItem) {
        await update(ref(db, caminhoItem), { nome: nomeProduto.trim() });
      }
      if (!acomp) {
        novo.menorPreco = nAvista;
      } else {
        const mudouPreco =
          acomp.precoAvista !== nAvista || acomp.totalParcelado !== total || acomp.frete !== nFrete || acomp.loja !== novo.loja;
        if (mudouPreco) {
          // o valor antigo vai para o histórico, com a data em que foi registrado
          const chave = push(ref(db, `${caminho}/historico`)).key;
          novo[`historico/${chave}`] = {
            data: acomp.atualizadoEm || agora,
            precoAvista: acomp.precoAvista,
            parcelas: acomp.parcelas,
            valorParcela: acomp.valorParcela,
            totalParcelado: acomp.totalParcelado,
            frete: acomp.frete,
            loja: acomp.loja,
          };
          novo.menorPreco = acomp.menorPreco > 0 ? Math.min(acomp.menorPreco, nAvista) : nAvista;
        } else {
          // só corrigiu link/observação/alvo: não polui o histórico
          novo.atualizadoEm = acomp.atualizadoEm || agora;
          novo.menorPreco = acomp.menorPreco > 0 ? acomp.menorPreco : nAvista;
        }
      }
      await update(ref(db, caminho), novo);
      Keyboard.dismiss();
      if (acomp) setModo('detalhe');
      else fechar();
    } catch (e) {
      avisar('Não salvou', 'Não foi possível salvar o preço agora. Tente de novo.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    const ok = await confirmar({
      titulo: 'Parar de acompanhar',
      mensagem: removerTudo
        ? `Apagar "${nomeItem}" e todo o histórico de preços?`
        : `Apagar o acompanhamento de preço e o histórico de "${nomeItem}"? O item continua na lista.`,
      perigo: true,
    });
    if (!ok) return;
    if (!caminhoItem) return;
    if (removerTudo) await remove(ref(db, caminhoItem));
    else await update(ref(db, caminhoItem), { acompanhamento: null });
    fechar();
  };

  const abrirLink = () => {
    if (!acomp || !acomp.link) return;
    Linking.openURL(garantirHttp(acomp.link)).catch(() => avisar('Link inválido', 'Não consegui abrir esse link.', 'aviso'));
  };

  // ── DETALHE ──
  const renderDetalhe = () => {
    if (!acomp) return null;
    const v = variacaoPreco(acomp);
    const registros: RegistroPreco[] = [
      {
        id: 'atual',
        data: acomp.atualizadoEm,
        precoAvista: acomp.precoAvista,
        parcelas: acomp.parcelas,
        valorParcela: acomp.valorParcela,
        totalParcelado: acomp.totalParcelado,
        frete: acomp.frete,
        loja: acomp.loja,
      },
      ...acomp.historico,
    ];
    const serie: number[] = [];
    for (let i = Math.min(registros.length, 12) - 1; i >= 0; i--) serie.push(registros[i].precoAvista);
    const jurosAtual = acomp.totalParcelado > acomp.precoAvista ? acomp.totalParcelado - acomp.precoAvista : 0;

    return (
      <>
        <View style={styles.cardPreco}>
          <Text style={styles.rotuloPeq}>À vista</Text>
          <View style={styles.linhaPreco}>
            <Text style={styles.precoGrande}>{formatarMoeda(acomp.precoAvista)}</Text>
            {v !== null && (
              <View
                style={[
                  styles.chipVar,
                  v > 0 ? { backgroundColor: `${COR.vermelho}22` } : v === 0 ? { backgroundColor: COR.borda } : { backgroundColor: `${COR.verde}22` },
                ]}
              >
                <Text style={[styles.chipVarTexto, { color: v > 0 ? COR.vermelho : v === 0 ? COR.cinza : COR.verde }]}>
                  {v > 0 ? `↑ ${formatarMoeda(v)}` : v === 0 ? '= igual' : `↓ ${formatarMoeda(Math.abs(v))}`}
                </Text>
              </View>
            )}
          </View>

          {acomp.parcelas > 0 && acomp.totalParcelado > 0 && (
            <Text style={styles.linhaInfo}>
              {acomp.parcelas}x de {formatarMoeda(acomp.valorParcela)} = <Text style={styles.negrito}>{formatarMoeda(acomp.totalParcelado)}</Text>
              {jurosAtual > 0 && <Text style={{ color: COR.vermelho }}>{'  (+'}{formatarMoeda(jurosAtual)}{' de juros)'}</Text>}
            </Text>
          )}
          {acomp.frete > 0 && <Text style={styles.linhaInfo}>Frete: <Text style={styles.negrito}>{formatarMoeda(acomp.frete)}</Text></Text>}
          {acomp.menorPreco > 0 && (
            <Text style={styles.linhaInfo}>
              Menor preço já visto: <Text style={[styles.negrito, { color: COR.verde }]}>{formatarMoeda(acomp.menorPreco)}</Text>
            </Text>
          )}
          {acomp.precoAlvo > 0 && (
            <Text style={styles.linhaInfo}>
              Preço-alvo: <Text style={styles.negrito}>{formatarMoeda(acomp.precoAlvo)}</Text>
              {alvoAtingido(acomp) && <Text style={{ color: COR.lima, fontWeight: 'bold' }}>{'   🎯 Alvo atingido!'}</Text>}
            </Text>
          )}
          {!!acomp.loja && <Text style={styles.linhaInfo}>Loja: <Text style={styles.negrito}>{acomp.loja}</Text></Text>}
          {!!acomp.observacao && <Text style={[styles.linhaInfo, { fontStyle: 'italic' }]}>{acomp.observacao}</Text>}
          <Text style={styles.atualizado}>Atualizado em {dataCurta(acomp.atualizadoEm)}</Text>
        </View>

        <View style={styles.botoesLinha}>
          <TouchableOpacity style={[styles.btnPrimario, { flex: 1 }]} onPress={() => setModo('form')} activeOpacity={0.85}>
            <Feather name="refresh-cw" size={16} color={COR.grafite} style={{ marginRight: 8 }} />
            <Text style={styles.btnPrimarioTexto}>Atualizar preço</Text>
          </TouchableOpacity>
          {!!acomp.link && (
            <TouchableOpacity style={styles.btnSecundario} onPress={abrirLink} activeOpacity={0.85}>
              <Feather name="external-link" size={16} color={COR.lavanda} />
              <Text style={styles.btnSecundarioTexto}>Abrir link</Text>
            </TouchableOpacity>
          )}
        </View>

        {serie.length > 1 && (
          <View style={styles.blocoHistorico}>
            <Text style={styles.rotuloPeq}>Evolução do preço à vista</Text>
            <MiniGrafico valores={serie} />
          </View>
        )}

        <View style={styles.blocoHistorico}>
          <Text style={styles.rotuloPeq}>Histórico</Text>
          {registros.map((r, i) => (
            <View key={r.id} style={styles.linhaHist}>
              <View style={{ flex: 1 }}>
                <Text style={styles.histData}>
                  {dataCurta(r.data)}
                  {i === 0 ? '  • atual' : ''}
                </Text>
                {!!r.loja && <Text style={styles.histLoja} numberOfLines={1}>{r.loja}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.histValor}>{formatarMoeda(r.precoAvista)}</Text>
                {r.totalParcelado > 0 && <Text style={styles.histLoja}>{r.parcelas}x = {formatarMoeda(r.totalParcelado)}</Text>}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.btnRemover} onPress={remover}>
          <Feather name="trash-2" size={15} color={COR.vermelho} />
          <Text style={styles.btnRemoverTexto}>Parar de acompanhar</Text>
        </TouchableOpacity>
      </>
    );
  };

  // ── FORMULÁRIO ──
  const renderForm = () => (
    <>
      {editarNome && (
        <>
          <CampoSuave rotulo="Nome do produto (ex: Máquina de lavar)" valor={nomeProduto} aoMudar={setNomeProduto} icone="tag" maxLength={50} autoFocus={!caminhoItem} />
          <View style={styles.espaco} />
        </>
      )}
      <CampoSuave rotulo="Link do produto" valor={link} aoMudar={setLink} icone="link" teclado="url" autoCapitalizar="none" />
      <View style={styles.espaco} />
      <CampoSuave rotulo="Loja (ex: Magalu)" valor={loja} aoMudar={setLoja} icone="shopping-bag" maxLength={40} />
      <View style={styles.espaco} />
      <CampoSuave rotulo="Valor à vista (R$)" valor={avista} aoMudar={(t) => setAvista(formatarInputMoeda(t))} icone="dollar-sign" teclado="numeric" />

      <Text style={[styles.rotuloPeq, { marginTop: 14, marginBottom: 8 }]}>Parcelamento (opcional)</Text>
      <View style={styles.linhaDupla}>
        <View style={{ width: 110 }}>
          <CampoSuave rotulo="Parcelas" valor={parcelas} aoMudar={(t) => setParcelas(t.replace(/\D/g, '').slice(0, 2))} teclado="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <CampoSuave rotulo="Valor da parcela" valor={valorParcela} aoMudar={(t) => setValorParcela(formatarInputMoeda(t))} teclado="numeric" />
        </View>
      </View>
      {total > 0 && (
        <View style={styles.totalBox}>
          <Text style={styles.totalTexto}>
            Total parcelado: <Text style={styles.negrito}>{formatarMoeda(total)}</Text>
          </Text>
          {juros > 0 ? (
            <Text style={[styles.totalTexto, { color: COR.vermelho }]}>
              Juros embutidos: {formatarMoeda(juros)} ({jurosPct.toFixed(1).replace('.', ',')}%)
            </Text>
          ) : (
            <Text style={[styles.totalTexto, { color: COR.verde }]}>Sem juros em relação ao à vista</Text>
          )}
        </View>
      )}

      <View style={styles.espaco} />
      <View style={styles.linhaDupla}>
        <View style={{ flex: 1 }}>
          <CampoSuave rotulo="Frete (R$)" valor={frete} aoMudar={(t) => setFrete(formatarInputMoeda(t))} teclado="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <CampoSuave rotulo="Preço-alvo (R$)" valor={alvo} aoMudar={(t) => setAlvo(formatarInputMoeda(t))} teclado="numeric" />
        </View>
      </View>
      <View style={styles.espaco} />
      <CampoSuave rotulo="Observação (voltagem, garantia, cupom...)" valor={obs} aoMudar={setObs} icone="file-text" maxLength={120} />

      <TouchableOpacity style={[styles.btnPrimario, { marginTop: 16 }, salvando && { opacity: 0.5 }]} onPress={salvar} disabled={salvando} activeOpacity={0.85}>
        <Feather name="check" size={18} color={COR.grafite} style={{ marginRight: 8 }} />
        <Text style={styles.btnPrimarioTexto}>{acomp ? 'Salvar novo preço' : 'Começar a acompanhar'}</Text>
      </TouchableOpacity>
      {!!acomp && (
        <TouchableOpacity style={styles.btnCancelarForm} onPress={() => setModo('detalhe')}>
          <Text style={styles.btnCancelarFormTexto}>Cancelar</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <View style={styles.fundo}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', opacity: entrada }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={fechar} />
      </Animated.View>

      <Animated.View
        style={[
          styles.folha,
          { opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [260, 0] }) }] },
        ]}
      >
        <View style={styles.cabecalho}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.titulo} numberOfLines={2}>{modo === 'form' && !acomp ? (caminhoItem ? 'Acompanhar preço' : 'Novo produto') : modo === 'form' ? 'Atualizar preço' : 'Preço'}</Text>
            <Text style={styles.sub} numberOfLines={1}>{nomeItem || 'Acompanhar preço de um produto'}</Text>
          </View>
          <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
            <Feather name="x" size={20} color={COR.texto} />
          </TouchableOpacity>
        </View>

        <ScrollTeclado showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          {modo === 'form' || !acomp ? renderForm() : renderDetalhe()}
        </ScrollTeclado>
      </Animated.View>
    </View>
  );
}

// ───────────────────────── comparativo lado a lado ─────────────────────────
export function PainelComparativo({ itens, aoFechar }: { itens: ItemComparavel[]; aoFechar: () => void }) {
  const [idA, setIdA] = useState(itens.length > 0 ? itens[0].id : '');
  const [idB, setIdB] = useState(itens.length > 1 ? itens[1].id : '');
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const fechar = () => {
    Animated.timing(entrada, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => aoFechar());
  };

  const A = itens.find((i) => i.id === idA);
  const B = itens.find((i) => i.id === idB);

  // 'a' ou 'b' = o menor valor ganha; '' = empate ou sem dado
  const melhor = (x: number, y: number) => {
    if (x > 0 && y > 0) {
      if (y > x) return 'a';
      if (x > y) return 'b';
    }
    return '';
  };

  const linhas: { rotulo: string; a: number; b: number }[] = [];
  if (A && B) {
    linhas.push({ rotulo: 'À vista', a: A.acomp.precoAvista, b: B.acomp.precoAvista });
    if (A.acomp.totalParcelado > 0 || B.acomp.totalParcelado > 0) {
      linhas.push({ rotulo: 'Total parcelado', a: A.acomp.totalParcelado, b: B.acomp.totalParcelado });
    }
    linhas.push({ rotulo: 'Frete', a: A.acomp.frete, b: B.acomp.frete });
    linhas.push({ rotulo: 'À vista + frete', a: A.acomp.precoAvista + A.acomp.frete, b: B.acomp.precoAvista + B.acomp.frete });
    linhas.push({ rotulo: 'Menor já visto', a: A.acomp.menorPreco, b: B.acomp.menorPreco });
  }

  const dif = A && B ? Math.abs(A.acomp.precoAvista - B.acomp.precoAvista) : 0;
  const maisBarata = A && B ? melhor(A.acomp.precoAvista, B.acomp.precoAvista) : '';

  const celula = (valor: number, ganha: boolean, rotulo: string) => {
    const vazio = valor <= 0 && rotulo !== 'Frete';
    return (
      <View style={[styles.celula, ganha && { backgroundColor: `${COR.verde}1f`, borderColor: `${COR.verde}66` }]}>
        <Text style={[styles.celulaValor, ganha && { color: COR.verde }]}>
          {vazio ? '—' : rotulo === 'Frete' && valor <= 0 ? 'Grátis' : formatarMoeda(valor)}
        </Text>
        {ganha && <Text style={styles.celulaMelhor}>menor</Text>}
      </View>
    );
  };

  const chips = (selecionado: string, aoEscolher: (id: string) => void, outro: string) => (
    <View style={styles.chipsLinha}>
      {itens.map((it) => {
        const ativo = it.id === selecionado;
        const bloqueado = it.id === outro;
        return (
          <TouchableOpacity
            key={it.id}
            disabled={bloqueado}
            onPress={() => aoEscolher(it.id)}
            style={[styles.chipItem, ativo && { backgroundColor: COR.lavanda, borderColor: COR.lavanda }, bloqueado && { opacity: 0.35 }]}
          >
            <Text style={[styles.chipItemTexto, ativo && { color: COR.grafite }]} numberOfLines={1}>{it.nome}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.fundo}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', opacity: entrada }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={fechar} />
      </Animated.View>

      <Animated.View
        style={[styles.folha, { opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [260, 0] }) }] }]}
      >
        <View style={styles.cabecalho}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.titulo}>Comparar preços</Text>
            <Text style={styles.sub}>Produtos que você está acompanhando</Text>
          </View>
          <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
            <Feather name="x" size={20} color={COR.texto} />
          </TouchableOpacity>
        </View>

        <ScrollTeclado showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <Text style={styles.rotuloPeq}>Produto A</Text>
          {chips(idA, setIdA, idB)}
          <Text style={[styles.rotuloPeq, { marginTop: 10 }]}>Produto B</Text>
          {chips(idB, setIdB, idA)}

          {A && B && (
            <>
              <View style={styles.tabelaTopo}>
                <View style={styles.colunaRotulo} />
                <Text style={styles.tabelaNome} numberOfLines={2}>{A.nome}</Text>
                <Text style={styles.tabelaNome} numberOfLines={2}>{B.nome}</Text>
              </View>
              {linhas.map((l) => {
                const m = l.rotulo === 'Frete' ? '' : melhor(l.a, l.b);
                return (
                  <View key={l.rotulo} style={styles.tabelaLinha}>
                    <Text style={styles.colunaRotulo}>{l.rotulo}</Text>
                    {celula(l.a, m === 'a', l.rotulo)}
                    {celula(l.b, m === 'b', l.rotulo)}
                  </View>
                );
              })}
              <View style={styles.tabelaLinha}>
                <Text style={styles.colunaRotulo}>Loja</Text>
                <Text style={styles.tabelaTexto} numberOfLines={1}>{A.acomp.loja || '—'}</Text>
                <Text style={styles.tabelaTexto} numberOfLines={1}>{B.acomp.loja || '—'}</Text>
              </View>

              <View style={styles.resumoComparativo}>
                {maisBarata === '' ? (
                  <Text style={styles.resumoComparativoTexto}>Os dois estão com o mesmo preço à vista.</Text>
                ) : (
                  <Text style={styles.resumoComparativoTexto}>
                    <Text style={{ fontWeight: '900', color: COR.verde }}>{maisBarata === 'a' ? A.nome : B.nome}</Text> está{' '}
                    <Text style={{ fontWeight: '900', color: COR.lima }}>{formatarMoeda(dif)}</Text> mais barato à vista.
                  </Text>
                )}
              </View>
            </>
          )}
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
  cabecalho: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  titulo: { color: COR.texto, fontSize: 18, fontWeight: 'bold' },
  sub: { color: COR.lima, fontSize: 12, fontWeight: 'bold', marginTop: 3 },
  closeBtn: { backgroundColor: COR.grafite, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: COR.borda },
  espaco: { height: 10 },
  linhaDupla: { flexDirection: 'row', gap: 10 },
  rotuloPeq: { color: COR.cinza, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  negrito: { color: COR.texto, fontWeight: 'bold' },

  totalBox: { backgroundColor: COR.grafite, borderRadius: 12, borderWidth: 1, borderColor: COR.borda, padding: 10, marginTop: 10, gap: 3 },
  totalTexto: { color: COR.cinza, fontSize: 12 },

  btnPrimario: { flexDirection: 'row', backgroundColor: COR.lima, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnPrimarioTexto: { color: COR.grafite, fontSize: 15, fontWeight: 'bold' },
  btnSecundario: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: `${COR.lavanda}66` },
  btnSecundarioTexto: { color: COR.lavanda, fontSize: 13, fontWeight: 'bold' },
  btnCancelarForm: { alignItems: 'center', paddingVertical: 12 },
  btnCancelarFormTexto: { color: COR.cinza, fontSize: 13, fontWeight: 'bold' },
  botoesLinha: { flexDirection: 'row', gap: 10, marginTop: 12 },

  cardPreco: { backgroundColor: COR.grafite, borderRadius: 20, borderWidth: 1, borderColor: COR.borda, padding: 16, gap: 6 },
  linhaPreco: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  precoGrande: { color: COR.texto, fontSize: 28, fontWeight: '900' },
  chipVar: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  chipVarTexto: { fontSize: 12, fontWeight: 'bold' },
  linhaInfo: { color: COR.cinza, fontSize: 12 },
  atualizado: { color: COR.cinza, fontSize: 10, marginTop: 4 },

  blocoHistorico: { marginTop: 16 },
  grafico: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 60, marginTop: 10 },
  graficoBarra: { flex: 1, borderRadius: 4 },
  linhaHist: { flexDirection: 'row', alignItems: 'center', backgroundColor: COR.borda, borderRadius: 12, padding: 10, marginTop: 8, gap: 10 },
  histData: { color: COR.texto, fontSize: 12, fontWeight: 'bold' },
  histLoja: { color: COR.cinza, fontSize: 10, marginTop: 2 },
  histValor: { color: COR.texto, fontSize: 13, fontWeight: '900' },

  btnRemover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: `${COR.vermelho}15`, borderWidth: 1, borderColor: `${COR.vermelho}30` },
  btnRemoverTexto: { color: COR.vermelho, fontSize: 13, fontWeight: 'bold' },

  resumo: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: `${COR.lavanda}18` },
  resumoTexto: { color: COR.texto, fontSize: 11, fontWeight: 'bold', flexShrink: 1 },

  // comparativo
  chipsLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chipItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: COR.grafite, borderWidth: 1, borderColor: COR.borda, maxWidth: '100%' },
  chipItemTexto: { color: COR.cinza, fontSize: 12, fontWeight: 'bold' },
  tabelaTopo: { flexDirection: 'row', gap: 8, marginTop: 18, alignItems: 'flex-end' },
  tabelaNome: { flex: 1, color: COR.texto, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  tabelaLinha: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  colunaRotulo: { width: 86, color: COR.cinza, fontSize: 11, fontWeight: 'bold' },
  celula: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: COR.grafite, borderWidth: 1, borderColor: COR.borda },
  celulaValor: { color: COR.texto, fontSize: 13, fontWeight: '900' },
  celulaMelhor: { color: COR.verde, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2 },
  tabelaTexto: { flex: 1, color: COR.texto, fontSize: 12, textAlign: 'center' },
  resumoComparativo: { marginTop: 16, backgroundColor: COR.grafite, borderRadius: 14, borderWidth: 1, borderColor: COR.borda, padding: 12 },
  resumoComparativoTexto: { color: COR.cinza, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
