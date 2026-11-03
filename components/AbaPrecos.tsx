// Aba "Acompanhar preços" da tela "Para a Nossa Casa".
// Produtos que estamos de olho (ex: máquina de lavar), com histórico de preço registrado à mão.
// Dados: Firebase → acompanharPrecos/{id} = { nome, criadoEm, acompanhamento: {...} }
import { Feather } from '@expo/vector-icons';
import { onValue, ref } from 'firebase/database';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';
import { formatarMoeda } from '../utils/formatadores';
import {
  Acompanhamento,
  alvoAtingido,
  dataCurta,
  ItemComparavel,
  lerAcompanhamento,
  PainelComparativo,
  PainelPreco,
  variacaoPreco,
} from './AcompanharPrecos';
import { PainelAlertas } from './AlertasPromo';
import AvoidTeclado from './AvoidTeclado';
import { COR } from './corLista';

// ───────────── seletor "Compras | Acompanhar preços" ─────────────
export function SegmentoAbas({ aba, aoMudar }: { aba: 'compras' | 'precos'; aoMudar: (a: 'compras' | 'precos') => void }) {
  return (
    <View style={styles.segmento}>
      <TouchableOpacity style={[styles.segBtn, aba === 'compras' && styles.segBtnAtivo]} onPress={() => aoMudar('compras')} activeOpacity={0.85}>
        <Feather name="shopping-cart" size={14} color={aba === 'compras' ? COR.grafite : COR.cinza} />
        <Text style={[styles.segTexto, aba === 'compras' && { color: COR.grafite }]}>Compras</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.segBtn, aba === 'precos' && styles.segBtnAtivoPreco]} onPress={() => aoMudar('precos')} activeOpacity={0.85}>
        <Feather name="trending-down" size={14} color={aba === 'precos' ? COR.grafite : COR.cinza} />
        <Text style={[styles.segTexto, aba === 'precos' && { color: COR.grafite }]}>Acompanhar preços</Text>
      </TouchableOpacity>
    </View>
  );
}

type Produto = { id: string; nome: string; acomp: Acompanhamento | null };

