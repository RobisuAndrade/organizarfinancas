import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router'; // <-- ATUALIZADO AQUI
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

const METODOS_PAGAMENTO = ['NUBANK', 'INTER', 'BRADESCO', 'BOLETO', 'PIX', 'DINHEIRO'];

const CORES_BANCOS: { [key: string]: string } = {
  'NUBANK': '#8A05BE',
  'INTER': '#FF7A00',
  'BRADESCO': '#CC092F',
  'BOLETO': '#888888',
  'PIX': '#32BCAD',
  'DINHEIRO': '#00E676'
};

const RESPONSAVEIS = ['Robinho', 'Vanessinha'];

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

const formatarInputMoeda = (texto: string) => {
  let valorLimpo = texto.replace(/\D/g, ''); 
  if (!valorLimpo) return '';
  let valorNumero = (parseInt(valorLimpo, 10) / 100).toFixed(2);
  let valorFormatado = valorNumero.replace('.', ',');
  valorFormatado = valorFormatado.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  return valorFormatado;
};

const formatarDataInput = (texto: string) => {
  let r = texto.replace(/\D/g, "");
  if (r.length > 8) r = r.slice(0, 8);
  if (r.length > 4) r = r.replace(/^(\d{2})(\d{2})(\d{4}).*/, "$1/$2/$3");
  else if (r.length > 2) r = r.replace(/^(\d{2})(\d{1,2}).*/, "$1/$2");
  return r;
};

