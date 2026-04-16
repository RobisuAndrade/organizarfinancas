import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

  // Refs e Estados para Rolagem das Listas
  const scrollPgtoRef = useRef<ScrollView>(null);
  const scrollCatRef = useRef<ScrollView>(null);
  const [offsetPgto, setOffsetPgto] = useState(0);
  const [offsetCat, setOffsetCat] = useState(0);

  // Estados da Lista Principal
  const [listaGastos, setListaGastos] = useState<any[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<string | null>(null);

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

  // Carregar dados
  useEffect(() => {
    const gastosRef = ref(db, 'gastos');
    const unsubscribe = onValue(gastosRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const itens = Object.keys(dados).map(key => ({
          id: key,
          ...dados[key]
        }));
        itens.sort((a, b) => (a.pago === b.pago) ? 0 : a.pago ? 1 : -1);
        setListaGastos(itens);
      } else {
        setListaGastos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Cálculos Dinâmicos
  const numeroTotal = converterParaNumero(valorTotalGeral);
  const parcelasNum = parseInt(qtdParcelas) || 1;
  const valorParcela = isParcelado ? (numeroTotal / parcelasNum) : numeroTotal;

  const totalEstimadoMes = listaGastos.reduce((acc, item) => acc + converterParaNumero(item.subtotal), 0);
  const totalGastoMes = listaGastos.filter(i => i.pago).reduce((acc, item) => acc + converterParaNumero(item.subtotal), 0);

  // Botão Data de Hoje
  const preencherDataHoje = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
    setDataCompra(`${dd}/${mm}/${yyyy}`);
  };

  // Funções de Rolagem Horizontal Inteligente (Para PC/Web)
  const passoScroll = 220; // Quantidade de pixels que vai pular por clique

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

  // Funções de Banco de Dados
  const salvarGasto = async () => {
    if (!descricao || !valorTotalGeral || !dataCompra) {
      Alert.alert("Atenção", "Preencha a descrição, data e o valor total!");
      return;
    }

    const payload = {
      descricao,
      dataCompra,
      responsavel,
      pagamento,
      categoria,
      isFixo,
      isParcelado,
      qtdParcelas: isParcelado ? parcelasNum : 1,
      totalGeral: valorTotalGeral,
      subtotal: valorParcela.toFixed(2).replace('.', ','), 
      pago: false,
      dataRegistro: new Date().toISOString()
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
    try {
      await update(ref(db, `gastos/${id}`), { pago: !estadoAtual });
    } catch (error) {
      Alert.alert("Erro", "Erro ao atualizar status.");
    }
  };

  const confirmarExclusao = async (id: string, descItem: string) => {
    Alert.alert("Excluir Gasto", `Apagar "${descItem}" permanentemente?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => await remove(ref(db, `gastos/${id}`)) }
    ]);
  };

  const abrirEdicao = (item: any) => {
    setDescricao(item.descricao);
    setDataCompra(item.dataCompra);
    setResponsavel(item.responsavel);
    setPagamento(item.pagamento);
    setCategoria(item.categoria);
    setIsFixo(item.isFixo);
    setIsParcelado(item.isParcelado);
    setQtdParcelas(item.qtdParcelas.toString());
    setValorTotalGeral(item.totalGeral);
    
    setItemEditando(item.id);
    setFormAberto(true);
  };

  const fecharFormulario = () => {
    setDescricao(''); setDataCompra(''); setValorTotalGeral(''); setQtdParcelas('1');
    setIsFixo(false); setIsParcelado(false); setResponsavel('Robinho');
    setItemEditando(null); setFormAberto(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#B04FCF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.titulo}>Gestão de Gastos</Text>
            <Text style={styles.subtitulo}>Nossas contas e despesas</Text>
          </View>
        </View>

        {/* BOTÃO NOVO GASTO */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.toggleFormButton} onPress={() => formAberto ? fecharFormulario() : setFormAberto(true)}>
            <Feather name={formAberto ? "x" : "plus"} size={20} color="#FFF" />
            <Text style={styles.toggleFormText}>{formAberto ? "Cancelar Cadastro" : "Adicionar Novo Gasto"}</Text>
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

            {/* HEADER COM SETAS DE ROLAGEM PARA PAGAMENTO */}
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

            {/* HEADER COM SETAS DE ROLAGEM PARA CATEGORIAS */}
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

        {/* LISTA DE GASTOS */}
        <View style={styles.listArea}>
          {listaGastos.length === 0 && !formAberto ? (
            <View style={styles.emptyState}>
              <Feather name="folder-minus" size={50} color="#2D1436" />
              <Text style={styles.emptyStateText}>Nenhuma conta registrada.</Text>
            </View>
          ) : (
            <FlatList 
              data={listaGastos}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
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
          )}
        </View>

        {/* RODAPÉ DE TOTAIS */}
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
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  toggleFormButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#AA319C', padding: 15, borderRadius: 12, justifyContent: 'center' },
  toggleFormText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },

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
  
  // NOVOS ESTILOS PARA AS SETAS DE ROLAGEM
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
});