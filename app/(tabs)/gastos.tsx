import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, push, ref, remove, set, update } from 'firebase/database';
import { db } from '../../firebaseConfig';

// ----------------------------------------------------
// LISTAS DE OPÇÕES E CORES
// ----------------------------------------------------
const CATEGORIAS = [
  'MERCADO', 'LAZER', 'AGUA', 'GÁS', 'ENERGIA', 'CONDOMINIO', 'SAUDE', 'FARMACIA', 
  'TELEFONE', 'INTERNET', 'MORADIA', 'CARRO', 'MOTO', 'TRANSPORTE', 'SEGUROS', 
  'FINANCIAMENTO', 'COTA', 'VESTUARIO', 'OUTROS', 'ASSINATURA', 'CURSOS', 
  'CUIDADOS PESSOAIS', 'DELIVERY', 'RESTAURANTE', 'VIAJENS', 'IMPOSTO', 
  'PADARIA', 'COMPRAS DA NET', 'EMPRESTIMO'
]; 

const METODOS_PAGAMENTO = ['NUBANK', 'INTER', 'BRADESCO', 'BOLETO', 'PIX', 'DINHEIRO', 'DEBITO'];

const CORES_BANCOS: { [key: string]: string } = {
  'NUBANK': '#8A05BE',
  'INTER': '#FF7A00',
  'BRADESCO': '#CC092F',
  'BOLETO': '#888888',
  'PIX': '#32BCAD',
  'DINHEIRO': '#00E676',
  'DEBITO': '#555555'
};

const RESPONSAVEIS = ['Robinho', 'Vanessinha'];

// Cor padrão para as categorias e parcelas
const COR_PADRAO_TAGS = '#B04FCF'; 

// ----------------------------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------------------------
import { converterParaNumero, formatarDataInput, formatarInputMoeda, formatarMoeda } from '../../utils/formatadores';

