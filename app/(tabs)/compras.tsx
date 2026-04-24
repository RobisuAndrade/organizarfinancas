import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Linking, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, push, ref, remove, set, update } from 'firebase/database';
import { db } from '../../firebaseConfig';

const COMODOS = ['Cozinha', 'Quarto', 'Sala', 'Banheiro', 'Escritório', 'Varanda'];

// ----------------------------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------------------------
const converterParaNumero = (valorString: string) => {
  if (!valorString) return 0;
  const numeroLimpo = valorString.replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(numeroLimpo);
  return isNaN(numero) ? 0 : numero;
};

const formatarMoeda = (valor: number) => {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarData = (isoString?: string) => {
  if (!isoString) return '--/--/----';
  try {
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR');
  } catch {
    return '--/--/----';
  }
};

const formatarInputMoeda = (texto: string) => {
  let valorLimpo = texto.replace(/\D/g, ''); 
  if (!valorLimpo) return '';
  let valorNumero = (parseInt(valorLimpo, 10) / 100).toFixed(2);
  let valorFormatado = valorNumero.replace('.', ',');
  valorFormatado = valorFormatado.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  return valorFormatado;
};

export default function Compras() {
  const router = useRouter();
  
  const [lista, setLista] = useState<any[]>([]); 
  const [formAberto, setFormAberto] = useState(false);
  const [menuFiltroAberto, setMenuFiltroAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  
  const [itensExpandidos, setItensExpandidos] = useState<string[]>([]);

  const [nome, setNome] = useState('');
  const [link, setLink] = useState('');
  const [prioridade, setPrioridade] = useState(3);
  const [comodo, setComodo] = useState('Cozinha');
  const [valor, setValor] = useState(''); 
  const [valorPago, setValorPago] = useState(''); 

  const [filtroStatus, setFiltroStatus] = useState('Todos'); 
  const [filtroComodo, setFiltroComodo] = useState('Todos'); 
  const [filtroPrioridade, setFiltroPrioridade] = useState(0); 
  const [busca, setBusca] = useState(''); 

  useEffect(() => {
    const listaRef = ref(db, 'compras');
    const unsubscribe = onValue(listaRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const itens = Object.keys(dados).map(key => ({
          id: key,
          ...dados[key]
        }));
        setLista(itens);
      } else {
        setLista([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const listaFiltrada = lista.filter(item => {
    if (filtroStatus === 'Comprados' && !item.comprado) return false;
    if (filtroStatus === 'Pendentes' && item.comprado) return false;
    if (filtroComodo !== 'Todos' && item.comodo !== filtroComodo) return false;
    if (filtroPrioridade !== 0 && item.prioridade !== filtroPrioridade) return false;
    
    if (busca.trim() !== '') {
      const nomeItem = item.nome.toLowerCase();
      const textoBusca = busca.toLowerCase();
      if (!nomeItem.includes(textoBusca)) return false;
    }

    return true;
  }).sort((a, b) => (a.comprado === b.comprado) ? 0 : a.comprado ? 1 : -1);

  const totais = listaFiltrada.reduce((acc, item) => {
    const valorEstimado = converterParaNumero(item.valor);
    let valorGasto = 0;
    if (item.comprado) {
      valorGasto = converterParaNumero(item.valorPago || item.valor);
    }
    return {
      estimado: acc.estimado + valorEstimado,
      gasto: acc.gasto + valorGasto
    };
  }, { estimado: 0, gasto: 0 });

  const abrirEdicao = (item: any) => {
    setNome(item.nome);
    setValor(item.valor || '');
    setValorPago(item.valorPago || '');
    setLink(item.link || '');
    setPrioridade(item.prioridade);
    setComodo(item.comodo);
    setItemEditando(item.id); 
    setFormAberto(true);      
  };

  const fecharFormulario = () => {
    setNome(''); setLink(''); setValor(''); setValorPago(''); setPrioridade(3); setComodo('Cozinha');
    setItemEditando(null); 
    setFormAberto(false);
  };

  const salvarItem = async () => {
    if (nome.trim().length === 0) {
      alert("O nome do item é obrigatório!");
      return;
    }
    try {
      if (itemEditando) {
        const itemRef = ref(db, `compras/${itemEditando}`);
        await update(itemRef, {
          nome, link, prioridade, comodo, 
          valor: valor || '0,00',
          valorPago: valorPago || '' 
        });
      } else {
        const novoItem = {
          nome, link, prioridade, comodo, 
          valor: valor || '0,00', 
          valorPago: valorPago || '',
          comprado: false, 
          dataCriacao: new Date().toISOString()
        };
        const listaRef = ref(db, 'compras');
        await set(push(listaRef), novoItem);
      }
      fecharFormulario();
    } catch (error) {
      alert("Erro ao salvar o item.");
    }
  };

  const alternarComprado = async (id: string, estadoAtual: boolean) => {
    try {
      await update(ref(db, `compras/${id}`), { comprado: !estadoAtual });
    } catch (error) {
      alert("Erro ao atualizar o item.");
    }
  };

  const confirmarExclusao = async (id: string, nomeItem: string) => {
    if (Platform.OS === 'web') {
      const confirmou = window.confirm(`Tem certeza que deseja apagar "${nomeItem}" da lista?`);
      if (confirmou) await remove(ref(db, `compras/${id}`));
    } else {
      Alert.alert(
        "Excluir Item",
        `Tem certeza que deseja apagar "${nomeItem}" da lista?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Excluir", style: "destructive", onPress: async () => await remove(ref(db, `compras/${id}`)) }
        ]
      );
    }
  };

  const abrirLink = (url: string) => {
    if(url) Linking.openURL(url).catch(() => alert("Link inválido"));
  };

  const alternarDetalhes = (id: string) => {
    if (itensExpandidos.includes(id)) {
      setItensExpandidos(itensExpandidos.filter(itemId => itemId !== id));
    } else {
      setItensExpandidos([...itensExpandidos, id]);
    }
  };

  const limparFiltros = () => {
    setFiltroStatus('Todos'); 
    setFiltroComodo('Todos'); 
    setFiltroPrioridade(0);
    setBusca(''); 
  };

  const renderizarEstrelas = (qtd: number, interativo = false, onSelect?: (n: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} disabled={!interativo} onPress={() => interativo && onSelect && onSelect(star)}>
            <Feather name="star" size={interativo ? 28 : 14} color={star <= qtd ? "#FFD700" : "#444"} style={styles.starIcon} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* CABEÇALHO FIXO */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#B04FCF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.titulo}>Para a Nossa Casa</Text>
            <Text style={styles.subtitulo}>{listaFiltrada.length} itens encontrados</Text>
          </View>
        </View>

        {/* LISTA DE ITENS */}
        <View style={styles.listArea}>
          <FlatList 
            data={listaFiltrada}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
            
            ListHeaderComponent={
              <View style={{ paddingBottom: 10 }}>
                {/* BARRA DE PESQUISA */}
                <View style={styles.searchContainer}>
                  <Feather name="search" size={18} color="#AA319C" style={styles.searchIcon} />
                  <TextInput 
                    style={styles.searchInput}
                    placeholder="Pesquisar item..."
                    placeholderTextColor="#666"
                    value={busca}
                    onChangeText={setBusca}
                  />
                  {busca.length > 0 && (
                    <TouchableOpacity onPress={() => setBusca('')} style={styles.clearSearchButton}>
                      <Feather name="x" size={16} color="#888" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* BOTÕES DE AÇÃO */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.toggleFormButton} onPress={() => setFormAberto(true)}>
                    <Feather name="plus" size={20} color="#FFF" />
                    <Text style={styles.toggleFormText}>Novo Item</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.filterButton} onPress={() => setMenuFiltroAberto(true)}>
                    <Feather name="filter" size={20} color="#B04FCF" />
                    <Text style={styles.filterButtonText}>Filtros</Text>
                    {(filtroStatus !== 'Todos' || filtroComodo !== 'Todos' || filtroPrioridade !== 0) && (
                      <View style={styles.filterActiveDot} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            }

            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="search" size={50} color="#2D1436" />
                <Text style={styles.emptyStateText}>Nenhum item encontrado.</Text>
              </View>
            }

            renderItem={({ item }) => {
              const valorFinal = item.comprado && item.valorPago ? item.valorPago : (item.valor || '0,00');
              const isExpandido = itensExpandidos.includes(item.id);

              return (
                <View style={[styles.itemCard, item.comprado && styles.itemCardComprado]}>
                  <View style={styles.itemHeader}>
                    <TouchableOpacity style={[styles.checkbox, item.comprado && styles.checkboxMarcado]} onPress={() => alternarComprado(item.id, item.comprado)}>
                      {item.comprado && <Feather name="check" size={14} color="#FFF" />}
                    </TouchableOpacity>
                    
                    <View style={styles.itemTitleArea}>
                      <Text style={[styles.itemTexto, item.comprado && styles.itemTextoRiscado]}>{item.nome}</Text>
                      {renderizarEstrelas(item.prioridade)}

                      <TouchableOpacity style={styles.detalhesToggleMini} onPress={() => alternarDetalhes(item.id)}>
                        <Text style={styles.detalhesToggleMiniText}>{isExpandido ? "Ocultar detalhes" : "Ver detalhes"}</Text>
                        <Feather name={isExpandido ? "chevron-up" : "chevron-down"} size={12} color="#888" />
                      </TouchableOpacity>

                      {isExpandido && (
                        <View style={styles.detalhesBox}>
                          <Text style={styles.detalheData}>
                            <Feather name="calendar" size={10} color="#666" /> Adicionado em: {formatarData(item.dataCriacao)}
                          </Text>
                          <View style={styles.detalhesValoresRow}>
                            <Text style={styles.detalheTexto}>Estimado: <Text style={styles.detalheNumero}>R$ {item.valor || '0,00'}</Text></Text>
                            {item.valorPago ? (
                              <Text style={styles.detalheTextoDestaque}>Pago: <Text style={styles.detalheNumeroDestaque}>R$ {item.valorPago}</Text></Text>
                            ) : null}
                          </View>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.badgeComodo}>
                      <Text style={styles.badgeComodoText}>{item.comodo}</Text>
                    </View>
                  </View>

                  <View style={styles.itemFooter}>
                    <Text style={[styles.valorTextoFinal, item.comprado && { color: '#AA319C' }]}>
                      R$ {valorFinal}
                    </Text>
                    
                    <View style={styles.footerActions}>
                      {item.link ? (
                        <TouchableOpacity style={styles.linkButton} onPress={() => abrirLink(item.link)}>
                          <Feather name="external-link" size={14} color="#AA319C" />
                          <Text style={styles.linkButtonText}>LINK</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.noLinkText}>Sem link</Text>
                      )}

                      <TouchableOpacity style={styles.editButton} onPress={() => abrirEdicao(item)}>
                        <Feather name="edit-2" size={16} color="#B04FCF" />
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.deleteButton} onPress={() => confirmarExclusao(item.id, item.nome)}>
                        <Feather name="trash-2" size={16} color="#FF4D4D" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>

        {/* RODAPÉ DE TOTAIS FIXO */}
        <View style={styles.subtotalContainer}>
          <View style={styles.subtotalColumn}>
            <Text style={styles.subtotalLabel}>Total Estimado</Text>
            <Text style={styles.subtotalValueEstimado}>{formatarMoeda(totais.estimado)}</Text>
          </View>
          <View style={styles.subtotalDivider} />
          <View style={styles.subtotalColumn}>
            <Text style={styles.subtotalLabelGasto}>Gasto Real</Text>
            <Text style={styles.subtotalValueGasto}>{formatarMoeda(totais.gasto)}</Text>
          </View>
        </View>

      </View>

      {/* --- NOVO MODAL DE FORMULÁRIO (RESOLVE O PROBLEMA DO SCROLL) --- */}
      <Modal visible={formAberto} animationType="slide" transparent>
        <View style={styles.modalFullOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={styles.formModalContainer}>
              <View style={styles.formModalHeader}>
                <Text style={styles.formTitle}>{itemEditando ? "Editando Item" : "Novo Item"}</Text>
                <TouchableOpacity onPress={fecharFormulario} style={styles.closeModalButton}>
                  <Feather name="x" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                <Text style={styles.inputLabelMicro}>O que vamos comprar?</Text>
                <TextInput style={styles.input} placeholder="Nome do item" placeholderTextColor="#666" value={nome} onChangeText={setNome} />
                
                <View style={styles.rowInputs}>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabelMicro}>Estimado (R$)</Text>
                    <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#666" value={valor} onChangeText={(txt) => setValor(formatarInputMoeda(txt))} keyboardType="numeric" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabelMicro}>Pago (R$)</Text>
                    <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#666" value={valorPago} onChangeText={(txt) => setValorPago(formatarInputMoeda(txt))} keyboardType="numeric" />
                  </View>
                </View>

                <Text style={styles.inputLabelMicro}>Link da Loja (Opcional)</Text>
                <TextInput style={styles.input} placeholder="https://..." placeholderTextColor="#666" value={link} onChangeText={setLink} autoCapitalize="none" />
                
                <Text style={styles.label}>Prioridade (Urgência)</Text>
                {renderizarEstrelas(prioridade, true, setPrioridade)}
                
                <Text style={styles.label}>Para qual cômodo?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.comodosScroll}>
                  {COMODOS.map((c) => (
                    <TouchableOpacity key={c} style={[styles.comodoTag, comodo === c && styles.comodoTagActive]} onPress={() => setComodo(c)}>
                      <Text style={[styles.comodoTagText, comodo === c && styles.comodoTagTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity style={styles.submitButton} onPress={salvarItem}>
                  <Text style={styles.submitButtonText}>{itemEditando ? "Atualizar Item" : "Salvar Item"}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL DE FILTROS */}
      <Modal visible={menuFiltroAberto} animationType="fade" transparent={true} onRequestClose={() => setMenuFiltroAberto(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBgClick} onPress={() => setMenuFiltroAberto(false)} activeOpacity={1} />
          <View style={styles.sideMenu}>
            <View style={styles.sideMenuHeader}>
              <Text style={styles.sideMenuTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setMenuFiltroAberto(false)}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.filterLabel}>Status da Compra</Text>
              <View style={styles.filterChipsContainer}>
                {['Todos', 'Pendentes', 'Comprados'].map(status => (
                  <TouchableOpacity key={status} style={[styles.filterChip, filtroStatus === status && styles.filterChipActive]} onPress={() => setFiltroStatus(status)}>
                    <Text style={[styles.filterChipText, filtroStatus === status && styles.filterChipTextActive]}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.filterDivider} />
              <Text style={styles.filterLabel}>Prioridade</Text>
              <View style={styles.filterChipsContainer}>
                <TouchableOpacity style={[styles.filterChip, filtroPrioridade === 0 && styles.filterChipActive]} onPress={() => setFiltroPrioridade(0)}>
                  <Text style={[styles.filterChipText, filtroPrioridade === 0 && styles.filterChipTextActive]}>Todas</Text>
                </TouchableOpacity>
                {[1, 2, 3, 4, 5].map(prio => (
                  <TouchableOpacity key={prio} style={[styles.filterChip, filtroPrioridade === prio && styles.filterChipActive]} onPress={() => setFiltroPrioridade(prio)}>
                    <Text style={[styles.filterChipText, filtroPrioridade === prio && styles.filterChipTextActive]}>{prio} ⭐</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.filterDivider} />
              <Text style={styles.filterLabel}>Cômodo</Text>
              <View style={styles.filterChipsContainer}>
                <TouchableOpacity style={[styles.filterChip, filtroComodo === 'Todos' && styles.filterChipActive]} onPress={() => setFiltroComodo('Todos')}>
                  <Text style={[styles.filterChipText, filtroComodo === 'Todos' && styles.filterChipTextActive]}>Todos</Text>
                </TouchableOpacity>
                {COMODOS.map(c => (
                  <TouchableOpacity key={c} style={[styles.filterChip, filtroComodo === c && styles.filterChipActive]} onPress={() => setFiltroComodo(c)}>
                    <Text style={[styles.filterChipText, filtroComodo === c && styles.filterChipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.sideMenuFooter}>
              <TouchableOpacity style={styles.clearFilterButton} onPress={limparFiltros}>
                <Text style={styles.clearFilterText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyFilterButton} onPress={() => setMenuFiltroAberto(false)}>
                <Text style={styles.applyFilterText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  container: { flex: 1, padding: 20, paddingTop: 40, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitulo: { fontSize: 12, color: '#888', marginTop: 2 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E0A24', borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  clearSearchButton: { padding: 5 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  toggleFormButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#AA319C', padding: 15, borderRadius: 12, justifyContent: 'center', marginRight: 10 },
  toggleFormText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },
  filterButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E0A24', paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#B04FCF', justifyContent: 'center', position: 'relative' },
  filterButtonText: { color: '#B04FCF', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },
  filterActiveDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3366' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyStateText: { color: '#666', fontSize: 16, marginTop: 15 },
  listArea: { flex: 1 },

  // Estilos do Modal de Formulário
  modalFullOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  formModalContainer: { backgroundColor: '#1E0A24', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: '#2D1436' },
  formModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  closeModalButton: { padding: 8, backgroundColor: '#0F0414', borderRadius: 10 },

  subtotalContainer: { backgroundColor: '#1E0A24', padding: 15, borderRadius: 16, marginTop: 15, borderWidth: 1, borderColor: '#2D1436', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  subtotalColumn: { alignItems: 'center', flex: 1 },
  subtotalDivider: { width: 1, backgroundColor: '#2D1436', height: '80%' },
  subtotalLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  subtotalValueEstimado: { color: '#CCC', fontSize: 18, fontWeight: 'bold' },
  subtotalLabelGasto: { color: '#B04FCF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  subtotalValueGasto: { color: '#B04FCF', fontSize: 20, fontWeight: '900' },

  modalOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalBgClick: { flex: 1 },
  sideMenu: { width: '80%', maxWidth: 350, backgroundColor: '#120518', height: '100%', padding: 20, borderLeftWidth: 1, borderColor: '#2D1436', shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20 },
  sideMenuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 20 },
  sideMenuTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  filterLabel: { color: '#AA319C', fontWeight: 'bold', fontSize: 14, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  filterChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterChip: { backgroundColor: '#1E0A24', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#2D1436' },
  filterChipActive: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  filterChipText: { color: '#888', fontWeight: '600', fontSize: 13 },
  filterChipTextActive: { color: '#FFF' },
  filterDivider: { height: 1, backgroundColor: '#2D1436', marginVertical: 25 },
  sideMenuFooter: { flexDirection: 'row', gap: 10, marginTop: 20, paddingBottom: 20 },
  clearFilterButton: { flex: 1, backgroundColor: '#1E0A24', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2D1436' },
  clearFilterText: { color: '#888', fontWeight: 'bold' },
  applyFilterButton: { flex: 1, backgroundColor: '#AA319C', padding: 15, borderRadius: 12, alignItems: 'center' },
  applyFilterText: { color: '#FFF', fontWeight: 'bold' },

  formTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 20 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  inputWrapper: { width: '48%' },
  inputLabelMicro: { color: '#888', fontSize: 11, marginBottom: 6, marginLeft: 4, textTransform: 'uppercase', fontWeight: 'bold' },
  input: { height: 50, backgroundColor: '#0F0414', borderRadius: 12, paddingHorizontal: 15, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2D1436', marginBottom: 15 },
  label: { color: '#B04FCF', fontWeight: 'bold', fontSize: 14, marginBottom: 10, marginTop: 5 },
  starsContainer: { flexDirection: 'row', marginBottom: 4 }, 
  starIcon: { marginRight: 5 },
  comodosScroll: { flexDirection: 'row', marginBottom: 25 },
  comodoTag: { backgroundColor: '#0F0414', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#2D1436', marginRight: 10, height: 38 },
  comodoTagActive: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  comodoTagText: { color: '#888', fontWeight: '600', fontSize: 14 },
  comodoTagTextActive: { color: '#FFF' },
  submitButton: { backgroundColor: '#B04FCF', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  
  itemCard: { backgroundColor: '#1E0A24', padding: 18, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436' },
  itemCardComprado: { opacity: 0.7 }, 
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#B04FCF', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  checkboxMarcado: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  itemTitleArea: { flex: 1, paddingRight: 10 },
  itemTexto: { fontSize: 18, color: '#FFF', fontWeight: 'bold', marginBottom: 4 },
  itemTextoRiscado: { textDecorationLine: 'line-through', color: '#888' },
  
  detalhesToggleMini: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 4 },
  detalhesToggleMiniText: { fontSize: 12, color: '#888', marginRight: 4, fontWeight: '600' },
  detalhesBox: { backgroundColor: '#0F0414', padding: 10, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: '#2D1436' },
  detalheData: { color: '#666', fontSize: 10, marginBottom: 6, textTransform: 'uppercase', fontWeight: '600' },
  detalhesValoresRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detalheTexto: { color: '#888', fontSize: 11, fontWeight: '500' },
  detalheNumero: { color: '#CCC', fontWeight: 'bold' },
  detalheTextoDestaque: { color: '#AA319C', fontSize: 11, fontWeight: 'bold' },
  detalheNumeroDestaque: { color: '#B04FCF', fontWeight: '900' },
  badgeComodo: { backgroundColor: '#2D1436', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  badgeComodoText: { color: '#B04FCF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2D1436' },
  valorTextoFinal: { fontSize: 16, color: '#FFF', fontWeight: 'bold', marginRight: 10 },
  
  footerActions: { flexDirection: 'row', alignItems: 'center' },
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#AA319C20', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#AA319C', marginRight: 10 },
  linkButtonText: { color: '#AA319C', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  noLinkText: { color: '#444', fontSize: 12, fontStyle: 'italic', marginRight: 10 },
  editButton: { padding: 8, backgroundColor: '#AA319C15', borderRadius: 8, borderWidth: 1, borderColor: '#AA319C30', marginRight: 10 },
  deleteButton: { padding: 8, backgroundColor: '#FF4D4D15', borderRadius: 8, borderWidth: 1, borderColor: '#FF4D4D30' }
});