export default function GestaoGastos() {
  const router = useRouter();
  const params = useLocalSearchParams(); // <-- NOVO: PUXA OS DADOS DA OUTRA TELA

  // Refs e Estados para Rolagem das Listas
  const scrollPgtoRef = useRef<ScrollView>(null);
  const scrollCatRef = useRef<ScrollView>(null);
  const [offsetPgto, setOffsetPgto] = useState(0);
  const [offsetCat, setOffsetCat] = useState(0);

  // Estados da Lista Principal e Filtros
  const [listaGastos, setListaGastos] = useState<any[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  
  // Array de filtros (permite selecionar vários)
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);
  
  // Controle do Menu Lateral (Drawer) Animado
  const [modalFiltroAberto, setModalFiltroAberto] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;

  // Estados do Formulário
  const [descricao, setDescricao] = useState('');
  const [dataCompra, setDataCompra] = useState('');
  const [responsavel, setResponsavel] = useState('Robinho');
  const [pagamento, setPagamento] = useState('NUBANK');
  const [categoria, setCategoria] = useState('MORADIA');
  
  const [isFixo, setIsFixo] = useState(false);
  const [isParcelado, setIsParcelado] = useState(false);
  const [qtdParcelas, setQtdParcelas] = useState('1');
  const [valorTotalGeral, setValorTotalGeral] = useState('');

  // ----------------------------------------------------
  // INTEGRAÇÃO COM OS CLIQUES DOS CARDS
  // ----------------------------------------------------
  useEffect(() => {
    // Se a tela abriu vindo de um clique de um Cartão da página inicial, aplica o filtro dele
    if (params.banco || params.responsavel) {
      const novosFiltros: string[] = [];
      if (params.banco && typeof params.banco === 'string') novosFiltros.push(params.banco);
      if (params.responsavel && typeof params.responsavel === 'string') novosFiltros.push(params.responsavel);
      
      setFiltrosAtivos(novosFiltros);
    }
  }, [params.banco, params.responsavel]); // Só executa quando esses parâmetros mudam

  // Carregar dados do Firebase
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

  // ----------------------------------------------------
  // LÓGICA DE FILTRAGEM (ACEITA MÚLTIPLOS)
  // ----------------------------------------------------
  const gastosFiltrados = listaGastos.filter(item => {
    if (filtrosAtivos.length === 0) return true; // Se não tem filtro, mostra tudo

    // Verifica se os filtros ativos possuem pessoas e/ou métodos de pagamento
    const temFiltroResp = filtrosAtivos.some(f => RESPONSAVEIS.includes(f));
    const temFiltroPgto = filtrosAtivos.some(f => METODOS_PAGAMENTO.includes(f));

    const passaResp = temFiltroResp ? filtrosAtivos.includes(item.responsavel) : true;
    const passaPgto = temFiltroPgto ? filtrosAtivos.includes(item.pagamento) : true;

    // Tem que passar nas duas condições
    return passaResp && passaPgto;
  });

  const toggleFiltro = (filtro: string) => {
    if (filtro === 'TODOS') {
      setFiltrosAtivos([]);
      return;
    }
    
    setFiltrosAtivos(prev => {
      if (prev.includes(filtro)) {
        return prev.filter(f => f !== filtro); 
      } else {
        return [...prev, filtro]; 
      }
    });
  };

  // Funções de Animação do Menu Lateral
  const abrirFiltros = () => {
    setModalFiltroAberto(true);
    Animated.timing(slideAnim, {
      toValue: 0, 
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const fecharFiltros = () => {
    Animated.timing(slideAnim, {
      toValue: Dimensions.get('window').width, 
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalFiltroAberto(false);
    });
  };

  // Cálculos Dinâmicos
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

  const passoScroll = 220; 
  const rolarPagamentos = (direcao: 'esq' | 'dir') => {
    const novoOffset = direcao === 'dir' ? offsetPgto + passoScroll : Math.max(0, offsetPgto - passoScroll);
    scrollPgtoRef.current?.scrollTo({ x: novoOffset, animated: true });
    setOffsetPgto(novoOffset);
  };
  const rolarCategorias = (direcao: 'esq' | 'dir') => {
    const novoOffset = direcao === 'dir' ? offsetCat + passoScroll : Math.max(0, offsetCat - passoScroll);
    scrollCatRef.current?.scrollTo({ x: novoOffset, animated: true });
    setOffsetCat(novoOffset);
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
      if (itemEditando) {
        await update(ref(db, `gastos/${itemEditando}`), payload);
      } else {
        await set(push(ref(db, 'gastos')), payload);
      }
      fecharFormulario();
    } catch (error) {
      Alert.alert("Erro", "Falha ao salvar o gasto.");
    }
  };

  const alternarPago = async (id: string, estadoAtual: boolean) => {
    try { await update(ref(db, `gastos/${id}`), { pago: !estadoAtual }); } catch (error) { Alert.alert("Erro", "Erro ao atualizar status."); }
  };

  const confirmarExclusao = async (id: string, descItem: string) => {
    Alert.alert("Excluir Gasto", `Apagar "${descItem}" permanentemente?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => await remove(ref(db, `gastos/${id}`)) }
    ]);
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
      <View style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#B04FCF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.titulo}>Gestão de Gastos</Text>
            <Text style={styles.subtitulo}>Nossas contas e despesas</Text>
          </View>
        </View>

        <View style={styles.listArea}>
          <FlatList 
            data={gastosFiltrados}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
            
            ListHeaderComponent={
              <View style={{ paddingBottom: 10 }}>
                {/* BOTÕES NOVO GASTO + ABRIR MENU DE FILTROS */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.toggleFormButton} onPress={() => formAberto ? fecharFormulario() : setFormAberto(true)}>
                    <Feather name={formAberto ? "x" : "plus"} size={20} color="#FFF" />
                    <Text style={styles.toggleFormText}>{formAberto ? "Cancelar Cadastro" : "Adicionar Gasto"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.filterButton, filtrosAtivos.length > 0 && styles.filterButtonAtivo]} 
                    onPress={abrirFiltros}
                  >
                    <Feather name="filter" size={20} color={filtrosAtivos.length > 0 ? "#B04FCF" : "#FFF"} />
                    {filtrosAtivos.length > 0 && (
                       <View style={styles.filterBadgeIndicator}>
                         <Text style={styles.filterBadgeText}>{filtrosAtivos.length}</Text>
                       </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* FORMULÁRIO DE CADASTRO */}
                {formAberto && (
                  <View style={styles.formContainer}>
                    <Text style={styles.formTitle}>{itemEditando ? "Editar Despesa" : "Nova Despesa"}</Text>

                    <View style={styles.rowInputs}>
                      <View style={[styles.inputWrapper, { width: '64%' }]}>
                        <Text style={styles.inputLabelMicro}>Descrição Leve</Text>
                        <TextInput style={styles.input} placeholder="Ex: Parcela do Apê" placeholderTextColor="#666" value={descricao} onChangeText={setDescricao} />
                      </View>
                      
                      <View style={[styles.inputWrapper, { width: '32%' }]}>
                        <Text style={styles.inputLabelMicro}>Data</Text>
                        <View style={styles.dataContainer}>
                          <TextInput 
                            style={[styles.input, { paddingRight: 40 }]} 
                            placeholder="DD/MM/AA" 
                            placeholderTextColor="#666" 
                            value={dataCompra} 
                            onChangeText={(txt) => setDataCompra(formatarDataInput(txt))} 
                            keyboardType="number-pad" 
                            maxLength={10} 
                          />
                          <TouchableOpacity style={styles.iconDataHoje} onPress={preencherDataHoje}>
                            <Feather name="calendar" size={18} color="#B04FCF" />
                          </TouchableOpacity>
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

                    {!isParcelado && numeroTotal > 0 && (
                      <View style={styles.calculoAoVivoBox}>
                         <Text style={styles.calculoTexto}>Valor único da conta:</Text>
                         <Text style={styles.calculoValor}>{formatarMoeda(valorParcela)}</Text>
                      </View>
                    )}

                    <View style={styles.scrollHeader}>
                      <Text style={styles.inputLabelMicro}>Método de Pagamento</Text>
                      <View style={styles.setasScrollBox}>
                        <TouchableOpacity onPress={() => rolarPagamentos('esq')} style={styles.setaBotao}>
                          <Feather name="chevron-left" size={18} color="#B04FCF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => rolarPagamentos('dir')} style={styles.setaBotao}>
                          <Feather name="chevron-right" size={18} color="#B04FCF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <ScrollView 
                      ref={scrollPgtoRef} 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      style={{ marginBottom: 15 }}
                      onScroll={(e) => setOffsetPgto(e.nativeEvent.contentOffset.x)}
                      scrollEventThrottle={16}
                    >
                      {METODOS_PAGAMENTO.map(metodo => {
                        const isAtivo = pagamento === metodo;
                        const corDoBanco = CORES_BANCOS[metodo] || '#B04FCF';
                        
                        return (
                          <TouchableOpacity 
                            key={metodo} 
                            style={[styles.tagNormal, isAtivo && { backgroundColor: corDoBanco, borderColor: corDoBanco }]} 
                            onPress={() => setPagamento(metodo)}
                          >
                            <Text style={[styles.tagTexto, isAtivo && styles.tagTextoAtiva]}>{metodo}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.scrollHeader}>
                      <Text style={styles.inputLabelMicro}>Categoria</Text>
                      <View style={styles.setasScrollBox}>
                        <TouchableOpacity onPress={() => rolarCategorias('esq')} style={styles.setaBotao}>
                          <Feather name="chevron-left" size={18} color="#B04FCF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => rolarCategorias('dir')} style={styles.setaBotao}>
                          <Feather name="chevron-right" size={18} color="#B04FCF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <ScrollView 
                      ref={scrollCatRef} 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      style={{ marginBottom: 25 }}
                      onScroll={(e) => setOffsetCat(e.nativeEvent.contentOffset.x)}
                      scrollEventThrottle={16}
                    >
                      {CATEGORIAS.map(cat => (
                        <TouchableOpacity key={cat} style={[styles.tagNormal, categoria === cat && styles.tagCatAtiva]} onPress={() => setCategoria(cat)}>
                          <Text style={[styles.tagTexto, categoria === cat && styles.tagTextoAtiva]}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <TouchableOpacity style={styles.submitButton} onPress={salvarGasto}>
                      <Text style={styles.submitButtonText}>{itemEditando ? "Atualizar Gasto" : "Gravar Gasto"}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            }
            
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="folder-minus" size={50} color="#2D1436" />
                <Text style={styles.emptyStateText}>Nenhuma conta encontrada.</Text>
              </View>
            }

            renderItem={({ item }) => {
              const corPagamentoLista = CORES_BANCOS[item.pagamento] || '#AA319C';

              return (
                <View style={[styles.itemCard, item.pago && styles.itemCardPago]}>
                  <View style={styles.itemHeader}>
                    <TouchableOpacity style={[styles.checkbox, item.pago && styles.checkboxMarcado]} onPress={() => alternarPago(item.id, item.pago)}>
                      {item.pago && <Feather name="check" size={14} color="#FFF" />}
                    </TouchableOpacity>
                    
                    <View style={styles.itemTitleArea}>
                      <Text style={[styles.itemTexto, item.pago && styles.itemTextoRiscado]}>{item.descricao}</Text>
                      <Text style={styles.dataItem}><Feather name="calendar" size={10}/> {item.dataCompra}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.badge, { backgroundColor: item.responsavel === 'Robinho' ? '#3b82f630' : '#ec489930' }]}>
                        <Text style={[styles.badgeText, { color: item.responsavel === 'Robinho' ? '#3b82f6' : '#ec4899' }]}>{item.responsavel}</Text>
                      </View>
                      {item.isFixo && (
                        <View style={[styles.badge, { backgroundColor: '#FFD70030', marginTop: 4 }]}>
                           <Text style={[styles.badgeText, { color: '#FFD700' }]}>FIXO</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.infoTagsRow}>
                    <View style={[styles.infoTagItem, { borderColor: corPagamentoLista, backgroundColor: `${corPagamentoLista}15` }]}>
                      <Text style={{ color: corPagamentoLista, fontSize: 10, fontWeight: 'bold' }}>💳 {item.pagamento}</Text>
                    </View>
                    <View style={styles.infoTagItem}>
                      <Text style={styles.infoTagTexto}>🏷️ {item.categoria}</Text>
                    </View>
                    {item.isParcelado && (
                      <View style={styles.infoTagItem}>
                        <Text style={styles.infoTagTexto}>📦 {item.qtdParcelas}x</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.itemFooter}>
                    <View>
                      <Text style={styles.labelSubtotal}>Valor {item.isParcelado ? 'da Parcela' : 'Atual'}</Text>
                      <Text style={[styles.valorTextoFinal, item.pago && { color: '#00E676' }]}>
                        R$ {item.subtotal}
                      </Text>
                      {item.isParcelado && (
                        <Text style={styles.totalGeralItem}>Total Gasto: R$ {item.totalGeral}</Text>
                      )}
                    </View>
                    
                    <View style={styles.footerActions}>
                      <TouchableOpacity style={styles.editButton} onPress={() => abrirEdicao(item)}>
                        <Feather name="edit-2" size={16} color="#B04FCF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteButton} onPress={() => confirmarExclusao(item.id, item.descricao)}>
                        <Feather name="trash-2" size={16} color="#FF4D4D" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>

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

        {/* ==================================================== */}
        {/* MENU LATERAL DE FILTROS ANIMADO */}
        {/* ==================================================== */}
        <Modal visible={modalFiltroAberto} transparent animationType="none">
          <View style={styles.modalOverlay}>
            
            {/* Área invisível para clicar e fechar */}
            <TouchableOpacity style={{ flex: 1 }} onPress={fecharFiltros} activeOpacity={1} />
            
            {/* O Menu que desliza da direita */}
            <Animated.View style={[styles.drawerMenu, { transform: [{ translateX: slideAnim }] }]}>
              
              <View style={styles.drawerHeader}>
                <View>
                  <Text style={styles.modalTitle}>Filtrar Gastos</Text>
                  <Text style={styles.modalSubtitle}>Selecione uma ou mais opções</Text>
                </View>
                <TouchableOpacity onPress={fecharFiltros} style={styles.btnCloseDrawer}>
                  <Feather name="x" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                <Text style={styles.filtroSecaoTitulo}>Geral</Text>
                <TouchableOpacity 
                  style={[styles.modalFiltroItem, filtrosAtivos.length === 0 && styles.modalFiltroItemAtivo]} 
                  onPress={() => toggleFiltro('TODOS')}
                >
                  <Feather name="list" size={18} color={filtrosAtivos.length === 0 ? "#FFF" : "#888"} style={{ marginRight: 10 }} />
                  <Text style={[styles.modalFiltroTexto, filtrosAtivos.length === 0 && styles.modalFiltroTextoAtivo]}>Ver Todas as Contas</Text>
                </TouchableOpacity>

                <Text style={styles.filtroSecaoTitulo}>Por Pessoa</Text>
                <View style={{ flexDirection: 'column', gap: 10 }}>
                  <TouchableOpacity 
                    style={[styles.modalFiltroItem, filtrosAtivos.includes('Robinho') && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }]} 
                    onPress={() => toggleFiltro('Robinho')}
                  >
                    <View style={styles.checkboxMock}>
                      {filtrosAtivos.includes('Robinho') && <Feather name="check" size={14} color="#FFF" />}
                    </View>
                    <Text style={[styles.modalFiltroTexto, filtrosAtivos.includes('Robinho') && styles.modalFiltroTextoAtivo]}>Robinho</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalFiltroItem, filtrosAtivos.includes('Vanessinha') && { backgroundColor: '#ec4899', borderColor: '#ec4899' }]} 
                    onPress={() => toggleFiltro('Vanessinha')}
                  >
                    <View style={styles.checkboxMock}>
                      {filtrosAtivos.includes('Vanessinha') && <Feather name="check" size={14} color="#FFF" />}
                    </View>
                    <Text style={[styles.modalFiltroTexto, filtrosAtivos.includes('Vanessinha') && styles.modalFiltroTextoAtivo]}>Vanessinha</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.filtroSecaoTitulo}>Por Cartão / Pagamento</Text>
                <View style={{ flexDirection: 'column', gap: 10 }}>
                  {METODOS_PAGAMENTO.map(metodo => {
                    const isAtivo = filtrosAtivos.includes(metodo);
                    const cor = CORES_BANCOS[metodo] || '#B04FCF';
                    return (
                      <TouchableOpacity 
                        key={metodo} 
                        style={[styles.modalFiltroItem, isAtivo && { backgroundColor: cor, borderColor: cor }]} 
                        onPress={() => toggleFiltro(metodo)}
                      >
                        <View style={styles.checkboxMock}>
                          {isAtivo && <Feather name="check" size={14} color="#FFF" />}
                        </View>
                        <Text style={[styles.modalFiltroTexto, isAtivo && styles.modalFiltroTextoAtivo]}>{metodo}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* BOTÃO CONCLUIR FIXO EMBAIXO */}
              <TouchableOpacity style={styles.btnConcluirDrawer} onPress={fecharFiltros}>
                <Text style={styles.btnConcluirDrawerTexto}>Aplicar Filtros</Text>
              </TouchableOpacity>

            </Animated.View>
          </View>
        </Modal>

      </View>
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
  
  // AÇÕES E BOTÕES NO TOPO DA LISTA
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, gap: 10 },
  toggleFormButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#AA319C', padding: 15, borderRadius: 12, justifyContent: 'center' },
  toggleFormText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  
  filterButton: { position: 'relative', width: 54, backgroundColor: '#1E0A24', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2D1436' },
  filterButtonAtivo: { borderColor: '#B04FCF', backgroundColor: '#B04FCF20' }, 
  filterBadgeIndicator: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF3366', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0F0414' },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyStateText: { color: '#666', fontSize: 16, marginTop: 15 },
  listArea: { flex: 1 },

  formContainer: { backgroundColor: '#1E0A24', padding: 20, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#2D1436' },
  formTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 18, marginBottom: 15, textAlign: 'center' },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  inputWrapper: { marginBottom: 10 },
  
  dataContainer: { position: 'relative', justifyContent: 'center' },
  iconDataHoje: { position: 'absolute', right: 12, top: 15, zIndex: 5 },

  inputLabelMicro: { color: '#888', fontSize: 11, marginBottom: 6, marginLeft: 4, textTransform: 'uppercase', fontWeight: 'bold' },
  input: { height: 50, backgroundColor: '#0F0414', borderRadius: 12, paddingHorizontal: 15, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2D1436', marginBottom: 15 },
  
  scrollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  setasScrollBox: { flexDirection: 'row', gap: 8 },
  setaBotao: { padding: 4, backgroundColor: '#0F0414', borderRadius: 6, borderWidth: 1, borderColor: '#2D1436' },

  tagsContainer: { flexDirection: 'row', marginBottom: 15 },
  tagNormal: { backgroundColor: '#0F0414', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#2D1436', marginRight: 10 },
  tagTexto: { color: '#888', fontWeight: '600', fontSize: 12 },
  tagTextoAtiva: { color: '#FFF', fontWeight: 'bold' },
  
  tagRespAtiva: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }, 
  tagCatAtiva: { backgroundColor: '#AA319C', borderColor: '#AA319C' },

  switchesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  switchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0414', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2D1436', marginHorizontal: 4 },
  switchAtivoFixo: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  switchAtivoParcela: { backgroundColor: '#00E676', borderColor: '#00E676' },
  switchTexto: { color: '#888', fontWeight: 'bold', fontSize: 12 },
  switchTextoAtivo: { color: '#0F0414' },

  parcelaBox: { backgroundColor: '#0F0414', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#2D1436', marginBottom: 15 },
  
  calculoAoVivoBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E0A24', padding: 12, borderRadius: 8, marginTop: 5, borderWidth: 1, borderColor: '#AA319C50' },
  calculoTexto: { color: '#B04FCF', fontSize: 12, fontWeight: 'bold' },
  calculoValor: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  submitButton: { backgroundColor: '#B04FCF', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  itemCard: { backgroundColor: '#1E0A24', padding: 18, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436' },
  itemCardPago: { opacity: 0.6, borderColor: '#00E67650' }, 
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#B04FCF', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  checkboxMarcado: { backgroundColor: '#00E676', borderColor: '#00E676' },
  itemTitleArea: { flex: 1, paddingRight: 10 },
  itemTexto: { fontSize: 18, color: '#FFF', fontWeight: 'bold', marginBottom: 4 },
  itemTextoRiscado: { textDecorationLine: 'line-through', color: '#888' },
  dataItem: { color: '#666', fontSize: 11, fontWeight: 'bold' },
  
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },

  infoTagsRow: { flexDirection: 'row', marginBottom: 15, gap: 10 },
  infoTagItem: { backgroundColor: '#0F0414', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#2D1436', justifyContent: 'center' },
  infoTagTexto: { color: '#AAA', fontSize: 10, fontWeight: 'bold' },
  
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2D1436' },
  labelSubtotal: { fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 2 },
  valorTextoFinal: { fontSize: 20, color: '#FFF', fontWeight: 'bold' },
  totalGeralItem: { fontSize: 10, color: '#666', marginTop: 2 },
  
  footerActions: { flexDirection: 'row', alignItems: 'center' },
  editButton: { padding: 10, backgroundColor: '#AA319C15', borderRadius: 8, borderWidth: 1, borderColor: '#AA319C30', marginRight: 10 },
  deleteButton: { padding: 10, backgroundColor: '#FF4D4D15', borderRadius: 8, borderWidth: 1, borderColor: '#FF4D4D30' },

  subtotalContainer: { backgroundColor: '#1E0A24', padding: 15, borderRadius: 16, marginTop: 15, borderWidth: 1, borderColor: '#2D1436', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  subtotalColumn: { alignItems: 'center', flex: 1 },
  subtotalDivider: { width: 1, backgroundColor: '#2D1436', height: '80%' },
  subtotalLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  subtotalValueEstimado: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  subtotalLabelGasto: { color: '#00E676', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  subtotalValueGasto: { color: '#00E676', fontSize: 20, fontWeight: '900' },

  // =====================================
  // ESTILOS DO MENU LATERAL (DRAWER ANIMADO)
  // =====================================
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row' },
  drawerMenu: { width: '80%', height: '100%', backgroundColor: '#0F0414', borderLeftWidth: 1, borderColor: '#2D1436', padding: 25, shadowColor: '#000', shadowOffset: { width: -5, height: 0 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 20 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25, marginTop: 20 },
  btnCloseDrawer: { padding: 5, backgroundColor: '#1E0A24', borderRadius: 8, borderWidth: 1, borderColor: '#2D1436' },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  modalSubtitle: { color: '#888', fontSize: 12, marginTop: 4 },
  
  filtroSecaoTitulo: { color: '#B04FCF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 15, marginBottom: 10, letterSpacing: 1 },
  
  modalFiltroItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E0A24', paddingVertical: 14, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: '#2D1436', marginBottom: 10 },
  modalFiltroItemAtivo: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  
  checkboxMock: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#2D1436', marginRight: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0414' },
  
  modalFiltroTexto: { color: '#AAA', fontWeight: 'bold', fontSize: 14 },
  modalFiltroTextoAtivo: { color: '#FFF' },

  btnConcluirDrawer: { backgroundColor: '#00E676', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 15 },
  btnConcluirDrawerTexto: { color: '#0F0414', fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
});