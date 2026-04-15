import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';


// Importações do Firebase (Adicionado o 'remove')
import { onValue, push, ref, remove, set, update } from 'firebase/database';
import { db } from '../../firebaseConfig';

const COMODOS = ['Cozinha', 'Quarto', 'Sala', 'Banheiro', 'Escritório', 'Varanda'];

export default function Compras() {
  const router = useRouter();
  
  // Estados Principais
  const [lista, setLista] = useState<any[]>([]); 
  const [formAberto, setFormAberto] = useState(false);
  const [menuFiltroAberto, setMenuFiltroAberto] = useState(false);

  // Estados do Formulário de Adição
  const [nome, setNome] = useState('');
  const [link, setLink] = useState('');
  const [prioridade, setPrioridade] = useState(3);
  const [comodo, setComodo] = useState('Cozinha');
  const [valor, setValor] = useState('');

  // Estados dos FILTROS
  const [filtroStatus, setFiltroStatus] = useState('Todos'); 
  const [filtroComodo, setFiltroComodo] = useState('Todos'); 
  const [filtroPrioridade, setFiltroPrioridade] = useState(0); 

  // 1. Carregar dados do Firebase
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

  // 2. Lógica de Filtragem da Lista
  const listaFiltrada = lista.filter(item => {
    if (filtroStatus === 'Comprados' && !item.comprado) return false;
    if (filtroStatus === 'Pendentes' && item.comprado) return false;
    if (filtroComodo !== 'Todos' && item.comodo !== filtroComodo) return false;
    if (filtroPrioridade !== 0 && item.prioridade !== filtroPrioridade) return false;
    return true;
  }).sort((a, b) => (a.comprado === b.comprado) ? 0 : a.comprado ? 1 : -1);

  // 3. Funções de Ação (Firebase)
  const adicionarItem = async () => {
    if (nome.trim().length === 0) {
      alert("O nome do item é obrigatório!");
      return;
    }
    const novoItem = {
      nome, link, prioridade, comodo, 
      valor: valor || '0,00', comprado: false, dataCriacao: new Date().toISOString()
    };
    try {
      const listaRef = ref(db, 'compras');
      await set(push(listaRef), novoItem);
      setNome(''); setLink(''); setValor(''); setPrioridade(3); setComodo('Cozinha');
      setFormAberto(false);
    } catch (error) {
      alert("Erro ao salvar o item no Firebase.");
    }
  };

  const alternarComprado = async (id: string, estadoAtual: boolean) => {
    try {
      await update(ref(db, `compras/${id}`), { comprado: !estadoAtual });
    } catch (error) {
      alert("Erro ao atualizar o item.");
    }
  };

  // --- NOVA LÓGICA DE EXCLUSÃO COM CONFIRMAÇÃO ---
 const confirmarExclusao = async (id: string, nomeItem: string) => {
    if (Platform.OS === 'web') {
      // Se estiver rodando no navegador (PC)
      const confirmou = window.confirm(`Tem certeza que deseja apagar "${nomeItem}" da lista?`);
      if (confirmou) {
        try {
          await remove(ref(db, `compras/${id}`));
        } catch (error) {
          alert("Erro ao apagar o item.");
        }
      }
    } else {
      // Se estiver rodando no Celular
      Alert.alert(
        "Excluir Item",
        `Tem certeza que deseja apagar "${nomeItem}" da lista?`,
        [
          { text: "Cancelar", style: "cancel" },
          { 
            text: "Excluir", 
            style: "destructive", 
            onPress: async () => {
              try {
                await remove(ref(db, `compras/${id}`));
              } catch (error) {
                alert("Erro ao apagar o item.");
              }
            } 
          }
        ]
      );
    }
  };

  const abrirLink = (url: string) => {
    if(url) Linking.openURL(url).catch(() => alert("Link inválido"));
  };

  const limparFiltros = () => {
    setFiltroStatus('Todos');
    setFiltroComodo('Todos');
    setFiltroPrioridade(0);
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
        
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#B04FCF" />
          </TouchableOpacity>
          <Text style={styles.titulo}>Para a Nossa Casa</Text>
        </View>

        {/* BOTÕES DE AÇÃO */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.toggleFormButton} onPress={() => setFormAberto(!formAberto)}>
            <Feather name={formAberto ? "x" : "plus"} size={20} color="#FFF" />
            <Text style={styles.toggleFormText}>{formAberto ? "Cancelar" : "Novo Item"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton} onPress={() => setMenuFiltroAberto(true)}>
            <Feather name="filter" size={20} color="#B04FCF" />
            <Text style={styles.filterButtonText}>Filtros</Text>
            {(filtroStatus !== 'Todos' || filtroComodo !== 'Todos' || filtroPrioridade !== 0) && (
              <View style={styles.filterActiveDot} />
            )}
          </TouchableOpacity>
        </View>

        {/* FORMULÁRIO */}
        {formAberto && (
          <View style={styles.formContainer}>
            <TextInput style={styles.input} placeholder="Nome do item" placeholderTextColor="#666" value={nome} onChangeText={setNome} />
            <TextInput style={styles.input} placeholder="Valor Estimado (Ex: 150,00)" placeholderTextColor="#666" value={valor} onChangeText={setValor} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Link do Produto (Opcional)" placeholderTextColor="#666" value={link} onChangeText={setLink} autoCapitalize="none" />
            
            <Text style={styles.label}>Prioridade (1 a 5 estrelas)</Text>
            {renderizarEstrelas(prioridade, true, setPrioridade)}
            
            <Text style={styles.label}>Cômodo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.comodosScroll}>
              {COMODOS.map((c) => (
                <TouchableOpacity key={c} style={[styles.comodoTag, comodo === c && styles.comodoTagActive]} onPress={() => setComodo(c)}>
                  <Text style={[styles.comodoTagText, comodo === c && styles.comodoTagTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.submitButton} onPress={adicionarItem}>
              <Text style={styles.submitButtonText}>Salvar Item</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LISTA DE ITENS */}
        {listaFiltrada.length === 0 && !formAberto ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={50} color="#2D1436" />
            <Text style={styles.emptyStateText}>Nenhum item encontrado.</Text>
          </View>
        ) : (
          <FlatList 
            data={listaFiltrada}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 50 }}
            renderItem={({ item }) => (
              <View style={[styles.itemCard, item.comprado && styles.itemCardComprado]}>
                
                <View style={styles.itemHeader}>
                  <TouchableOpacity style={[styles.checkbox, item.comprado && styles.checkboxMarcado]} onPress={() => alternarComprado(item.id, item.comprado)}>
                    {item.comprado && <Feather name="check" size={14} color="#FFF" />}
                  </TouchableOpacity>
                  
                  <View style={styles.itemTitleArea}>
                    <Text style={[styles.itemTexto, item.comprado && styles.itemTextoRiscado]}>{item.nome}</Text>
                    {renderizarEstrelas(item.prioridade)}
                  </View>
                  
                  <View style={styles.badgeComodo}>
                    <Text style={styles.badgeComodoText}>{item.comodo}</Text>
                  </View>
                </View>

                {/* RODAPÉ DO ITEM: VALOR + AÇÕES */}
                <View style={styles.itemFooter}>
                  <Text style={styles.valorTexto}>R$ {item.valor}</Text>
                  
                  {/* Agrupando os botões na direita */}
                  <View style={styles.footerActions}>
                    {item.link ? (
                      <TouchableOpacity style={styles.linkButton} onPress={() => abrirLink(item.link)}>
                        <Feather name="external-link" size={14} color="#AA319C" />
                        <Text style={styles.linkButtonText}>LINK</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.noLinkText}>Sem link</Text>
                    )}

                    {/* BOTÃO DE EXCLUIR */}
                    <TouchableOpacity 
                      style={styles.deleteButton} 
                      onPress={() => confirmarExclusao(item.id, item.nome)}
                    >
                      <Feather name="trash-2" size={16} color="#FF4D4D" />
                    </TouchableOpacity>
                  </View>
                </View>

              </View>
            )}
          />
        )}
      </View>

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
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  toggleFormButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#AA319C', padding: 15, borderRadius: 12, justifyContent: 'center', marginRight: 10 },
  toggleFormText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },
  
  filterButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E0A24', paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#B04FCF', justifyContent: 'center', position: 'relative' },
  filterButtonText: { color: '#B04FCF', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },
  filterActiveDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3366' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyStateText: { color: '#666', fontSize: 16, marginTop: 15 },

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

  formContainer: { backgroundColor: '#1E0A24', padding: 20, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#2D1436' },
  input: { height: 50, backgroundColor: '#0F0414', borderRadius: 12, paddingHorizontal: 15, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2D1436', marginBottom: 15 },
  label: { color: '#B04FCF', fontWeight: 'bold', fontSize: 14, marginBottom: 10, marginTop: 5 },
  starsContainer: { flexDirection: 'row', marginBottom: 15 },
  starIcon: { marginRight: 5 },
  comodosScroll: { flexDirection: 'row', marginBottom: 25 },
  comodoTag: { backgroundColor: '#0F0414', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#2D1436', marginRight: 10, height: 38 },
  comodoTagActive: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  comodoTagText: { color: '#888', fontWeight: '600', fontSize: 14 },
  comodoTagTextActive: { color: '#FFF' },
  submitButton: { backgroundColor: '#B04FCF', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  itemCard: { backgroundColor: '#1E0A24', padding: 18, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436' },
  itemCardComprado: { opacity: 0.5 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#B04FCF', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  checkboxMarcado: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  itemTitleArea: { flex: 1 },
  itemTexto: { fontSize: 18, color: '#FFF', fontWeight: 'bold', marginBottom: 4 },
  itemTextoRiscado: { textDecorationLine: 'line-through', color: '#666' },
  badgeComodo: { backgroundColor: '#2D1436', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  badgeComodoText: { color: '#B04FCF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2D1436' },
  valorTexto: { fontSize: 16, color: '#FFF', fontWeight: 'bold' },
  
  // NOVOS ESTILOS PARA OS BOTÕES DO RODAPÉ (LINK E LIXEIRA)
  footerActions: { flexDirection: 'row', alignItems: 'center' },
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#AA319C20', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#AA319C', marginRight: 10 },
  linkButtonText: { color: '#AA319C', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  noLinkText: { color: '#444', fontSize: 12, fontStyle: 'italic', marginRight: 10 },
  deleteButton: { padding: 8, backgroundColor: '#FF4D4D15', borderRadius: 8, borderWidth: 1, borderColor: '#FF4D4D30' }
});