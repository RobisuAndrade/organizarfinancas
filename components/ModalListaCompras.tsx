import { Feather } from '@expo/vector-icons';
import { onValue, push, ref, remove, set, update } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';
import { DialogoNoModal, useDialogo } from '../hooks/useDialogo';
import { chaveProduto, normalizar } from '../utils/categoriasMercado';
import { formatarMoeda } from '../utils/formatadores';

type ItemLista = {
  id: string;
  nome: string;
  qtd: string;
  comprado: boolean;
};

type Lista = {
  id: string;
  nome: string;
  criadoEm: string;
  itens: ItemLista[];
};

type HistoricoPreco = {
  chave: string;
  nome: string;
  menorPreco: number;
  mercado: string;
};

export default function ModalListaCompras({ visivel, fechar }: { visivel: boolean; fechar: () => void }) {
  const { confirmar } = useDialogo();
  const [listas, setListas] = useState<any>({});
  const [notas, setNotas] = useState<any>({});
  const [listaAtualId, setListaAtualId] = useState<string | null>(null);
  const [nomeItem, setNomeItem] = useState('');
  const [qtdItem, setQtdItem] = useState('1');

  useEffect(() => {
    const unsubListas = onValue(ref(db, 'listasCompras'), (snap) => setListas(snap.val() || {}));
    const unsubNotas = onValue(ref(db, 'mercado/notas'), (snap) => setNotas(snap.val() || {}));
    return () => {
      unsubListas();
      unsubNotas();
    };
  }, []);

  // Histórico de menor preço já pago, por produto (olhando todas as notas registradas)
  const historico: HistoricoPreco[] = useMemo(() => {
    const grupos: { [chave: string]: { nome: string; valorUnitario: number; mercado: string }[] } = {};
    Object.keys(notas).forEach((notaId: string) => {
      const nota = notas[notaId];
      const itens = nota?.itens || {};
      Object.keys(itens).forEach((idx: string) => {
        const it = itens[idx];
        if (!it || !it.nome) return;
        const chave = chaveProduto(it.nome);
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push({
          nome: it.nome,
          valorUnitario: Number(it.valorUnitario) || 0,
          mercado: nota.mercado || 'Mercado',
        });
      });
    });
    return Object.keys(grupos).map((chave) => {
      const lista = grupos[chave];
      const comPreco = lista.filter((i) => i.valorUnitario > 0);
      const menor = comPreco.length ? comPreco.reduce((a, b) => (b.valorUnitario < a.valorUnitario ? b : a)) : lista[0];
      return { chave, nome: menor.nome, menorPreco: menor.valorUnitario, mercado: menor.mercado };
    });
  }, [notas]);

  const buscarMenorPreco = (nomeProduto: string): HistoricoPreco | null => {
    if (!nomeProduto.trim()) return null;
    const chaveExata = chaveProduto(nomeProduto);
    const exato = historico.find((h) => h.chave === chaveExata);
    if (exato) return exato;
    // Se não achou igual, procura algo parecido (contém o texto digitado)
    const termo = normalizar(nomeProduto);
    if (termo.length < 3) return null;
    const parecido = historico.filter((h) => normalizar(h.nome).includes(termo));
    if (!parecido.length) return null;
    return parecido.reduce((a, b) => (b.menorPreco > 0 && b.menorPreco < a.menorPreco ? b : a));
  };

  const listasArray: Lista[] = useMemo(() => {
    return Object.keys(listas)
      .map((id: string): Lista => {
        const l = listas[id];
        const itensObj = l?.itens || {};
        const itens: ItemLista[] = Object.keys(itensObj).map((itemId) => ({
          id: itemId,
          nome: itensObj[itemId]?.nome || '',
          qtd: itensObj[itemId]?.qtd || '1',
          comprado: !!itensObj[itemId]?.comprado,
        }));
        return { id, nome: l?.nome || 'Lista de Compras', criadoEm: l?.criadoEm || '', itens };
      })
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  }, [listas]);

  const listaAtual = listasArray.find((l) => l.id === listaAtualId) || null;

  const criarLista = async () => {
    const novaRef = push(ref(db, 'listasCompras'));
    const agora = new Date();
    await set(novaRef, {
      nome: `Lista ${agora.toLocaleDateString('pt-BR')}`,
      criadoEm: agora.toISOString(),
      itens: {},
    });
    setListaAtualId(novaRef.key);
  };

  const renomearLista = async (novoNome: string) => {
    if (!listaAtualId) return;
    await update(ref(db, `listasCompras/${listaAtualId}`), { nome: novoNome || 'Lista de Compras' });
  };

  const excluirLista = async (id: string, nome: string) => {
    const ok = await confirmar({
      titulo: 'Excluir lista',
      mensagem: `Apagar "${nome}" e todos os itens dela?`,
      perigo: true,
    });
    if (!ok) return;
    await remove(ref(db, `listasCompras/${id}`));
    if (listaAtualId === id) setListaAtualId(null);
  };

  const adicionarItem = async () => {
    if (!listaAtualId || !nomeItem.trim()) return;
    const novoItemRef = push(ref(db, `listasCompras/${listaAtualId}/itens`));
    await set(novoItemRef, {
      nome: nomeItem.trim(),
      qtd: qtdItem.trim() || '1',
      comprado: false,
    });
    setNomeItem('');
    setQtdItem('1');
  };

  const alternarComprado = async (itemId: string, comprado: boolean) => {
    if (!listaAtualId) return;
    await update(ref(db, `listasCompras/${listaAtualId}/itens/${itemId}`), { comprado: !comprado });
  };

  const excluirItem = async (itemId: string) => {
    if (!listaAtualId) return;
    await remove(ref(db, `listasCompras/${listaAtualId}/itens/${itemId}`));
  };

  const fecharTudo = () => {
    setListaAtualId(null);
    setNomeItem('');
    setQtdItem('1');
    fechar();
  };

  const dicaPreco = buscarMenorPreco(nomeItem);

  return (
    <Modal visible={visivel} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {!listaAtual ? (
            <>
              <View style={styles.header}>
                <Text style={styles.titulo}>Listas de Compras</Text>
                <TouchableOpacity onPress={fecharTudo} style={styles.closeBtn}>
                  <Feather name="x" size={20} color="#F4F5F7" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.botaoNovaLista} onPress={criarLista}>
                <Feather name="plus" size={18} color="#0B0B0F" style={{ marginRight: 8 }} />
                <Text style={[styles.textoBotao, { color: '#0B0B0F' }]}>Nova lista</Text>
              </TouchableOpacity>

              <ScrollView style={{ flex: 1, marginTop: 15 }} showsVerticalScrollIndicator={false}>
                {listasArray.length === 0 ? (
                  <View style={styles.vazio}>
                    <Feather name="clipboard" size={46} color="#2A2B34" />
                    <Text style={styles.vazioTexto}>Nenhuma lista ainda.{'\n'}Crie uma pra organizar a próxima compra.</Text>
                  </View>
                ) : (
                  listasArray.map((l) => {
                    const feitos = l.itens.filter((i) => i.comprado).length;
                    return (
                      <TouchableOpacity
                        key={l.id}
                        style={styles.cardLista}
                        activeOpacity={0.8}
                        onPress={() => setListaAtualId(l.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardListaNome} numberOfLines={1}>{l.nome}</Text>
                          <Text style={styles.cardListaInfo}>
                            {l.itens.length} {l.itens.length === 1 ? 'item' : 'itens'}
                            {l.itens.length > 0 ? ` • ${feitos} marcado${feitos === 1 ? '' : 's'}` : ''}
                            {l.criadoEm ? ` • ${new Date(l.criadoEm).toLocaleDateString('pt-BR')}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => excluirLista(l.id, l.nome)} style={styles.btnLixo}>
                          <Feather name="trash-2" size={16} color="#FF3B5C" />
                        </TouchableOpacity>
                        <Feather name="chevron-right" size={18} color="#8A8D98" />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setListaAtualId(null)} style={styles.closeBtn}>
                  <Feather name="arrow-left" size={20} color="#F4F5F7" />
                </TouchableOpacity>
                <TextInput
                  style={styles.inputNomeLista}
                  value={listaAtual.nome}
                  onChangeText={(t) => renomearLista(t)}
                  placeholder="Nome da lista"
                  placeholderTextColor="#8A8D98"
                />
                <TouchableOpacity onPress={fecharTudo} style={styles.closeBtn}>
                  <Feather name="x" size={20} color="#F4F5F7" />
                </TouchableOpacity>
              </View>

              <View style={styles.linhaAdicionar}>
                <TextInput
                  style={styles.inputProduto}
                  placeholder="Produto (ex: Arroz 5kg)"
                  placeholderTextColor="#8A8D98"
                  value={nomeItem}
                  onChangeText={setNomeItem}
                  onSubmitEditing={adicionarItem}
                />
                <TextInput
                  style={styles.inputQtd}
                  placeholder="Qtd"
                  placeholderTextColor="#8A8D98"
                  value={qtdItem}
                  onChangeText={setQtdItem}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.btnAdicionar} onPress={adicionarItem} disabled={!nomeItem.trim()}>
                  <Feather name="plus" size={20} color="#0B0B0F" />
                </TouchableOpacity>
              </View>

              {!!dicaPreco && (
                <View style={styles.dicaPrecoBox}>
                  <Feather name="tag" size={12} color="#00E676" />
                  <Text style={styles.dicaPrecoTexto} numberOfLines={1}>
                    Mais barato já pago: <Text style={{ fontWeight: '900' }}>{formatarMoeda(dicaPreco.menorPreco)}</Text> em {dicaPreco.mercado}
                  </Text>
                </View>
              )}

              <ScrollView style={{ flex: 1, marginTop: 12 }} showsVerticalScrollIndicator={false}>
                {listaAtual.itens.length === 0 ? (
                  <View style={styles.vazio}>
                    <Feather name="shopping-bag" size={40} color="#2A2B34" />
                    <Text style={styles.vazioTexto}>Adicione os produtos que precisam comprar.</Text>
                  </View>
                ) : (
                  listaAtual.itens.map((it) => {
                    const preco = buscarMenorPreco(it.nome);
                    return (
                      <View key={it.id} style={styles.itemRow}>
                        <TouchableOpacity onPress={() => alternarComprado(it.id, it.comprado)} style={styles.checkbox}>
                          {it.comprado && <Feather name="check" size={14} color="#0B0B0F" />}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.itemNome, it.comprado && { textDecorationLine: 'line-through', color: '#8A8D98' }]}
                            numberOfLines={1}
                          >
                            {it.nome}
                          </Text>
                          <Text style={styles.itemQtd}>Qtd: {it.qtd}</Text>
                          {!!preco && !it.comprado && (
                            <Text style={styles.itemPreco} numberOfLines={1}>
                              Menor preço: {formatarMoeda(preco.menorPreco)} ({preco.mercado})
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => excluirItem(it.id)} style={styles.btnLixo}>
                          <Feather name="trash-2" size={16} color="#FF3B5C" />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </View>
      <DialogoNoModal />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  container: { flex: 1, backgroundColor: '#1C1D25', marginTop: 50, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 20, borderWidth: 1, borderColor: '#2A2B34' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, gap: 10 },
  titulo: { color: '#F4F5F7', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  closeBtn: { backgroundColor: '#0B0B0F', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34' },

  botaoNovaLista: { flexDirection: 'row', backgroundColor: '#D4FF3A', padding: 15, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  textoBotao: { color: '#F4F5F7', fontSize: 15, fontWeight: 'bold' },

  vazio: { alignItems: 'center', paddingVertical: 40 },
  vazioTexto: { color: '#8A8D98', fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 20 },

  cardLista: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2B34', borderRadius: 16, padding: 14, marginBottom: 10, gap: 10 },
  cardListaNome: { color: '#F4F5F7', fontSize: 14, fontWeight: 'bold' },
  cardListaInfo: { color: '#8A8D98', fontSize: 11, marginTop: 3 },
  btnLixo: { padding: 6 },

  inputNomeLista: { flex: 1, color: '#F4F5F7', fontSize: 15, fontWeight: 'bold', backgroundColor: '#0B0B0F', borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34', paddingHorizontal: 12, paddingVertical: 8 },

  linhaAdicionar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  inputProduto: { flex: 1, backgroundColor: '#0B0B0F', borderRadius: 14, borderWidth: 1, borderColor: '#2A2B34', paddingHorizontal: 14, paddingVertical: 12, color: '#F4F5F7', fontSize: 14 },
  inputQtd: { width: 55, backgroundColor: '#0B0B0F', borderRadius: 14, borderWidth: 1, borderColor: '#2A2B34', paddingHorizontal: 10, paddingVertical: 12, color: '#F4F5F7', fontSize: 14, textAlign: 'center' },
  btnAdicionar: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#D4FF3A', justifyContent: 'center', alignItems: 'center' },

  dicaPrecoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00E67615', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  dicaPrecoTexto: { color: '#8A8D98', fontSize: 11, flex: 1 },

  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2B34', borderRadius: 14, padding: 12, marginBottom: 8, gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#D4FF3A', justifyContent: 'center', alignItems: 'center' },
  itemNome: { color: '#F4F5F7', fontSize: 14, fontWeight: 'bold' },
  itemQtd: { color: '#8A8D98', fontSize: 11, marginTop: 2 },
  itemPreco: { color: '#00E676', fontSize: 11, marginTop: 2, fontWeight: 'bold' },
});