export default function GestaoGastos() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [listaGastos, setListaGastos] = useState<any[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);
  const [modalFiltroAberto, setModalFiltroAberto] = useState(false);

  // Animação de entrada e Scroll
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnimUp = useRef(new Animated.Value(30)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Efeito que esconde/mostra os cabeçalhos usando diffClamp
  const headerDiffClamp = Animated.diffClamp(scrollY, 0, 100);
  const footerDiffClamp = Animated.diffClamp(scrollY, 0, 120);

  const headerTranslateY = headerDiffClamp.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -100],
    extrapolate: 'clamp',
  });

  const footerTranslateY = footerDiffClamp.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 120],
    extrapolate: 'clamp',
  });

  // Estados do formulário
  const [descricao, setDescricao] = useState('');
  const [dataCompra, setDataCompra] = useState('');
  const [responsavel, setResponsavel] = useState('Robinho');
  const [pagamento, setPagamento] = useState('NUBANK');
  const [categoria, setCategoria] = useState('MORADIA');
  const [isFixo, setIsFixo] = useState(false);
  const [isParcelado, setIsParcelado] = useState(false);
  const [qtdParcelas, setQtdParcelas] = useState('1');
  const [valorTotalGeral, setValorTotalGeral] = useState('');

  useEffect(() => {
    // Dispara animação ao carregar
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnimUp, { toValue: 0, duration: 800, useNativeDriver: true })
    ]).start();

    if (params.banco || params.responsavel || params.status) {
      const novosFiltros: string[] = [];
      if (params.banco && typeof params.banco === 'string') {
        params.banco.split(',').forEach(b => novosFiltros.push(b));
      }
      if (params.responsavel && typeof params.responsavel === 'string') {
        novosFiltros.push(params.responsavel);
      }
      if (params.status && typeof params.status === 'string') {
        novosFiltros.push(params.status);
      }
      setFiltrosAtivos(novosFiltros);
    }
  }, [params.banco, params.responsavel, params.status]);

  useEffect(() => {
    const gastosRef = ref(db, 'gastos');
    const unsubscribe = onValue(gastosRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const itens = Object.keys(dados).map(key => ({ id: key, ...dados[key] }));
        itens.sort((a, b) => (a.pago === b.pago) ? 0 : a.pago ? 1 : -1);
        setListaGastos(itens);
      } else {
        setListaGastos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // LÓGICA DE FILTRAGEM ATUALIZADA
  const gastosFiltrados = listaGastos.filter(item => {
    if (filtrosAtivos.length === 0) return true;

    const temFiltroResp = filtrosAtivos.some(f => RESPONSAVEIS.includes(f));
    const temFiltroPgto = filtrosAtivos.some(f => METODOS_PAGAMENTO.includes(f));
    const temFiltroStatusConta = filtrosAtivos.some(f => ['ATIVO', 'NÃO ATIVO'].includes(f));
    const temFiltroStatusPgto = filtrosAtivos.some(f => ['PAGO', 'PENDENTE'].includes(f));
    const temFiltroCategoria = filtrosAtivos.some(f => CATEGORIAS.includes(f));

    const passaResp = temFiltroResp ? filtrosAtivos.includes(item.responsavel) : true;
    const passaPgto = temFiltroPgto ? filtrosAtivos.includes(item.pagamento) : true;
    const passaCategoria = temFiltroCategoria ? filtrosAtivos.includes(item.categoria) : true;
    
    let passaStatusConta = true;
    if (temFiltroStatusConta) {
      const isItemAtivo = item.isFixo || item.isParcelado;
      const querAtivo = filtrosAtivos.includes('ATIVO');
      const querNaoAtivo = filtrosAtivos.includes('NÃO ATIVO');
      if (querAtivo && querNaoAtivo) passaStatusConta = true;
      else if (querAtivo) passaStatusConta = isItemAtivo;
      else if (querNaoAtivo) passaStatusConta = !isItemAtivo;
    }

    let passaStatusPgto = true;
    if (temFiltroStatusPgto) {
      if (filtrosAtivos.includes('PAGO') && !item.pago) passaStatusPgto = false;
      if (filtrosAtivos.includes('PENDENTE') && item.pago) passaStatusPgto = false;
    }

    return passaResp && passaPgto && passaStatusConta && passaStatusPgto && passaCategoria;
  });

  const toggleFiltro = (filtro: string) => {
    setFiltrosAtivos(prev => prev.includes(filtro) ? prev.filter(f => f !== filtro) : [...prev, filtro]);
  };

  const limparFiltros = () => {
    setFiltrosAtivos([]);
  };

  const numeroTotal = converterParaNumero(valorTotalGeral);
  const parcelasNum = parseInt(qtdParcelas) || 1;
  const valorParcela = isParcelado ? (numeroTotal / parcelasNum) : numeroTotal;
  const totalEstimadoMes = gastosFiltrados.reduce((acc, item) => acc + converterParaNumero(item.subtotal), 0);
  const totalGastoMes = gastosFiltrados.filter(i => i.pago).reduce((acc, item) => acc + converterParaNumero(item.subtotal), 0);

  const preencherDataHoje = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
    setDataCompra(`${dd}/${mm}/${yyyy}`);
  };

  const salvarGasto = async () => {
    if (!descricao || !valorTotalGeral || !dataCompra) {
      Alert.alert("Atenção", "Preencha a descrição, data e o valor total!");
      return;
    }
    const payload = {
      descricao, dataCompra, responsavel, pagamento, categoria,
      isFixo, isParcelado, qtdParcelas: isParcelado ? parcelasNum : 1,
      totalGeral: valorTotalGeral, subtotal: valorParcela.toFixed(2).replace('.', ','), 
      pago: false, dataRegistro: new Date().toISOString()
    };
    try {
      if (itemEditando) { await update(ref(db, `gastos/${itemEditando}`), payload); } 
      else { await set(push(ref(db, 'gastos')), payload); }
      fecharFormulario();
    } catch (error) { Alert.alert("Erro", "Falha ao salvar o gasto."); }
  };

  const alternarPago = async (id: string, estadoAtual: boolean) => {
    try { await update(ref(db, `gastos/${id}`), { pago: !estadoAtual }); } catch (error) { Alert.alert("Erro", "Erro ao atualizar status."); }
  };

  const confirmarExclusao = async (id: string, descItem: string) => {
    if (Platform.OS === 'web') {
      const confirmou = window.confirm(`Deseja apagar "${descItem}" permanentemente?`);
      if (confirmou) await remove(ref(db, `gastos/${id}`));
    } else {
      Alert.alert("Excluir Gasto", `Apagar "${descItem}" permanentemente?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: async () => await remove(ref(db, `gastos/${id}`)) }
      ]);
    }
  };

  const abrirEdicao = (item: any) => {
    setDescricao(item.descricao); setDataCompra(item.dataCompra); setResponsavel(item.responsavel); setPagamento(item.pagamento);
    setCategoria(item.categoria); setIsFixo(item.isFixo); setIsParcelado(item.isParcelado); setQtdParcelas(item.qtdParcelas.toString());
    setValorTotalGeral(item.totalGeral); setItemEditando(item.id); setFormAberto(true);
  };

  const fecharFormulario = () => {
    setDescricao(''); setDataCompra(''); setValorTotalGeral(''); setQtdParcelas('1'); setIsFixo(false); setIsParcelado(false); setResponsavel('Robinho');
    setItemEditando(null); setFormAberto(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainWrapper}>
        
        {/* ÁREA DE ROLAGEM COM A LISTA */}
        <Animated.View style={[styles.listArea, { opacity: fadeAnim, transform: [{ translateY: slideAnimUp }] }]}>
          <Animated.FlatList 
            data={gastosFiltrados}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 100, paddingBottom: 150, flexGrow: 1 }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            
            ListHeaderComponent={
              <View style={styles.actionRow}>
                <TouchableOpacity activeOpacity={0.8} style={styles.toggleFormButton} onPress={() => setFormAberto(true)}>
                  <Feather name="plus" size={20} color="#FFF" />
                  <Text style={styles.toggleFormText}>Adicionar Gasto</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.8} style={[styles.filterButton, filtrosAtivos.length > 0 && styles.filterButtonAtivo]} onPress={() => setModalFiltroAberto(true)}>
                  <Feather name="filter" size={20} color={filtrosAtivos.length > 0 ? "#B04FCF" : "#FFF"} />
                  {filtrosAtivos.length > 0 && (
                     <View style={styles.filterBadgeIndicator}><Text style={styles.filterBadgeText}>{filtrosAtivos.length}</Text></View>
                  )}
                </TouchableOpacity>
              </View>
            }

            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="file-text" size={50} color="#2D1436" />
                <Text style={styles.emptyStateText}>Nenhum gasto encontrado.</Text>
                {filtrosAtivos.length > 0 && (
                  <TouchableOpacity onPress={limparFiltros} style={{marginTop: 15, padding: 10}}>
                    <Text style={{color: '#B04FCF', fontWeight: 'bold'}}>Limpar Filtros</Text>
                  </TouchableOpacity>
                )}
              </View>
            }

            renderItem={({ item }) => {
              const corPagamentoLista = CORES_BANCOS[item.pagamento] || '#AA319C';
              const isGastoAtivo = item.isFixo || item.isParcelado;
              return (
                <View style={[styles.itemCard, item.pago && styles.itemCardPago]}>
                  <View style={styles.itemHeader}>
                    <TouchableOpacity style={[styles.checkbox, item.pago && styles.checkboxMarcado]} onPress={() => alternarPago(item.id, item.pago)}>
                      {item.pago && <Feather name="check" size={14} color="#FFF" />}
                    </TouchableOpacity>
                    <View style={styles.itemTitleArea}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isGastoAtivo ? '#00E676' : '#444', marginRight: 8 }} />
                        <Text style={[styles.itemTexto, item.pago && styles.itemTextoRiscado, { marginBottom: 0 }]} numberOfLines={1}>{item.descricao}</Text>
                      </View>
                      <Text style={styles.dataItem}><Feather name="calendar" size={10}/> {item.dataCompra}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.badge, { backgroundColor: item.responsavel === 'Robinho' ? '#3b82f620' : '#ec489920' }]}>
                        <Text style={[styles.badgeText, { color: item.responsavel === 'Robinho' ? '#3b82f6' : '#ec4899' }]}>{item.responsavel}</Text>
                      </View>
                      {item.isFixo && (
                        <View style={[styles.badge, { backgroundColor: '#FFD70015', marginTop: 4, borderWidth: 1, borderColor: '#FFD70030' }]}>
                           <Text style={[styles.badgeText, { color: '#FFD700' }]}>FIXO</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.infoTagsRow}>
                    <View style={[styles.infoTagItem, { borderColor: corPagamentoLista, backgroundColor: `${corPagamentoLista}15` }]}>
                      <Text style={{ color: corPagamentoLista, fontSize: 10, fontWeight: 'bold' }}>💳 {item.pagamento}</Text>
                    </View>
                    <View style={[styles.infoTagItem, { borderColor: COR_PADRAO_TAGS, backgroundColor: `${COR_PADRAO_TAGS}20` }]}>
                      <Text style={[styles.infoTagTexto, { color: '#FFF' }]}>🏷️ {item.categoria}</Text>
                    </View>
                    {item.isParcelado && (
                      <View style={[styles.infoTagItem, { borderColor: COR_PADRAO_TAGS, backgroundColor: `${COR_PADRAO_TAGS}20` }]}>
                        <Text style={[styles.infoTagTexto, { color: '#FFF' }]}>📦 {item.qtdParcelas}x</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.itemFooter}>
                    <View>
                      <Text style={styles.labelSubtotal}>Valor {item.isParcelado ? 'da Parcela' : 'Atual'}</Text>
                      <Text style={[styles.valorTextoFinal, item.pago && { color: '#00E676' }]}>R$ {item.subtotal}</Text>
                      {item.isParcelado && <Text style={styles.totalGeralItem}>Total Gasto: R$ {item.totalGeral}</Text>}
                    </View>
                    <View style={styles.footerActions}>
                      <TouchableOpacity style={styles.editButton} onPress={() => abrirEdicao(item)}><Feather name="edit-2" size={16} color="#B04FCF" /></TouchableOpacity>
                      <TouchableOpacity style={styles.deleteButton} onPress={() => confirmarExclusao(item.id, item.descricao)}><Feather name="trash-2" size={16} color="#FF4D4D" /></TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </Animated.View>

        {/* CABEÇALHO FLUTUANTE (ANIMAÇÃO) */}
        <Animated.View style={[styles.headerFlutuante, { transform: [{ translateY: headerTranslateY }] }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#B04FCF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.titulo}>Gestão de Gastos</Text>
              <Text style={styles.subtitulo}>{gastosFiltrados.length} contas listadas</Text>
            </View>
          </View>
        </Animated.View>

        {/* RODAPÉ FLUTUANTE DE TOTAIS (ANIMAÇÃO) */}
        <Animated.View style={[styles.rodapeFlutuante, { transform: [{ translateY: footerTranslateY }] }]}>
          <View style={styles.subtotalContainer}>
            <View style={styles.subtotalColumn}>
              <Text style={styles.subtotalLabel}>Total a Pagar</Text>
              <Text style={styles.subtotalValueEstimado}>{formatarMoeda(totalEstimadoMes)}</Text>
            </View>
            <View style={styles.subtotalDivider} />
            <View style={styles.subtotalColumn}>
              <Text style={styles.subtotalLabelGasto}>Já Pago (OK)</Text>
              <Text style={styles.subtotalValueGasto}>{formatarMoeda(totalGastoMes)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* MODAL DO FORMULÁRIO */}
        <Modal visible={formAberto} animationType="slide" transparent>
          <View style={styles.modalFullOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View style={styles.formModalContainer}>
                <View style={styles.modalHeaderClose}>
                  <Text style={styles.formTitle}>{itemEditando ? "Editar Despesa" : "Nova Despesa"}</Text>
                  <TouchableOpacity onPress={fecharFormulario} style={styles.btnCloseForm}><Feather name="x" size={24} color="#FFF" /></TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                  <View style={styles.rowInputs}>
                    <View style={[styles.inputWrapper, { width: '64%' }]}>
                      <Text style={styles.inputLabelMicro}>Descrição Leve</Text>
                      <TextInput style={styles.input} placeholder="Ex: Parcela do Apê" placeholderTextColor="#666" value={descricao} onChangeText={setDescricao} />
                    </View>
                    <View style={[styles.inputWrapper, { width: '32%' }]}>
                      <Text style={styles.inputLabelMicro}>Data</Text>
                      <View style={styles.dataContainer}>
                        <TextInput style={[styles.input, { paddingRight: 40 }]} placeholder="DD/MM/AA" placeholderTextColor="#666" value={dataCompra} onChangeText={(txt) => setDataCompra(formatarDataInput(txt))} keyboardType="number-pad" maxLength={10} />
                        <TouchableOpacity style={styles.iconDataHoje} onPress={preencherDataHoje}><Feather name="calendar" size={18} color="#B04FCF" /></TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.inputLabelMicro}>Quem fez / De quem é?</Text>
                  <View style={styles.tagsContainer}>
                    {RESPONSAVEIS.map(resp => (
                      <TouchableOpacity key={resp} style={[styles.tagNormal, responsavel === resp && styles.tagRespAtiva]} onPress={() => setResponsavel(resp)}>
                        <Text style={[styles.tagTexto, responsavel === resp && styles.tagTextoAtiva]}>{resp}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabelMicro}>Total Geral da Compra (R$)</Text>
                  <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#666" value={valorTotalGeral} onChangeText={(txt) => setValorTotalGeral(formatarInputMoeda(txt))} keyboardType="numeric" />

                  <View style={styles.switchesContainer}>
                    <TouchableOpacity style={[styles.switchBox, isFixo && styles.switchAtivoFixo]} onPress={() => setIsFixo(!isFixo)}>
                      <Feather name="repeat" size={16} color={isFixo ? "#FFF" : "#888"} style={{marginRight: 6}} />
                      <Text style={[styles.switchTexto, isFixo && styles.switchTextoAtivo]}>Gasto Fixo?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.switchBox, isParcelado && styles.switchAtivoParcela]} onPress={() => { setIsParcelado(!isParcelado); if(isParcelado) setQtdParcelas('1'); }}>
                      <Feather name="layers" size={16} color={isParcelado ? "#FFF" : "#888"} style={{marginRight: 6}} />
                      <Text style={[styles.switchTexto, isParcelado && styles.switchTextoAtivo]}>Foi Parcelado?</Text>
                    </TouchableOpacity>
                  </View>

                  {isParcelado && (
                    <View style={styles.parcelaBox}>
                      <Text style={styles.inputLabelMicro}>Quantidade de Parcelas</Text>
                      <TextInput style={styles.input} placeholder="Ex: 12" placeholderTextColor="#666" value={qtdParcelas} onChangeText={setQtdParcelas} keyboardType="number-pad" />
                      <View style={styles.calculoAoVivoBox}>
                        <Text style={styles.calculoTexto}>Subtotal (Valor por parcela):</Text>
                        <Text style={styles.calculoValor}>{formatarMoeda(valorParcela)}</Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.inputLabelMicro}>Método de Pagamento</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                    {METODOS_PAGAMENTO.map(metodo => (
                      <TouchableOpacity key={metodo} style={[styles.tagNormal, pagamento === metodo && { backgroundColor: CORES_BANCOS[metodo], borderColor: CORES_BANCOS[metodo] }]} onPress={() => setPagamento(metodo)}>
                        <Text style={[styles.tagTexto, pagamento === metodo && styles.tagTextoAtiva]}>{metodo}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabelMicro}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }}>
                    {CATEGORIAS.map(cat => (
                      <TouchableOpacity key={cat} style={[styles.tagNormal, categoria === cat && { backgroundColor: COR_PADRAO_TAGS, borderColor: COR_PADRAO_TAGS }]} onPress={() => setCategoria(cat)}>
                        <Text style={[styles.tagTexto, categoria === cat && styles.tagTextoAtiva]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TouchableOpacity style={styles.submitButton} onPress={salvarGasto}>
                    <Text style={styles.submitButtonText}>{itemEditando ? "Atualizar Gasto" : "Gravar Gasto"}</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* NOVO MODAL DE FILTROS (BOTTOM SHEET) */}
        <Modal visible={modalFiltroAberto} animationType="slide" transparent>
          <View style={styles.modalFullOverlay}>
            <View style={styles.bottomSheetContainer}>
              
              {/* Header do Filtro */}
              <View style={styles.modalHeaderClose}>
                <View>
                  <Text style={styles.formTitle}>Filtros Avançados</Text>
                  <Text style={{color: '#888', fontSize: 12, marginTop: 2}}>Combine opções para buscar gastos</Text>
                </View>
                <TouchableOpacity onPress={() => setModalFiltroAberto(false)} style={styles.btnCloseForm}>
                  <Feather name="x" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                
                {/* 1. Status do Pagamento */}
                <Text style={styles.inputLabelMicro}>Status do Pagamento</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity style={[styles.chipPill, filtrosAtivos.includes('PENDENTE') && { backgroundColor: '#FF3366', borderColor: '#FF3366' }]} onPress={() => toggleFiltro('PENDENTE')}>
                    <Text style={[styles.chipTexto, filtrosAtivos.includes('PENDENTE') && { color: '#FFF' }]}>A Pagar (Pendente)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chipPill, filtrosAtivos.includes('PAGO') && { backgroundColor: '#00E676', borderColor: '#00E676' }]} onPress={() => toggleFiltro('PAGO')}>
                    <Text style={[styles.chipTexto, filtrosAtivos.includes('PAGO') && { color: '#0F0414' }]}>Já Pago</Text>
                  </TouchableOpacity>
                </View>

                {/* 2. Responsável */}
                <Text style={styles.inputLabelMicro}>Responsável pela Conta</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity style={[styles.chipPill, filtrosAtivos.includes('Robinho') && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }]} onPress={() => toggleFiltro('Robinho')}>
                    <Text style={[styles.chipTexto, filtrosAtivos.includes('Robinho') && { color: '#FFF' }]}>Robinho</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chipPill, filtrosAtivos.includes('Vanessinha') && { backgroundColor: '#ec4899', borderColor: '#ec4899' }]} onPress={() => toggleFiltro('Vanessinha')}>
                    <Text style={[styles.chipTexto, filtrosAtivos.includes('Vanessinha') && { color: '#FFF' }]}>Vanessinha</Text>
                  </TouchableOpacity>
                </View>

                {/* 3. Tipo de Conta */}
                <Text style={styles.inputLabelMicro}>Tipo de Conta</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity style={[styles.chipPill, filtrosAtivos.includes('ATIVO') && { backgroundColor: '#FFD700', borderColor: '#FFD700' }]} onPress={() => toggleFiltro('ATIVO')}>
                    <Text style={[styles.chipTexto, filtrosAtivos.includes('ATIVO') && { color: '#0F0414' }]}>Recorrente (Fixo/Parc)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chipPill, filtrosAtivos.includes('NÃO ATIVO') && { backgroundColor: '#666', borderColor: '#666' }]} onPress={() => toggleFiltro('NÃO ATIVO')}>
                    <Text style={[styles.chipTexto, filtrosAtivos.includes('NÃO ATIVO') && { color: '#FFF' }]}>Gasto Único</Text>
                  </TouchableOpacity>
                </View>

                {/* 4. Método de Pagamento */}
                <Text style={styles.inputLabelMicro}>Método de Pagamento</Text>
                <View style={styles.chipsWrap}>
                  {METODOS_PAGAMENTO.map(metodo => {
                    const isAtivo = filtrosAtivos.includes(metodo);
                    const cor = CORES_BANCOS[metodo] || '#B04FCF';
                    return (
                      <TouchableOpacity key={metodo} style={[styles.chipPill, isAtivo && { backgroundColor: cor, borderColor: cor }]} onPress={() => toggleFiltro(metodo)}>
                        <Text style={[styles.chipTexto, isAtivo && { color: metodo === 'DINHEIRO' || metodo === 'PIX' ? '#0F0414' : '#FFF' }]}>{metodo}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 5. Categoria */}
                <Text style={styles.inputLabelMicro}>Categorias</Text>
                <View style={styles.chipsWrap}>
                  {CATEGORIAS.map(cat => (
                    <TouchableOpacity key={cat} style={[styles.chipPill, filtrosAtivos.includes(cat) && { backgroundColor: COR_PADRAO_TAGS, borderColor: COR_PADRAO_TAGS }]} onPress={() => toggleFiltro(cat)}>
                      <Text style={[styles.chipTexto, filtrosAtivos.includes(cat) && { color: '#FFF' }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Rodapé de Ações do Filtro */}
              <View style={styles.filterActionFooter}>
                <TouchableOpacity style={styles.btnLimparFiltros} onPress={limparFiltros}>
                  <Text style={styles.btnLimparTexto}>Limpar Tudo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnAplicarFiltros} onPress={() => setModalFiltroAberto(false)}>
                  <Text style={styles.btnAplicarTexto}>Mostrar Resultados</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  mainWrapper: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }, 
  
  // Elementos Flutuantes
  headerFlutuante: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F0414',
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  rodapeFlutuante: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: 'transparent',
  },

  header: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitulo: { fontSize: 12, color: '#888', marginTop: 2 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  toggleFormButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#B04FCF', padding: 15, borderRadius: 16, justifyContent: 'center' },
  toggleFormText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  filterButton: { position: 'relative', width: 54, backgroundColor: '#1E0A24', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2D1436' },
  filterButtonAtivo: { borderColor: '#B04FCF', backgroundColor: '#B04FCF20' }, 
  filterBadgeIndicator: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF3366', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0F0414' },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  
  listArea: { flex: 1, paddingHorizontal: 20 }, 
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { color: '#666', fontSize: 14, marginTop: 15, fontWeight: '500' },
  
  itemCard: { backgroundColor: '#1E0A24', padding: 20, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436', shadowColor: '#B04FCF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  itemCardPago: { opacity: 0.6, borderColor: '#00E67640' }, 
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#B04FCF', justifyContent: 'center', alignItems: 'center', marginRight: 15, marginTop: 2 },
  checkboxMarcado: { backgroundColor: '#00E676', borderColor: '#00E676' },
  itemTitleArea: { flex: 1, paddingRight: 10 },
  itemTexto: { fontSize: 18, color: '#FFF', fontWeight: 'bold', marginBottom: 4 },
  itemTextoRiscado: { textDecorationLine: 'line-through', color: '#888' },
  dataItem: { color: '#888', fontSize: 11, fontWeight: '500' },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  infoTagsRow: { flexDirection: 'row', marginBottom: 18, gap: 8 },
  infoTagItem: { backgroundColor: '#0F0414', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  infoTagTexto: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2D1436' },
  labelSubtotal: { fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 4, fontWeight: 'bold' },
  valorTextoFinal: { fontSize: 22, color: '#FFF', fontWeight: '900' },
  totalGeralItem: { fontSize: 10, color: '#666', marginTop: 2 },
  footerActions: { flexDirection: 'row', alignItems: 'center' },
  editButton: { padding: 10, backgroundColor: '#B04FCF15', borderRadius: 10, borderWidth: 1, borderColor: '#B04FCF30', marginRight: 10 },
  deleteButton: { padding: 10, backgroundColor: '#FF4D4D15', borderRadius: 10, borderWidth: 1, borderColor: '#FF4D4D30' },
  
  subtotalContainer: { 
    backgroundColor: '#1E0A24', 
    padding: 20, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: '#2D1436', 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center',
    shadowColor: '#B04FCF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  subtotalColumn: { alignItems: 'center', flex: 1 },
  subtotalDivider: { width: 1, backgroundColor: '#2D1436', height: '80%' },
  subtotalLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  subtotalValueEstimado: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  subtotalLabelGasto: { color: '#00E676', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  subtotalValueGasto: { color: '#00E676', fontSize: 20, fontWeight: '900' },
  
  modalFullOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  
  // Estilos do Modal de Formulário
  formModalContainer: { backgroundColor: '#1E0A24', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%', borderWidth: 1, borderColor: '#2D1436' },
  modalHeaderClose: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  btnCloseForm: { padding: 8, backgroundColor: '#0F0414', borderRadius: 12 },
  formTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 20 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  inputWrapper: { marginBottom: 15 },
  inputLabelMicro: { color: '#B04FCF', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 1 },
  input: { height: 55, backgroundColor: '#0F0414', borderRadius: 14, paddingHorizontal: 15, fontSize: 16, color: '#FFF', borderWidth: 1, borderColor: '#2D1436', marginBottom: 15 },
  dataContainer: { position: 'relative', justifyContent: 'center' },
  iconDataHoje: { position: 'absolute', right: 12, top: 18 },
  tagsContainer: { flexDirection: 'row', marginBottom: 20 },
  tagNormal: { backgroundColor: '#0F0414', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2D1436', marginRight: 10 },
  tagTexto: { color: '#888', fontWeight: 'bold', fontSize: 12 },
  tagTextoAtiva: { color: '#FFF' },
  tagRespAtiva: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }, 
  switchesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  switchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0414', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#2D1436', marginHorizontal: 4 },
  switchAtivoFixo: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  switchAtivoParcela: { backgroundColor: '#00E676', borderColor: '#00E676' },
  switchTexto: { color: '#888', fontWeight: 'bold', fontSize: 12 },
  switchTextoAtivo: { color: '#0F0414', fontWeight: '900' },
  parcelaBox: { backgroundColor: '#0F0414', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2D1436', marginBottom: 20 },
  calculoAoVivoBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E0A24', padding: 15, borderRadius: 12, marginTop: 5 },
  calculoTexto: { color: '#B04FCF', fontSize: 12, fontWeight: 'bold' },
  calculoValor: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  submitButton: { backgroundColor: '#B04FCF', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  
  // Estilos do Novo Modal de Filtros (Bottom Sheet)
  bottomSheetContainer: { backgroundColor: '#1E0A24', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '85%', width: '100%', borderWidth: 1, borderColor: '#2D1436' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  chipPill: { backgroundColor: '#0F0414', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#2D1436', justifyContent: 'center', alignItems: 'center' },
  chipTexto: { color: '#888', fontWeight: 'bold', fontSize: 13 },
  filterActionFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 15, borderTopWidth: 1, borderTopColor: '#2D1436', paddingTop: 20 },
  btnLimparFiltros: { flex: 1, backgroundColor: '#0F0414', height: 55, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2D1436' },
  btnLimparTexto: { color: '#888', fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase' },
  btnAplicarFiltros: { flex: 1, backgroundColor: '#B04FCF', height: 55, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  btnAplicarTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase' }
});