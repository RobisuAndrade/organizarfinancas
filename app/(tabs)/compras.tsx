import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Linking, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, push, ref, remove, set, update } from 'firebase/database';
import BotaoPadrao from '../../components/BotaoPadrao';
import { db } from '../../firebaseConfig';
import AvoidTeclado, { ScrollTeclado } from '../../components/AvoidTeclado';

// ----------------------------------------------------
// OPÇÕES DE CATEGORIZAÇÃO (COMPRAS)
// ----------------------------------------------------
const COMODOS = ['Geral', 'Cozinha', 'Quarto', 'Sala', 'Banheiro', 'Escritório', 'Varanda'];
const TIPOS_COMPRA = ['Obra/Reforma', 'Eletrodoméstico', 'Móvel', 'Decoração', 'Internet/Online', 'Outros'];

const ESTILO_TIPO: Record<string, { icone: any, cor: string }> = {
  'Obra/Reforma': { icone: 'tool', cor: '#FF7A00' },
  'Eletrodoméstico': { icone: 'zap', cor: '#00E676' },
  'Móvel': { icone: 'box', cor: '#3b82f6' },
  'Decoração': { icone: 'image', cor: '#ec4899' },
  'Internet/Online': { icone: 'shopping-cart', cor: '#B8A6FF' },
  'Outros': { icone: 'tag', cor: '#8A8D98' }
};

// ----------------------------------------------------
// OPÇÕES INTEGRADAS DA GESTÃO DE GASTOS
// ----------------------------------------------------
const CATEGORIAS_GASTOS = [
  'MERCADO', 'LAZER', 'AGUA', 'GÁS', 'ENERGIA', 'CONDOMINIO', 'SAUDE', 'FARMACIA', 
  'TELEFONE', 'INTERNET', 'MORADIA', 'CARRO', 'MOTO', 'TRANSPORTE', 'SEGUROS', 
  'FINANCIAMENTO', 'COTA', 'VESTUARIO', 'OUTROS', 'ASSINATURA', 'CURSOS', 
  'CUIDADOS PESSOAIS', 'DELIVERY', 'RESTAURANTE', 'VIAJENS', 'IMPOSTO', 
  'PADARIA', 'COMPRAS DA NET', 'EMPRESTIMO'
]; 

const METODOS_PAGAMENTO = ['NUBANK', 'INTER', 'BRADESCO', 'BOLETO', 'PIX', 'DINHEIRO', 'DEBITO'];
const RESPONSAVEIS = ['Robinho', 'Vanessinha'];

const CORES_BANCOS: { [key: string]: string } = {
  'NUBANK': '#8A05BE', 'INTER': '#FF7A00', 'BRADESCO': '#CC092F', 'BOLETO': '#8A8D98', 'PIX': '#32BCAD', 'DINHEIRO': '#00E676', 'DEBITO': '#555555'
};

// ----------------------------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------------------------
import { converterParaNumero, formatarData, formatarDataInput, formatarInputMoeda, formatarMoeda, mascarar } from '../../utils/formatadores';