export default function AbaPrecos({ segmento }: { segmento: ReactNode }) {
  const [dados, setDados] = useState<any>({});
  const [aberto, setAberto] = useState<string | null>(null); // id do produto, 'novo' ou null
  const [comparando, setComparando] = useState(false);
  const [alertando, setAlertando] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, 'acompanharPrecos'), (snap) => setDados(snap.val() || {}));
    return () => unsub();
  }, []);

  const produtos: Produto[] = useMemo(() => {
    const lista: Produto[] = Object.keys(dados).map((id) => ({
      id,
      nome: String(dados[id]?.nome || 'Produto'),
      acomp: lerAcompanhamento(dados[id]?.acompanhamento),
    }));
    lista.sort((a, b) => a.nome.localeCompare(b.nome));
    return lista;
  }, [dados]);

  const comparaveis: ItemComparavel[] = useMemo(() => {
    const out: ItemComparavel[] = [];
    for (const p of produtos) {
      if (p.acomp) out.push({ id: p.id, nome: p.nome, listaNome: '', acomp: p.acomp });
    }
    return out;
  }, [produtos]);

  const produtoAberto = aberto && aberto !== 'novo' ? produtos.find((p) => p.id === aberto) || null : null;

  const abrirLink = (url: string) => {
    if (!url) return;
    Linking.openURL(/^https?:\/\//i.test(url) ? url : `https://${url}`).catch(() => {});
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        {segmento}

        <View style={styles.acoesTopo}>
          <TouchableOpacity style={styles.btnNovo} onPress={() => setAberto('novo')} activeOpacity={0.85}>
            <Feather name="plus" size={16} color={COR.grafite} style={{ marginRight: 6 }} />
            <Text style={styles.btnNovoTexto}>Novo produto</Text>
          </TouchableOpacity>
          {comparaveis.length > 1 && (
            <TouchableOpacity style={styles.btnComparar} onPress={() => setComparando(true)} activeOpacity={0.85}>
              <Feather name="columns" size={15} color={COR.verde} style={{ marginRight: 6 }} />
              <Text style={styles.btnCompararTexto}>Comparar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnAlerta} onPress={() => setAlertando(true)} activeOpacity={0.85}>
            <Feather name="bell" size={15} color={COR.vermelho} style={{ marginRight: 6 }} />
            <Text style={styles.btnAlertaTexto}>ALERTA</Text>
          </TouchableOpacity>
        </View>

        {produtos.length === 0 ? (
          <View style={styles.vazio}>
            <Feather name="trending-down" size={46} color={COR.borda} />
            <Text style={styles.vazioTitulo}>Nenhum produto sendo acompanhado</Text>
            <Text style={styles.vazioTexto}>
              Toque em "Novo produto" para registrar o preço de algo que vocês querem comprar e acompanhar quando ele baixar.
            </Text>
          </View>
        ) : (
          produtos.map((p) => {
            const a = p.acomp;
            const v = a ? variacaoPreco(a) : null;
            return (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => setAberto(p.id)} activeOpacity={0.85}>
                <View style={styles.cardTopo}>
                  <Text style={styles.cardNome} numberOfLines={2}>{p.nome}</Text>
                  <Feather name="chevron-right" size={18} color={COR.cinza} />
                </View>

                {a ? (
                  <>
                    <View style={styles.linhaPreco}>
                      <Text style={styles.preco}>{formatarMoeda(a.precoAvista)}</Text>
                      {v !== null && (
                        <View style={[styles.chip, { backgroundColor: v > 0 ? `${COR.vermelho}22` : v === 0 ? COR.borda : `${COR.verde}22` }]}>
                          <Text style={[styles.chipTexto, { color: v > 0 ? COR.vermelho : v === 0 ? COR.cinza : COR.verde }]}>
                            {v > 0 ? `↑ ${formatarMoeda(v)}` : v === 0 ? '= igual' : `↓ ${formatarMoeda(Math.abs(v))}`}
                          </Text>
                        </View>
                      )}
                      {alvoAtingido(a) && (
                        <View style={[styles.chip, { backgroundColor: `${COR.lima}22` }]}>
                          <Text style={[styles.chipTexto, { color: COR.lima }]}>🎯 alvo atingido</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.info} numberOfLines={1}>
                      {a.loja ? `${a.loja}  •  ` : ''}atualizado em {dataCurta(a.atualizadoEm)}
                    </Text>
                    {a.parcelas > 0 && a.totalParcelado > 0 && (
                      <Text style={styles.info}>
                        {a.parcelas}x de {formatarMoeda(a.valorParcela)} = {formatarMoeda(a.totalParcelado)}
                      </Text>
                    )}
                    {a.menorPreco > 0 && (
                      <Text style={styles.info}>
                        Menor preço já visto: <Text style={{ color: COR.verde, fontWeight: 'bold' }}>{formatarMoeda(a.menorPreco)}</Text>
                      </Text>
                    )}

                    <View style={styles.cardAcoes}>
                      <TouchableOpacity style={styles.btnAtualizar} onPress={() => setAberto(p.id)} activeOpacity={0.85}>
                        <Feather name="refresh-cw" size={13} color={COR.grafite} style={{ marginRight: 6 }} />
                        <Text style={styles.btnAtualizarTexto}>Ver / atualizar</Text>
                      </TouchableOpacity>
                      {!!a.link && (
                        <TouchableOpacity style={styles.btnLink} onPress={() => abrirLink(a.link)} activeOpacity={0.85}>
                          <Feather name="external-link" size={13} color={COR.lavanda} />
                          <Text style={styles.btnLinkTexto}>LINK</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                ) : (
                  <Text style={styles.info}>Sem preço registrado ainda.</Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {(aberto === 'novo' || !!produtoAberto || comparando || alertando) && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
          <AvoidTeclado>
            <View style={{ flex: 1 }}>
              {aberto === 'novo' && (
                <PainelPreco
                  key="novo"
                  caminhoItem={null}
                  colecaoNova="acompanharPrecos"
                  nomeItem=""
                  editarNome
                  removerTudo
                  acomp={null}
                  aoFechar={() => setAberto(null)}
                />
              )}
              {!!produtoAberto && (
                <PainelPreco
                  key={produtoAberto.id}
                  caminhoItem={`acompanharPrecos/${produtoAberto.id}`}
                  nomeItem={produtoAberto.nome}
                  editarNome
                  removerTudo
                  acomp={produtoAberto.acomp}
                  aoFechar={() => setAberto(null)}
                />
              )}
              {comparando && comparaveis.length > 1 && <PainelComparativo itens={comparaveis} aoFechar={() => setComparando(false)} />}
              {alertando && <PainelAlertas aoFechar={() => setAlertando(false)} />}
            </View>
          </AvoidTeclado>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingTop: Platform.OS === 'ios' ? 140 : 140, paddingBottom: 170, paddingHorizontal: 20 },
  segmento: { flexDirection: 'row', backgroundColor: COR.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: COR.borda, marginBottom: 14 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  segBtnAtivo: { backgroundColor: COR.lima },
  segBtnAtivoPreco: { backgroundColor: COR.lavanda },
  segTexto: { color: COR.cinza, fontSize: 12, fontWeight: 'bold' },

  acoesTopo: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btnNovo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COR.lima, paddingVertical: 13, borderRadius: 14 },
  btnNovoTexto: { color: COR.grafite, fontSize: 14, fontWeight: 'bold' },
  btnComparar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: `${COR.verde}66`, backgroundColor: `${COR.verde}12` },
  btnCompararTexto: { color: COR.verde, fontSize: 13, fontWeight: 'bold' },
  btnAlerta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: `${COR.vermelho}66`, backgroundColor: `${COR.vermelho}12` },
  btnAlertaTexto: { color: COR.vermelho, fontSize: 13, fontWeight: 'bold' },

  vazio: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  vazioTitulo: { color: COR.texto, fontSize: 15, fontWeight: 'bold', marginTop: 14 },
  vazioTexto: { color: COR.cinza, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  card: { backgroundColor: COR.card, borderRadius: 20, borderWidth: 1, borderColor: COR.borda, padding: 16, marginBottom: 12 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  cardNome: { flex: 1, color: COR.texto, fontSize: 15, fontWeight: 'bold' },
  linhaPreco: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  preco: { color: COR.texto, fontSize: 24, fontWeight: '900' },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  chipTexto: { fontSize: 11, fontWeight: 'bold' },
  info: { color: COR.cinza, fontSize: 12, marginTop: 3 },
  cardAcoes: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  btnAtualizar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COR.lima, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  btnAtualizarTexto: { color: COR.grafite, fontSize: 12, fontWeight: 'bold' },
  btnLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: `${COR.lavanda}55` },
  btnLinkTexto: { color: COR.lavanda, fontSize: 11, fontWeight: 'bold' },
});