export default function Compras() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [lista, setLista] = useState<any[]>([]); 
  const [formAberto, setFormAberto] = useState(false);
  const [modalFiltroAberto, setModalFiltroAberto] = useState(false);
  
  // Modais de Edição e Checklist
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  const [itensExpandidos, setItensExpandidos] = useState<string[]>([]);
  
  // ESTADOS DO NOVO CHECKOUT AUTOMÁTICO
  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);
  const [itemCheckout, setItemCheckout] = useState<any>(null);
  const [chkValor, setChkValor] = useState('');
  const [chkData, setChkData] = useState('');
  const [chkResp, setChkResp] = useState('Robinho');
  const [chkPgto, setChkPgto] = useState('NUBANK');
  const [chkCat, setChkCat] = useState('COMPRAS DA NET');
  const [chkParcelado, setChkParcelado] = useState(false);
  const [chkQtd, setChkQtd] = useState('1');

  // Estados do Formulário Padrão
  const [nome, setNome] = useState('');
  const [link, setLink] = useState('');
  const [prioridade, setPrioridade] = useState(3);
  const [comodo, setComodo] = useState('Geral');
  const [tipo, setTipo] = useState('Outros'); 
  const [valor, setValor] = useState(''); 
  const [valorPago, setValorPago] = useState(''); 
  const [busca, setBusca] = useState(''); 

  // Estados de Filtros
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);
  const [abaRapidaAtiva, setAbaRapidaAtiva] = useState('Todos');

  // --- NOVO: SISTEMA DE ALERTA E CONFIRMAÇÃO CUSTOMIZADO (Livre do Navegador) ---
  const [alertaConfig, setAlertaConfig] = useState({
    visivel: false,
    titulo: '',
    mensagem: '',
    tipo: 'alerta' as 'alerta' | 'confirmacao',
    onConfirm: () => {},
  });

  const exibirAlerta = (titulo: string, mensagem: string) => {
    setAlertaConfig({
      visivel: true,
      titulo,
      mensagem,
      tipo: 'alerta',
      onConfirm: () => setAlertaConfig(prev => ({ ...prev, visivel: false })),
    });
  };

  const exibirConfirmacao = (titulo: string, mensagem: string, acaoConfirmar: () => void) => {
    setAlertaConfig({
      visivel: true,
      titulo,
      mensagem,
      tipo: 'confirmacao',
      onConfirm: () => {
        setAlertaConfig(prev => ({ ...prev, visivel: false }));
        acaoConfirmar();
      },
    });
  };
  // -----------------------------------------------------------------------------

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnimUp = useRef(new Animated.Value(30)).current;
  const slideAnimFiltro = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Lógica do Cabeçalho e Rodapé Retráteis
  const headerDiffClamp = Animated.diffClamp(scrollY, 0, 100);
  const footerDiffClamp = Animated.diffClamp(scrollY, 0, 120);

  const headerTranslateY = headerDiffClamp.interpolate({ inputRange: [0, 100], outputRange: [0, -100], extrapolate: 'clamp' });
  const footerTranslateY = footerDiffClamp.interpolate({ inputRange: [0, 120], outputRange: [0, 120], extrapolate: 'clamp' });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnimUp, { toValue: 0, duration: 800, useNativeDriver: true })
    ]).start();

    const listaRef = ref(db, 'compras');
    const unsubscribe = onValue(listaRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const itens = Object.keys(dados).map(key => ({ id: key, ...dados[key] }));
        setLista(itens);
      } else {
        setLista([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Veio direto da Home ("A Pagar"/"Na Lista") já pedindo um status específico
  useEffect(() => {
    if (params.status && typeof params.status === 'string') {
      setFiltrosAtivos([params.status]);
    }
  }, [params.status]);

  const listaFiltrada = lista.filter(item => {
    if (busca.trim() !== '' && !item.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    
    const passaAbaRapida = abaRapidaAtiva === 'Todos' ? true : (item.tipo || 'Outros') === abaRapidaAtiva;
    if (!passaAbaRapida) return false;

    if (filtrosAtivos.length === 0) return true;

    const temFiltroStatus = filtrosAtivos.some(f => ['PENDENTE', 'COMPRADO'].includes(f));
    const temFiltroPrioridade = filtrosAtivos.some(f => f.includes('⭐'));
    const temFiltroComodo = filtrosAtivos.some(f => COMODOS.includes(f));
    const temFiltroTipo = filtrosAtivos.some(f => TIPOS_COMPRA.includes(f));

    const passaStatus = temFiltroStatus ? (filtrosAtivos.includes('COMPRADO') && item.comprado) || (filtrosAtivos.includes('PENDENTE') && !item.comprado) : true;
    const passaPrioridade = temFiltroPrioridade ? filtrosAtivos.includes(`${item.prioridade} ⭐`) : true;
    const passaComodo = temFiltroComodo ? filtrosAtivos.includes(item.comodo) : true;
    const passaTipo = temFiltroTipo ? filtrosAtivos.includes(item.tipo || 'Outros') : true;

    return passaStatus && passaPrioridade && passaComodo && passaTipo;
  }).sort((a, b) => (a.comprado === b.comprado) ? 0 : a.comprado ? 1 : -1);

  const totais = listaFiltrada.reduce((acc, item) => {
    const valorEstimado = converterParaNumero(item.valor);
    let valorGasto = 0;
    if (item.comprado) {
      valorGasto = converterParaNumero(item.valorPago || item.valor);
    }
    return { estimado: acc.estimado + valorEstimado, gasto: acc.gasto + valorGasto };
  }, { estimado: 0, gasto: 0 });

  const toggleFiltro = (filtro: string) => setFiltrosAtivos(prev => prev.includes(filtro) ? prev.filter(f => f !== filtro) : [...prev, filtro]);
  const limparFiltros = () => setFiltrosAtivos([]);
  const abrirFiltros = () => {
    setModalFiltroAberto(true);
    Animated.timing(slideAnimFiltro, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };
  const fecharFiltros = () => Animated.timing(slideAnimFiltro, { toValue: Dimensions.get('window').width, duration: 300, useNativeDriver: true }).start(() => setModalFiltroAberto(false));

  const preencherDataHojeCheckout = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
    setChkData(`${dd}/${mm}/${yyyy}`);
  };

  const preencherDataHojeEdicao = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
  };

  const abrirEdicao = (item: any) => {
    setNome(item.nome);
    setValor(item.valor || '');
    setValorPago(item.valorPago || '');
    setLink(item.link || '');
    setPrioridade(item.prioridade);
    setComodo(item.comodo);
    setTipo(item.tipo || 'Outros'); 
    setItemEditando(item.id); 
    setFormAberto(true);      
  };

  const fecharFormulario = () => {
    setNome(''); setLink(''); setValor(''); setValorPago(''); setPrioridade(3); setComodo('Geral'); setTipo('Outros');
    setItemEditando(null); 
    setFormAberto(false);
  };

  const salvarItem = async () => {
    if (nome.trim().length === 0) {
      exibirAlerta("Atenção", "O nome do item é obrigatório!");
      return;
    }
    try {
      const payload = {
        nome, link, prioridade, comodo, tipo,
        valor: valor || '0,00',
        valorPago: valorPago || '' 
      };

      if (itemEditando) {
        await update(ref(db, `compras/${itemEditando}`), payload);
      } else {
        const novoItem = { ...payload, comprado: false, dataCriacao: new Date().toISOString() };
        await set(push(ref(db, 'compras')), novoItem);
      }
      fecharFormulario();
    } catch (error) { 
      exibirAlerta("Erro", "Erro ao salvar o item.");
    }
  };

  // ----------------------------------------------------
  // LÓGICA DE CHECKOUT REVERSA (INTEGRAÇÃO COM GASTOS)
  // ----------------------------------------------------
  const processarDesfazerCompra = async (item: any) => {
    try {
      // 1. Se existe o ID do gasto vinculado, apaga da Gestão de Gastos
      if (item.gastoVinculadoId) {
        await remove(ref(db, `gastos/${item.gastoVinculadoId}`));
      }
      
      // 2. Atualiza a compra voltando para pendente, removendo o vinculo e zerando o valor pago
      await update(ref(db, `compras/${item.id}`), { 
        comprado: false,
        gastoVinculadoId: null,
        valorPago: '' 
      });
      
    } catch (error) {
      exibirAlerta("Erro", "Falha ao desfazer a compra e apagar o gasto.");
    }
  };

  const alternarComprado = async (item: any) => {
    if (item.comprado) {
      // Usando o componente customizado de confirmação, totalmente imune ao navegador web
      exibirConfirmacao(
        "Desfazer Compra?",
        "O item voltará para a lista de pendentes e a despesa gerada na 'Gestão de Gastos' será APAGADA permanentemente. Confirmar?",
        () => processarDesfazerCompra(item)
      );
    } else {
      // Abre checkout
      setItemCheckout(item);
      setChkValor(item.valor || '');
      preencherDataHojeCheckout();
      setChkResp('Robinho');
      setChkPgto('NUBANK');
      setChkCat(item.tipo === 'Obra/Reforma' ? 'MORADIA' : 'COMPRAS DA NET'); 
      setChkParcelado(false);
      setChkQtd('1');
      setModalCheckoutAberto(true);
    }
  };

  const confirmarCheckoutEGerarGasto = async () => {
    if (!itemCheckout) return;
    const valorNum = converterParaNumero(chkValor);
    
    if (valorNum <= 0 || !chkData) {
      exibirAlerta("Atenção", "Preencha o valor real pago e a data da compra!");
      return;
    }

    const parcelasNum = parseInt(chkQtd) || 1;
    const valorParcela = chkParcelado ? (valorNum / parcelasNum) : valorNum;

    const novoGasto = {
      descricao: itemCheckout.nome, 
      dataCompra: chkData,
      responsavel: chkResp,
      pagamento: chkPgto,
      categoria: chkCat,
      isFixo: false, 
      isParcelado: chkParcelado,
      qtdParcelas: chkParcelado ? parcelasNum : 1,
      totalGeral: chkValor,
      subtotal: valorParcela.toFixed(2).replace('.', ','),
      pago: false, 
      dataRegistro: new Date().toISOString()
    };

    try {
      // 1. Gera a referência do novo gasto para podermos guardar a chave (ID)
      const novoGastoRef = push(ref(db, 'gastos'));
      const idGastoGerado = novoGastoRef.key;

      // 2. Salva o novo gasto no Firebase
      await set(novoGastoRef, novoGasto);
      
      // 3. Atualiza o item de compra salvando o vínculo (ID) para podermos desfazer depois
      await update(ref(db, `compras/${itemCheckout.id}`), { 
        comprado: true,
        valorPago: chkValor,
        gastoVinculadoId: idGastoGerado
      });

      exibirAlerta("Sucesso!", "Compra confirmada e despesa lançada na sua Gestão de Gastos.");

      setModalCheckoutAberto(false);
      setItemCheckout(null);
    } catch(e) {
      exibirAlerta("Erro", "Falha ao registrar a compra e o gasto.");
    }
  };

  const confirmarExclusao = (id: string, nomeItem: string) => {
    exibirConfirmacao(
      "Excluir Item", 
      `Tem certeza que deseja apagar "${nomeItem}" da lista?`, 
      async () => await remove(ref(db, `compras/${id}`))
    );
  };

  const abrirLink = (url: string) => {
    if(url) Linking.openURL(url).catch(() => exibirAlerta("Erro", "Link inválido"));
  };

  const alternarDetalhes = (id: string) => {
    if (itensExpandidos.includes(id)) setItensExpandidos(itensExpandidos.filter(itemId => itemId !== id));
    else setItensExpandidos([...itensExpandidos, id]);
  };

  const renderizarEstrelas = (qtd: number, interativo = false, onSelect?: (n: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity activeOpacity={0.8} key={star} disabled={!interativo} onPress={() => interativo && onSelect && onSelect(star)}>
            <Feather name="star" size={interativo ? 24 : 14} color={star <= qtd ? "#FFD700" : "#444"} style={styles.starIcon} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainWrapper}>
        
        {/* ÁREA DE ROLAGEM COM ANIMATED FLATLIST */}
        <Animated.View style={[styles.listArea, { opacity: fadeAnim, transform: [{ translateY: slideAnimUp }] }]}>
          <Animated.FlatList 
            data={listaFiltrada}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 140, paddingBottom: 170, flexGrow: 1 }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            
            ListHeaderComponent={
              <View style={{ paddingBottom: 10 }}>
                {/* BARRA DE PESQUISA */}
                <View style={styles.searchRow}>
                  <View style={styles.searchContainer}>
                    <Feather name="search" size={18} color="#B8A6FF" style={styles.searchIcon} />
                    <TextInput 
                      style={styles.searchInput}
                      placeholder="Pesquisar item..."
                      placeholderTextColor="#8A8D98"
                      value={busca}
                      onChangeText={setBusca}
                    />
                    {busca.length > 0 && (
                      <TouchableOpacity onPress={() => setBusca('')} style={styles.clearSearchButton}>
                        <Feather name="x" size={16} color="#8A8D98" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity activeOpacity={0.8} style={[styles.filterButton, filtrosAtivos.length > 0 && styles.filterButtonAtivo]} onPress={abrirFiltros}>
                    <Feather name="sliders" size={20} color={filtrosAtivos.length > 0 ? "#D4FF3A" : "#F4F5F7"} />
                    {filtrosAtivos.length > 0 && (
                      <View style={styles.filterActiveDot}><Text style={styles.filterBadgeText}>{filtrosAtivos.length}</Text></View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* BOTÃO DE AÇÃO E ABAS RÁPIDAS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickTabsScroll}>
                  <TouchableOpacity activeOpacity={0.8} style={styles.quickAddBtn} onPress={() => setFormAberto(true)}>
                    <Feather name="plus" size={16} color="#0B0B0F" style={{marginRight: 4}}/>
                    <Text style={styles.quickAddText}>Novo</Text>
                  </TouchableOpacity>

                  <View style={styles.quickDivider} />

                  <TouchableOpacity 
                    activeOpacity={0.8} 
                    style={[styles.quickTab, abaRapidaAtiva === 'Todos' && styles.quickTabActive]}
                    onPress={() => setAbaRapidaAtiva('Todos')}
                  >
                    <Text style={[styles.quickTabText, abaRapidaAtiva === 'Todos' && styles.quickTabTextActive]}>Todos</Text>
                  </TouchableOpacity>

                  {TIPOS_COMPRA.map(t => {
                    const isActive = abaRapidaAtiva === t;
                    const infoTipo = ESTILO_TIPO[t];
                    return (
                      <TouchableOpacity 
                        key={t}
                        activeOpacity={0.8} 
                        style={[styles.quickTab, isActive && { backgroundColor: `${infoTipo.cor}15`, borderColor: infoTipo.cor }]}
                        onPress={() => setAbaRapidaAtiva(t)}
                      >
                        <Feather name={infoTipo.icone} size={12} color={isActive ? infoTipo.cor : '#8A8D98'} style={{ marginRight: 6 }} />
                        <Text style={[styles.quickTabText, isActive && { color: infoTipo.cor, fontWeight: '900' }]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            }

            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="shopping-cart" size={50} color="#2A2B34" />
                <Text style={styles.emptyStateText}>Nenhum item encontrado.</Text>
                {(filtrosAtivos.length > 0 || abaRapidaAtiva !== 'Todos') && (
                  <TouchableOpacity onPress={() => { limparFiltros(); setAbaRapidaAtiva('Todos'); }} style={{marginTop: 15, padding: 10}}>
                    <Text style={{color: '#D4FF3A', fontWeight: 'bold'}}>Limpar Filtros</Text>
                  </TouchableOpacity>
                )}
              </View>
            }

            renderItem={({ item }) => {
              const valorFinal = item.comprado && item.valorPago ? item.valorPago : (item.valor || '0,00');
              const isExpandido = itensExpandidos.includes(item.id);
              const infoTipo = ESTILO_TIPO[item.tipo || 'Outros'] || ESTILO_TIPO['Outros'];

              return (
                <View style={[styles.itemCard, item.comprado && styles.itemCardComprado]}>
                  <View style={styles.itemHeader}>
                    <TouchableOpacity style={[styles.checkbox, item.comprado && styles.checkboxMarcado]} onPress={() => alternarComprado(item)}>
                      {item.comprado && <Feather name="check" size={14} color="#F4F5F7" />}
                    </TouchableOpacity>
                    
                    <View style={styles.itemTitleArea}>
                      <Text style={[styles.itemTexto, item.comprado && styles.itemTextoRiscado]} numberOfLines={2}>{item.nome}</Text>
                      {renderizarEstrelas(item.prioridade)}

                      <TouchableOpacity style={styles.detalhesToggleMini} onPress={() => alternarDetalhes(item.id)}>
                        <Text style={styles.detalhesToggleMiniText}>{isExpandido ? "Ocultar detalhes" : "Ver detalhes"}</Text>
                        <Feather name={isExpandido ? "chevron-up" : "chevron-down"} size={12} color="#8A8D98" />
                      </TouchableOpacity>

                      {isExpandido && (
                        <View style={styles.detalhesBox}>
                          <Text style={styles.detalheData}>
                            <Feather name="calendar" size={10} color="#8A8D98" /> Adicionado em: {formatarData(item.dataCriacao)}
                          </Text>
                          <View style={styles.detalhesValoresRow}>
                            <Text style={styles.detalheTexto}>Estimado: <Text style={styles.detalheNumero}>{mascarar(`R$ ${item.valor || '0,00'}`)}</Text></Text>
                            {item.valorPago ? (
                              <Text style={styles.detalheTextoDestaque}>Pago: <Text style={styles.detalheNumeroDestaque}>{mascarar(`R$ ${item.valorPago}`)}</Text></Text>
                            ) : null}
                          </View>
                        </View>
                      )}
                    </View>
                    
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.badgeComodo, { backgroundColor: `${infoTipo.cor}15`, borderColor: `${infoTipo.cor}40` }]}>
                        <Feather name={infoTipo.icone} size={10} color={infoTipo.cor} style={{marginRight: 4}} />
                        <Text style={[styles.badgeComodoText, { color: infoTipo.cor }]}>{item.tipo || 'Outros'}</Text>
                      </View>
                      <View style={[styles.badgeComodo, { marginTop: 4 }]}>
                        <Text style={styles.badgeComodoText}>{item.comodo}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.itemFooter}>
                    <Text style={[styles.valorTextoFinal, item.comprado && { color: '#00E676' }]}>
                      {mascarar(`R$ ${valorFinal}`)}
                    </Text>
                    
                    <View style={styles.footerActions}>
                      {item.link ? (
                        <TouchableOpacity style={styles.linkButton} onPress={() => abrirLink(item.link)}>
                          <Feather name="external-link" size={14} color="#B8A6FF" />
                          <Text style={styles.linkButtonText}>LINK</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.noLinkText}>Sem link</Text>
                      )}

                      <TouchableOpacity style={styles.editButton} onPress={() => abrirEdicao(item)}>
                        <Feather name="edit-2" size={16} color="#D4FF3A" />
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.deleteButton} onPress={() => confirmarExclusao(item.id, item.nome)}>
                        <Feather name="trash-2" size={16} color="#FF3B5C" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </Animated.View>

        {/* CABEÇALHO FLUTUANTE */}
        <Animated.View style={[styles.headerFlutuante, { transform: [{ translateY: headerTranslateY }] }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#D4FF3A" />
            </TouchableOpacity>
            <View>
              <Text style={styles.titulo}>Para a Nossa Casa</Text>
              <Text style={styles.subtitulo}>{listaFiltrada.length} itens encontrados</Text>
            </View>
          </View>
        </Animated.View>

        {/* RODAPÉ DE TOTAIS FLUTUANTE */}
        <Animated.View style={[styles.rodapeFlutuante, { transform: [{ translateY: footerTranslateY }] }]}>
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
        </Animated.View>

        {/* MODAL DO FORMULÁRIO PADRÃO (NOVA COMPRA/EDIÇÃO) */}
        <Modal visible={formAberto} animationType="slide" transparent>
          <View style={styles.modalFullOverlay}>
            <AvoidTeclado style={{ justifyContent: 'flex-end' }}>
              <View style={styles.formModalContainer}>
                <View style={styles.formModalHeader}>
                  <Text style={styles.formTitle}>{itemEditando ? "Editando Item" : "Novo Item"}</Text>
                  <TouchableOpacity onPress={fecharFormulario} style={styles.closeModalButton}>
                    <Feather name="x" size={24} color="#F4F5F7" />
                  </TouchableOpacity>
                </View>

                <ScrollTeclado showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                  <Text style={styles.inputLabelMicro}>O que vamos comprar?</Text>
                  <TextInput style={styles.input} placeholder="Ex: Cimento, Geladeira..." placeholderTextColor="#8A8D98" value={nome} onChangeText={setNome} />
                  
                  <View style={styles.rowInputs}>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabelMicro}>Estimado (R$)</Text>
                      <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#8A8D98" value={valor} onChangeText={(txt) => setValor(formatarInputMoeda(txt))} keyboardType="numeric" />
                    </View>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabelMicro}>Pago (R$)</Text>
                      <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#8A8D98" value={valorPago} onChangeText={(txt) => setValorPago(formatarInputMoeda(txt))} keyboardType="numeric" />
                    </View>
                  </View>

                  <Text style={styles.inputLabelMicro}>Link da Loja (Opcional)</Text>
                  <TextInput style={styles.input} placeholder="https://..." placeholderTextColor="#8A8D98" value={link} onChangeText={setLink} autoCapitalize="none" />
                  
                  <Text style={styles.label}>Prioridade (Urgência)</Text>
                  {renderizarEstrelas(prioridade, true, setPrioridade)}
                  
                  <Text style={styles.label}>Tipo de Compra</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.comodosScroll}>
                    {TIPOS_COMPRA.map((t) => {
                      const isActive = tipo === t;
                      const infoTipo = ESTILO_TIPO[t];
                      return (
                        <TouchableOpacity key={t} style={[styles.comodoTag, isActive && { backgroundColor: infoTipo.cor, borderColor: infoTipo.cor }]} onPress={() => setTipo(t)}>
                          <Feather name={infoTipo.icone} size={14} color={isActive ? "#0B0B0F" : "#8A8D98"} style={{marginRight: 6}} />
                          <Text style={[styles.comodoTagText, isActive && { color: '#0B0B0F', fontWeight: '900' }]}>{t}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>

                  <Text style={styles.label}>Para qual cômodo?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.comodosScroll}>
                    {COMODOS.map((c) => (
                      <TouchableOpacity key={c} style={[styles.comodoTag, comodo === c && styles.comodoTagActive]} onPress={() => setComodo(c)}>
                        <Text style={[styles.comodoTagText, comodo === c && styles.comodoTagTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <BotaoPadrao 
                    titulo={itemEditando ? "Atualizar Item" : "Salvar Item"} 
                    onPress={salvarItem} 
                    style={{ marginTop: 10 }}
                  />

                </ScrollTeclado>
              </View>
            </AvoidTeclado>
          </View>
        </Modal>

        {/* --- NOVO: MODAL DE CHECKOUT (GERAR GASTO) --- */}
        <Modal visible={modalCheckoutAberto} animationType="slide" transparent>
          <View style={styles.modalFullOverlay}>
            <AvoidTeclado style={{ justifyContent: 'flex-end' }}>
              <View style={styles.formModalContainer}>
                
                <View style={styles.formModalHeader}>
                  <View>
                    <Text style={styles.formTitle}>Registrar Despesa</Text>
                    <Text style={{color: '#00E676', fontSize: 12, marginTop: 4, fontWeight: 'bold'}}>{itemCheckout?.nome}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setModalCheckoutAberto(false)} style={styles.closeModalButton}>
                    <Feather name="x" size={24} color="#F4F5F7" />
                  </TouchableOpacity>
                </View>

                <ScrollTeclado showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                  <View style={styles.rowInputs}>
                    <View style={[styles.inputWrapper, { width: '48%' }]}>
                      <Text style={styles.inputLabelMicro}>Valor Real Pago</Text>
                      <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#8A8D98" value={chkValor} onChangeText={(txt) => setChkValor(formatarInputMoeda(txt))} keyboardType="numeric" />
                    </View>
                    <View style={[styles.inputWrapper, { width: '48%' }]}>
                      <Text style={styles.inputLabelMicro}>Data</Text>
                      <View style={styles.dataContainer}>
                        <TextInput style={[styles.input, { paddingRight: 40, marginBottom: 0 }]} placeholder="DD/MM/AA" placeholderTextColor="#8A8D98" value={chkData} onChangeText={(txt) => setChkData(formatarDataInput(txt))} keyboardType="number-pad" maxLength={10} />
                        <TouchableOpacity style={styles.iconDataHoje} onPress={preencherDataHojeCheckout}><Feather name="calendar" size={18} color="#D4FF3A" /></TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.inputLabelMicro}>Quem pagou?</Text>
                  <View style={styles.tagsContainer}>
                    {RESPONSAVEIS.map(resp => (
                      <TouchableOpacity key={resp} style={[styles.tagNormal, chkResp === resp && styles.tagRespAtiva]} onPress={() => setChkResp(resp)}>
                        <Text style={[styles.tagTexto, chkResp === resp && styles.tagTextoAtiva]}>{resp}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.switchesContainer}>
                    <TouchableOpacity style={[styles.switchBox, chkParcelado && styles.switchAtivoParcela]} onPress={() => { setChkParcelado(!chkParcelado); if(chkParcelado) setChkQtd('1'); }}>
                      <Feather name="layers" size={16} color={chkParcelado ? "#F4F5F7" : "#8A8D98"} style={{marginRight: 6}} />
                      <Text style={[styles.switchTexto, chkParcelado && styles.switchTextoAtivo]}>Foi Parcelado?</Text>
                    </TouchableOpacity>
                  </View>

                  {chkParcelado && (
                    <View style={styles.parcelaBox}>
                      <Text style={styles.inputLabelMicro}>Quantidade de Parcelas</Text>
                      <TextInput style={styles.input} placeholder="Ex: 12" placeholderTextColor="#8A8D98" value={chkQtd} onChangeText={setChkQtd} keyboardType="number-pad" />
                      <View style={styles.calculoAoVivoBox}>
                        <Text style={styles.calculoTexto}>Valor por parcela:</Text>
                        <Text style={styles.calculoValor}>{formatarMoeda(converterParaNumero(chkValor) / (parseInt(chkQtd) || 1))}</Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.inputLabelMicro}>Como pagou?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                    {METODOS_PAGAMENTO.map(metodo => (
                      <TouchableOpacity key={metodo} style={[styles.tagNormal, chkPgto === metodo && { backgroundColor: CORES_BANCOS[metodo], borderColor: CORES_BANCOS[metodo] }]} onPress={() => setChkPgto(metodo)}>
                        <Text style={[styles.tagTexto, chkPgto === metodo && styles.tagTextoAtiva]}>{metodo}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabelMicro}>Categoria do Gasto</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }}>
                    {CATEGORIAS_GASTOS.map(cat => (
                      <TouchableOpacity key={cat} style={[styles.tagNormal, chkCat === cat && { backgroundColor: '#00E676', borderColor: '#00E676' }]} onPress={() => setChkCat(cat)}>
                        <Text style={[styles.tagTexto, chkCat === cat && { color: '#0B0B0F' }]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <BotaoPadrao 
                    titulo="Confirmar e Lançar Gasto" 
                    icone="check-circle" 
                    onPress={confirmarCheckoutEGerarGasto} 
                    style={{ marginTop: 5 }}
                  />

                </ScrollTeclado>
              </View>
            </AvoidTeclado>
          </View>
        </Modal>

        {/* MODAL DE FILTROS (BOTTOM SHEET) */}
        <Modal visible={modalFiltroAberto} animationType="slide" transparent>
          <View style={styles.modalFullOverlay}>
            <View style={styles.bottomSheetContainer}>
              
              <View style={styles.formModalHeader}>
                <View>
                  <Text style={styles.formTitle}>Filtros da Lista</Text>
                  <Text style={{color: '#8A8D98', fontSize: 12, marginTop: 2}}>Encontre o que precisa</Text>
                </View>
                <TouchableOpacity onPress={() => setModalFiltroAberto(false)} style={styles.closeModalButton}>
                  <Feather name="x" size={24} color="#F4F5F7" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                
                <Text style={styles.inputLabelMicro}>Status da Compra</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity style={[styles.chipPill, filtrosAtivos.includes('PENDENTE') && { backgroundColor: '#FF3B5C', borderColor: '#FF3B5C' }]} onPress={() => toggleFiltro('PENDENTE')}>
                    <Text style={[styles.chipTexto, filtrosAtivos.includes('PENDENTE') && { color: '#F4F5F7' }]}>Falta Comprar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chipPill, filtrosAtivos.includes('COMPRADO') && { backgroundColor: '#00E676', borderColor: '#00E676' }]} onPress={() => toggleFiltro('COMPRADO')}>
                    <Text style={[styles.chipTexto, filtrosAtivos.includes('COMPRADO') && { color: '#0B0B0F' }]}>Já Comprado</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabelMicro}>Tipo de Compra</Text>
                <View style={styles.chipsWrap}>
                  {TIPOS_COMPRA.map(t => {
                    const isAtivo = filtrosAtivos.includes(t);
                    const cor = ESTILO_TIPO[t].cor;
                    return (
                      <TouchableOpacity key={t} style={[styles.chipPill, isAtivo && { backgroundColor: `${cor}15`, borderColor: cor }]} onPress={() => toggleFiltro(t)}>
                        <Text style={[styles.chipTexto, isAtivo && { color: cor }]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.inputLabelMicro}>Prioridade</Text>
                <View style={styles.chipsWrap}>
                  {[1, 2, 3, 4, 5].map(prio => {
                    const label = `${prio} ⭐`;
                    const isAtivo = filtrosAtivos.includes(label);
                    return (
                      <TouchableOpacity key={prio} style={[styles.chipPill, isAtivo && { backgroundColor: '#FFD70015', borderColor: '#FFD700' }]} onPress={() => toggleFiltro(label)}>
                        <Text style={[styles.chipTexto, isAtivo && { color: '#FFD700' }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                
                <Text style={styles.inputLabelMicro}>Cômodo</Text>
                <View style={styles.chipsWrap}>
                  {COMODOS.map(c => (
                    <TouchableOpacity key={c} style={[styles.chipPill, filtrosAtivos.includes(c) && { backgroundColor: '#D4FF3A20', borderColor: '#D4FF3A' }]} onPress={() => toggleFiltro(c)}>
                      <Text style={[styles.chipTexto, filtrosAtivos.includes(c) && { color: '#D4FF3A' }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
              </ScrollView>

              <View style={styles.filterActionFooter}>
                <TouchableOpacity style={styles.btnLimparFiltros} onPress={limparFiltros}>
                  <Text style={styles.btnLimparTexto}>Limpar Tudo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnAplicarFiltros} onPress={() => setModalFiltroAberto(false)}>
                  <Text style={styles.btnAplicarTexto}>Aplicar Filtros</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>

        {/* --- MODAL DE ALERTA/CONFIRMAÇÃO CUSTOMIZADO --- */}
        <Modal visible={alertaConfig.visivel} transparent animationType="fade">
          <View style={styles.modalFullOverlayCentro}>
            <View style={styles.alertaContainer}>
              <Text style={styles.alertaTitulo}>{alertaConfig.titulo}</Text>
              <Text style={styles.alertaMensagem}>{alertaConfig.mensagem}</Text>
              <View style={styles.alertaBotoes}>
                {alertaConfig.tipo === 'confirmacao' && (
                  <TouchableOpacity style={styles.alertaBtnCancelar} onPress={() => setAlertaConfig({ ...alertaConfig, visivel: false })}>
                    <Text style={styles.alertaBtnCancelarTexto}>Cancelar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.alertaBtnConfirmar} onPress={alertaConfig.onConfirm}>
                  <Text style={styles.alertaBtnConfirmarTexto}>OK</Text>
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
  safeArea: { flex: 1, backgroundColor: '#0B0B0F' },
  mainWrapper: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  
  // Elementos Flutuantes
  headerFlutuante: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0B0B0F',
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
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1C1D25', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2A2B34' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#F4F5F7' },
  subtitulo: { fontSize: 12, color: '#8A8D98', marginTop: 2 },
  
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1D25', borderRadius: 16, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#2A2B34' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#F4F5F7', fontSize: 15, outlineStyle: 'none' } as any, // outlineStyle as any prevents TS errors while working on web
  clearSearchButton: { padding: 5 },

  filterButton: { position: 'relative', width: 50, height: 50, backgroundColor: '#1C1D25', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2B34' },
  filterButtonAtivo: { borderColor: '#D4FF3A', backgroundColor: '#D4FF3A20' }, 
  filterActiveDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B5C' },
  filterBadgeText: { color: '#F4F5F7', fontSize: 10, fontWeight: 'bold', textAlign: 'center' },

  quickTabsScroll: { flexDirection: 'row', alignItems: 'center', paddingRight: 20, marginBottom: 10 },
  quickAddBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D4FF3A', paddingHorizontal: 16, height: 40, borderRadius: 20 },
  quickAddText: { color: '#0B0B0F', fontWeight: 'bold', fontSize: 13 },
  quickDivider: { width: 1, height: 20, backgroundColor: '#2A2B34', marginHorizontal: 12 },
  quickTab: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1D25', paddingHorizontal: 16, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#2A2B34', marginRight: 8 },
  quickTabActive: { backgroundColor: '#D4FF3A20', borderColor: '#D4FF3A' },
  quickTabText: { color: '#8A8D98', fontWeight: 'bold', fontSize: 13 },
  quickTabTextActive: { color: '#D4FF3A' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  emptyStateText: { color: '#8A8D98', fontSize: 16, marginTop: 15, fontWeight: '500' },
  listArea: { flex: 1, paddingHorizontal: 20 },

  itemCard: { backgroundColor: '#1C1D25', padding: 20, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#2A2B34', shadowColor: '#D4FF3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  itemCardComprado: { opacity: 0.6, borderColor: '#00E67640' }, 
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#D4FF3A', justifyContent: 'center', alignItems: 'center', marginRight: 15, marginTop: 2 },
  checkboxMarcado: { backgroundColor: '#00E676', borderColor: '#00E676' },
  itemTitleArea: { flex: 1, paddingRight: 10 },
  itemTexto: { fontSize: 18, color: '#F4F5F7', fontWeight: 'bold', marginBottom: 6 },
  itemTextoRiscado: { textDecorationLine: 'line-through', color: '#8A8D98' },
  
  detalhesToggleMini: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 4 },
  detalhesToggleMiniText: { fontSize: 12, color: '#8A8D98', marginRight: 6, fontWeight: '600', textTransform: 'uppercase' },
  detalhesBox: { backgroundColor: '#0B0B0F', padding: 15, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: '#2A2B34' },
  detalheData: { color: '#8A8D98', fontSize: 10, marginBottom: 8, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 0.5 },
  detalhesValoresRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detalheTexto: { color: '#8A8D98', fontSize: 12, fontWeight: '600' },
  detalheNumero: { color: '#8A8D98', fontWeight: 'bold' },
  detalheTextoDestaque: { color: '#00E676', fontSize: 12, fontWeight: 'bold' },
  detalheNumeroDestaque: { color: '#00E676', fontWeight: '900' },
  
  badgeComodo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D4FF3A20', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D4FF3A40' },
  badgeComodoText: { color: '#D4FF3A', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2A2B34' },
  valorTextoFinal: { fontSize: 20, color: '#F4F5F7', fontWeight: '900', marginRight: 10 },
  
  footerActions: { flexDirection: 'row', alignItems: 'center' },
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#B8A6FF15', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#B8A6FF40', marginRight: 10 },
  linkButtonText: { color: '#B8A6FF', fontSize: 11, fontWeight: '900', marginLeft: 6, letterSpacing: 0.5 },
  noLinkText: { color: '#8A8D98', fontSize: 11, fontStyle: 'italic', marginRight: 10 },
  editButton: { padding: 10, backgroundColor: '#D4FF3A15', borderRadius: 10, borderWidth: 1, borderColor: '#D4FF3A30', marginRight: 10 },
  deleteButton: { padding: 10, backgroundColor: '#FF3B5C15', borderRadius: 10, borderWidth: 1, borderColor: '#FF3B5C30' },

  subtotalContainer: { backgroundColor: '#1C1D25', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#2A2B34', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#D4FF3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  subtotalColumn: { alignItems: 'center', flex: 1 },
  subtotalDivider: { width: 1, backgroundColor: '#2A2B34', height: '80%' },
  subtotalLabel: { color: '#8A8D98', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  subtotalValueEstimado: { color: '#8A8D98', fontSize: 20, fontWeight: '900' },
  subtotalLabelGasto: { color: '#00E676', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  subtotalValueGasto: { color: '#00E676', fontSize: 20, fontWeight: '900' },

  modalFullOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  formModalContainer: { backgroundColor: '#1C1D25', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%', borderWidth: 1, borderColor: '#2A2B34' },
  formModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  closeModalButton: { padding: 8, backgroundColor: '#0B0B0F', borderRadius: 12 },
  formTitle: { color: '#F4F5F7', fontWeight: 'bold', fontSize: 20 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  inputWrapper: { width: '48%' },
  inputLabelMicro: { color: '#D4FF3A', fontSize: 11, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 1 },
  
  dataContainer: { position: 'relative', justifyContent: 'center', marginBottom: 20 },
  input: { height: 55, backgroundColor: '#0B0B0F', borderRadius: 14, paddingHorizontal: 15, fontSize: 16, color: '#F4F5F7', borderWidth: 1, borderColor: '#2A2B34', marginBottom: 20 },
  iconDataHoje: { position: 'absolute', right: 15, top: 18 },

  label: { color: '#D4FF3A', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase', marginBottom: 10, marginTop: 5, letterSpacing: 1 },
  starsContainer: { flexDirection: 'row', marginBottom: 20 }, 
  starIcon: { marginRight: 8 },
  comodosScroll: { flexDirection: 'row', marginBottom: 30 },
  comodoTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B0B0F', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#2A2B34', marginRight: 10 },
  comodoTagActive: { backgroundColor: '#D4FF3A', borderColor: '#D4FF3A' },
  comodoTagText: { color: '#8A8D98', fontWeight: 'bold', fontSize: 13 },
  comodoTagTextActive: { color: '#0B0B0F' },

  tagsContainer: { flexDirection: 'row', marginBottom: 20 },
  tagNormal: { backgroundColor: '#0B0B0F', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34', marginRight: 10 },
  tagTexto: { color: '#8A8D98', fontWeight: 'bold', fontSize: 12 },
  tagTextoAtiva: { color: '#F4F5F7' },
  tagRespAtiva: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }, 
  
  switchesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  switchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0B0F', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34', marginHorizontal: 4 },
  switchAtivoParcela: { backgroundColor: '#00E676', borderColor: '#00E676' },
  switchTexto: { color: '#8A8D98', fontWeight: 'bold', fontSize: 12 },
  switchTextoAtivo: { color: '#0B0B0F', fontWeight: '900' },
  parcelaBox: { backgroundColor: '#0B0B0F', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2A2B34', marginBottom: 20 },
  calculoAoVivoBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1D25', padding: 15, borderRadius: 12, marginTop: 5 },
  calculoTexto: { color: '#D4FF3A', fontSize: 12, fontWeight: 'bold' },
  calculoValor: { color: '#F4F5F7', fontSize: 18, fontWeight: '900' },

  bottomSheetContainer: { backgroundColor: '#1C1D25', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '85%', width: '100%', borderWidth: 1, borderColor: '#2A2B34' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  chipPill: { backgroundColor: '#0B0B0F', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#2A2B34', justifyContent: 'center', alignItems: 'center' },
  chipTexto: { color: '#8A8D98', fontWeight: 'bold', fontSize: 13 },
  filterActionFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 15, borderTopWidth: 1, borderTopColor: '#2A2B34', paddingTop: 20 },
  btnLimparFiltros: { flex: 1, backgroundColor: '#0B0B0F', height: 55, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2B34' },
  btnLimparTexto: { color: '#8A8D98', fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase' },
  btnAplicarFiltros: { flex: 1, backgroundColor: '#D4FF3A', height: 55, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  btnAplicarTexto: { color: '#0B0B0F', fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase' },

  // Estilos do Alerta Customizado
  modalFullOverlayCentro: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertaContainer: { backgroundColor: '#1C1D25', width: '100%', maxWidth: 400, borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#2A2B34', shadowColor: '#D4FF3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  alertaTitulo: { color: '#F4F5F7', fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  alertaMensagem: { color: '#8A8D98', fontSize: 15, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  alertaBotoes: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  alertaBtnCancelar: { flex: 1, paddingVertical: 14, backgroundColor: '#0B0B0F', borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34', alignItems: 'center' },
  alertaBtnCancelarTexto: { color: '#8A8D98', fontWeight: 'bold', fontSize: 14 },
  alertaBtnConfirmar: { flex: 1, paddingVertical: 14, backgroundColor: '#D4FF3A', borderRadius: 12, alignItems: 'center' },
  alertaBtnConfirmarTexto: { color: '#0B0B0F', fontWeight: 'bold', fontSize: 14 },
});