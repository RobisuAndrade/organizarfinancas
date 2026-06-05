import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, ref } from 'firebase/database';
import { db } from '../../firebaseConfig';
import { converterParaNumero, formatarMoeda } from '../../utils/formatadores';

const REGRAS_CARTOES: { [key: string]: { fechamento: number, vencimento: number, cor: string } } = {
  'NUBANK-Vanessinha': { fechamento: 4, vencimento: 11, cor: '#8A05BE' },
  'INTER-Robinho': { fechamento: 9, vencimento: 15, cor: '#FF7A00' },
  'BRADESCO-Vanessinha': { fechamento: 26, vencimento: 5, cor: '#CC092F' },
  'NUBANK-Robinho': { fechamento: 20, vencimento: 26, cor: '#8A05BE' },
  'BRADESCO-Robinho': { fechamento: 7, vencimento: 18, cor: '#CC092F' }
};

const hoje = new Date();
const MES_ATUAL = hoje.getMonth() + 1;
const ANO_ATUAL = hoje.getFullYear();

const formatarNomeMes = (mes: number, ano: number) => {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${meses[mes - 1]} ${ano}`;
};

const windowWidth = Dimensions.get('window').width;
const CARD_WIDTH = windowWidth > 600 ? 560 : windowWidth - 40;
const { width, height } = Dimensions.get('window');
const SIMBOLOS = ['R$', '%', '$', '€', '¥', '+', '-'];

const elementosFundo = Array.from({ length: 35 }).map((_, i) => ({
  id: i,
  simbolo: SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)],
  left: Math.random() * width,
  top: Math.random() * height,
  fontSize: Math.random() * 40 + 20, 
  opacity: Math.random() * 0.15 + 0.05, 
  rotacao: `${Math.random() * 60 - 30}deg` 
}));

function FundoFinanceiro() {
  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', zIndex: 0 }]} pointerEvents="none">
      {elementosFundo.map((el) => (
        <Text
          key={el.id}
          style={{ position: 'absolute', left: el.left, top: el.top, fontSize: el.fontSize, opacity: el.opacity, color: '#B04FCF', fontWeight: '900', transform: [{ rotate: el.rotacao }] }}
        >
          {el.simbolo}
        </Text>
      ))}
    </View>
  );
}

export default function VisaoGeral() {
  const router = useRouter();
  
  const [listaGastos, setListaGastos] = useState<any[]>([]);
  const [listaCompras, setListaCompras] = useState<any[]>([]);
  const [salariosMes, setSalariosMes] = useState<any>(null);
  
  const [mesView, setMesView] = useState(MES_ATUAL);
  const [anoView, setAnoView] = useState(ANO_ATUAL);
  const [incluirFixos, setIncluirFixos] = useState(true);
  const [viewFaturas, setViewFaturas] = useState<'cartoes' | 'categorias'>('cartoes');
  
  const scrollCardsRef = useRef<ScrollView>(null);
  const [offsetCards, setOffsetCards] = useState(0);

  // Estados do Modal de Detalhes da Fatura
  const [modalFaturaVisivel, setModalFaturaVisivel] = useState(false);
  const [faturaDetalhe, setFaturaDetalhe] = useState<{titulo: string, responsavel: string, cor: string, total: number, itens: any[], paramsGasto: any}>({
    titulo: '', responsavel: '', cor: '#B04FCF', total: 0, itens: [], paramsGasto: {}
  });

  // Animações de Entrada e Scroll Flutuante
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnimUp = useRef(new Animated.Value(30)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Lógica do Cabeçalho Retrátil
  const headerDiffClamp = Animated.diffClamp(scrollY, 0, 160);
  const headerTranslateY = headerDiffClamp.interpolate({
    inputRange: [0, 160],
    outputRange: [0, -160],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnimUp, { toValue: 0, duration: 800, useNativeDriver: true })
    ]).start();

    const gastosRef = ref(db, 'gastos');
    const unsubGastos = onValue(gastosRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) setListaGastos(Object.keys(dados).map(key => ({ id: key, ...dados[key] })));
    });
    const comprasRef = ref(db, 'compras');
    const unsubCompras = onValue(comprasRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) setListaCompras(Object.keys(dados).map(key => ({ id: key, ...dados[key] })));
    });
    const mesFormatado = `${anoView}-${String(mesView).padStart(2, '0')}`;
    const salariosRef = ref(db, `salarios/historico/${mesFormatado}`);
    const unsubSalarios = onValue(salariosRef, (snapshot) => setSalariosMes(snapshot.val()));
    
    return () => { unsubGastos(); unsubCompras(); unsubSalarios(); };
  }, [mesView, anoView]);

  const mudarMes = (direcao: number) => {
    let novoMes = mesView + direcao;
    let novoAno = anoView;
    if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    setMesView(novoMes); setAnoView(novoAno);
  };

  const rolarCards = (direcao: 'esq' | 'dir') => {
    const passo = CARD_WIDTH + 15; 
    const novoOffset = direcao === 'dir' ? offsetCards + passo : Math.max(0, offsetCards - passo);
    scrollCardsRef.current?.scrollTo({ x: novoOffset, animated: true });
    setOffsetCards(novoOffset);
  };

  const navegarParaGestaoComFiltro = (params: any) => {
    router.push({ pathname: '/gastos', params });
  };
  const navegarParaGestaoStatus = (status: string) => {
    router.push({ pathname: '/gastos', params: { status: status } });
  };

  // =========================================================
  // MOTOR DE CÁLCULOS (MANTIDO INTACTO + AGRUPAMENTO DE ITENS)
  // =========================================================
  const processarDados = () => {
    let totaisCartoes: { [key: string]: { total: number, itens: any[] } } = {};
    let detalheAvista = { total: 0, itens: [] as any[] };
    let detalheBoleto = { total: 0, itens: [] as any[] };
    let totaisCategorias: { [key: string]: number } = {};
    let somaFixos = 0; 
    let totalGeralGastos = 0; 

    listaGastos.forEach(gasto => {
      const partesData = (gasto.dataCompra || '').split('/');
      if (partesData.length !== 3) return;
      
      const diaCompra = parseInt(partesData[0]);
      let mesBase = parseInt(partesData[1]);
      let anoBase = parseInt(partesData[2]);

      const chaveCartao = `${gasto.pagamento}-${gasto.responsavel}`;
      const regra = REGRAS_CARTOES[chaveCartao];
      
      if (regra) {
        if (diaCompra >= regra.fechamento) {
          mesBase += 1;
        }
        if (regra.vencimento < regra.fechamento) {
          mesBase += 1;
        }
        while (mesBase > 12) {
          mesBase -= 12;
          anoBase += 1;
        }
      }

      const diferencaMeses = (anoView - anoBase) * 12 + (mesView - mesBase);
      const qtdParcelas = gasto.isParcelado ? parseInt(gasto.qtdParcelas) || 1 : 1;
      const validoNesteMes = gasto.isFixo ? diferencaMeses >= 0 : (diferencaMeses >= 0 && diferencaMeses < qtdParcelas);

      if (validoNesteMes) {
        const valorAdicionar = converterParaNumero(gasto.subtotal);
        if (gasto.isFixo) somaFixos += valorAdicionar;
        if (!incluirFixos && gasto.isFixo) return;

        totalGeralGastos += valorAdicionar;
        
        // Agrupamento para os Modais de Detalhe
        if (regra) {
          if (!totaisCartoes[chaveCartao]) totaisCartoes[chaveCartao] = { total: 0, itens: [] };
          totaisCartoes[chaveCartao].total += valorAdicionar;
          totaisCartoes[chaveCartao].itens.push(gasto);
        } else if (String(gasto.pagamento).toUpperCase() === 'BOLETO') {
          detalheBoleto.total += valorAdicionar;
          detalheBoleto.itens.push(gasto);
        } else if (['PIX', 'DINHEIRO', 'DEBITO', 'DÉBITO'].includes(String(gasto.pagamento).toUpperCase())) {
          detalheAvista.total += valorAdicionar;
          detalheAvista.itens.push(gasto);
        }

        const categoriaNome = gasto.categoria || 'OUTROS';
        totaisCategorias[categoriaNome] = (totaisCategorias[categoriaNome] || 0) + valorAdicionar;
      }
    });

    let totalBrutoEntradas = 0;
    if (salariosMes) {
      const { robinho: r, vanessinha: v } = salariosMes;
      totalBrutoEntradas += converterParaNumero(r?.dia15) + converterParaNumero(r?.dia25) + converterParaNumero(r?.extras);
      totalBrutoEntradas += converterParaNumero(v?.dia05) + converterParaNumero(v?.dia20) + converterParaNumero(v?.extras);
    }
    
    return { 
      totaisCartoes, 
      detalheAvista, 
      detalheBoleto, 
      totaisCategorias, 
      totalGeralGastos, 
      somaFixos, 
      totalDisponivel60: totalBrutoEntradas * 0.60 
    };
  };

  const { totaisCartoes, detalheAvista, detalheBoleto, totaisCategorias, totalGeralGastos, somaFixos, totalDisponivel60 } = processarDados();
  const produtosComprados = listaCompras.filter(c => c.status === 'comprado').slice(0, 5);
  const categoriasOrdenadas = Object.entries(totaisCategorias).sort((a, b) => b[1] - a[1]);
  const maxCategoriaValor = categoriasOrdenadas.length > 0 ? Math.max(...Object.values(totaisCategorias)) : 1;

  const isSaldoPositivo = totalDisponivel60 >= totalGeralGastos;

  // Função auxiliar para abrir o Modal com os dados corretos
  const abrirDetalheFatura = (titulo: string, responsavel: string, cor: string, dadosAgrupados: any, paramsGasto: any) => {
    setFaturaDetalhe({
      titulo,
      responsavel,
      cor,
      total: dadosAgrupados.total || 0,
      itens: dadosAgrupados.itens || [],
      paramsGasto
    });
    setModalFaturaVisivel(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FundoFinanceiro />
      <View style={styles.mainWrapper}>

        {/* CABEÇALHO FLUTUANTE */}
        <Animated.View style={[styles.headerFlutuante, { transform: [{ translateY: headerTranslateY }] }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#B04FCF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.titulo}>Visão Geral</Text>
              <Text style={styles.subtitulo}>Inteligência Financeira</Text>
            </View>
          </View>

          <View style={styles.calendarioContainer}>
            <TouchableOpacity style={styles.calendarioBotao} onPress={() => mudarMes(-1)}>
              <Feather name="chevron-left" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.calendarioCentro}>
              <Feather name="calendar" size={16} color="#B04FCF" style={{ marginRight: 8 }} />
              <Text style={styles.calendarioTexto}>{formatarNomeMes(mesView, anoView)}</Text>
            </View>
            <TouchableOpacity style={styles.calendarioBotao} onPress={() => mudarMes(1)}>
              <Feather name="chevron-right" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ÁREA DE ROLAGEM */}
        <Animated.ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingTop: 170, paddingBottom: 50 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnimUp }], paddingHorizontal: 20 }}>
            
            <View style={styles.comparisonContainer}>
              <View style={styles.compCard}>
                <Text style={styles.compLabel}>Entradas (60%)</Text>
                <Text style={[styles.compValue, { color: '#00E676' }]}>{formatarMoeda(totalDisponivel60)}</Text>
                <Text style={styles.compSub}>Líquido p/ Gastos</Text>
              </View>
              
              <View style={styles.compDivider} />
              
              <View style={styles.compCard}>
                <Text style={styles.compLabel}>Total Previsto</Text>
                <Text style={[styles.compValue, { color: '#FF3366' }]}>{formatarMoeda(totalGeralGastos)}</Text>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[styles.toggleFixosBtn, incluirFixos ? styles.toggleFixosAtivo : styles.toggleFixosInativo]} 
                  onPress={() => setIncluirFixos(!incluirFixos)}
                >
                  <Feather name={incluirFixos ? "check-circle" : "circle"} size={12} color={incluirFixos ? "#00E676" : "#888"} />
                  <Text style={[styles.toggleFixosText, { color: incluirFixos ? '#00E676' : '#888' }]}>
                    {incluirFixos ? "FIXO ATIVO" : "FIXO DESATIVADO"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* STATUS BOX DINÂMICA */}
            <View style={[styles.statusBox, isSaldoPositivo ? styles.statusBoxPositivo : styles.statusBoxNegativo]}>
              <Feather 
                name={isSaldoPositivo ? "smile" : "alert-triangle"} 
                size={18} 
                color={isSaldoPositivo ? "#00E676" : "#FF3366"} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.statusText, { color: isSaldoPositivo ? '#00E676' : '#FF3366' }]}>
                {isSaldoPositivo 
                  ? `Tudo sob controle! Você ainda tem ${formatarMoeda(totalDisponivel60 - totalGeralGastos)} livres.` 
                  : `Atenção! Você ultrapassou o orçamento em ${formatarMoeda(totalGeralGastos - totalDisponivel60)}.`}
              </Text>
            </View>

            <View style={styles.scrollHeader}>
              <Text style={styles.sectionTitleNoMargin}>{viewFaturas === 'cartoes' ? 'Faturas & Cartões' : 'Gráfico por Categoria'}</Text>
              <View style={styles.setasScrollBox}>
                <TouchableOpacity onPress={() => setViewFaturas(v => v === 'cartoes' ? 'categorias' : 'cartoes')} style={styles.setaBotao}>
                  <Feather name={viewFaturas === 'cartoes' ? "pie-chart" : "credit-card"} size={16} color="#B04FCF" />
                </TouchableOpacity>
              </View>
            </View>

            {viewFaturas === 'cartoes' ? (
              <View style={styles.cardsGrid}>
                {Object.keys(REGRAS_CARTOES).map(chave => {
                  const regra = REGRAS_CARTOES[chave]; const [banco, responsavel] = chave.split('-');
                  const dadosFatura = totaisCartoes[chave] || { total: 0, itens: [] };

                  return (
                    <TouchableOpacity 
                      activeOpacity={0.8} 
                      key={chave} 
                      onPress={() => abrirDetalheFatura(banco, responsavel, regra.cor, dadosFatura, { banco, responsavel })} 
                      style={[styles.faturaCard, { borderTopColor: regra.cor }]}
                    >
                      <View style={styles.faturaHeader}>
                        <Text style={[styles.faturaBanco, { color: regra.cor }]}>{banco}</Text>
                        <View style={[styles.badgePessoa, { backgroundColor: responsavel === 'Robinho' ? '#3b82f620' : '#ec489920' }]}>
                          <Text style={[styles.badgePessoaTexto, { color: responsavel === 'Robinho' ? '#3b82f6' : '#ec4899' }]}>{responsavel}</Text>
                        </View>
                      </View>
                      <Text style={styles.faturaValor}>{formatarMoeda(dadosFatura.total)}</Text>
                      <View style={styles.faturaFooter}>
                        <View>
                          <Text style={styles.faturaDateLabel}>FECHA</Text>
                          <Text style={styles.faturaDateNum}>Dia {regra.fechamento}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.faturaDateLabel}>VENCE</Text>
                          <Text style={styles.faturaDateNum}>Dia {regra.vencimento}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity 
                  activeOpacity={0.8} 
                  onPress={() => abrirDetalheFatura('À VISTA', 'Geral', '#00E676', detalheAvista, { banco: 'PIX,DINHEIRO,DEBITO' })} 
                  style={[styles.faturaCard, { borderTopColor: '#00E676' }]}
                >
                    <View style={styles.faturaHeader}><Text style={[styles.faturaBanco, { color: '#00E676' }]}>À VISTA</Text><Feather name="zap" size={14} color="#00E676" /></View>
                    <Text style={styles.faturaValor}>{formatarMoeda(detalheAvista.total)}</Text>
                    <View style={styles.faturaFooter}><Text style={{ color: '#666', fontSize: 10 }}>Dinheiro/Pix/Débito</Text></View>
                </TouchableOpacity>

                <TouchableOpacity 
                  activeOpacity={0.8} 
                  onPress={() => abrirDetalheFatura('BOLETO', 'Geral', '#AAA', detalheBoleto, { banco: 'BOLETO' })} 
                  style={[styles.faturaCard, { width: '100%', borderTopColor: '#888' }]}
                >
                    <View style={styles.faturaHeader}><Text style={[styles.faturaBanco, { color: '#AAA' }]}>BOLETO</Text><Feather name="file-text" size={14} color="#AAA" /></View>
                    <Text style={styles.faturaValor}>{formatarMoeda(detalheBoleto.total)}</Text>
                    <View style={styles.faturaFooter}><Text style={{ color: '#666', fontSize: 10 }}>Contas pagas via boleto bancário</Text></View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                {categoriasOrdenadas.map(([cat, val]) => (
                  <View key={cat} style={styles.chartRow}>
                    <View style={styles.chartLabelRow}>
                      <Text style={styles.chartLabel}>{cat}</Text>
                      <Text style={styles.chartValue}>{formatarMoeda(val)}</Text>
                    </View>
                    <View style={styles.chartBarBg}>
                      <View style={[styles.chartBarFill, { width: `${(val / maxCategoriaValor) * 100}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.scrollHeader}>
              <Text style={styles.sectionTitleNoMargin}>Projetos & Fixos</Text>
              <View style={styles.setasScrollBox}>
                <TouchableOpacity onPress={() => rolarCards('esq')} style={styles.setaBotao}><Feather name="chevron-left" size={18} color="#B04FCF" /></TouchableOpacity>
                <TouchableOpacity onPress={() => rolarCards('dir')} style={styles.setaBotao}><Feather name="chevron-right" size={18} color="#B04FCF" /></TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              ref={scrollCardsRef} 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={{ marginBottom: 25 }} 
              onScroll={(e) => setOffsetCards(e.nativeEvent.contentOffset.x)} 
              scrollEventThrottle={16}
              snapToInterval={CARD_WIDTH + 15} 
              decelerationRate="fast"
            >
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => navegarParaGestaoStatus('ATIVO')}
                style={[styles.fixedCard, { width: CARD_WIDTH, marginRight: 15 }]}
              >
                <View style={styles.fixedHeader}>
                  <View style={styles.fixedIconBox}><Feather name="anchor" size={24} color="#FFF" /></View>
                  <View><Text style={styles.fixedTitle}>Gastos FIXOS</Text><Text style={styles.fixedSubtitle}>Contas recorrentes do mês</Text></View>
                </View>
                <View style={styles.fixedContent}>
                  <Text style={styles.fixedValueLabel}>Total Mensal Reservado</Text>
                  <Text style={styles.fixedValue}>{formatarMoeda(somaFixos)}</Text>
                  <View style={styles.btnAcessarMetas}><Text style={styles.btnAcessarMetasText}>CLIQUE PARA ANALISAR ➔</Text></View>
                </View>
              </TouchableOpacity>

              <View style={[styles.fixedCard, { width: CARD_WIDTH, borderColor: '#FFD70030' }]}>
                <View style={styles.fixedHeader}>
                  <View style={[styles.fixedIconBox, { backgroundColor: '#FFD700' }]}><Feather name="target" size={24} color="#0F0414" /></View>
                  <View><Text style={styles.fixedTitle}>Nossas Metas</Text><Text style={styles.fixedSubtitle}>Acompanhe os sonhos</Text></View>
                </View>
                <View style={styles.fixedContent}><Text style={styles.fixedValueLabel}>Metas em Andamento</Text><Text style={styles.fixedValue}>Em breve</Text></View>
              </View>
            </ScrollView>

            <Text style={styles.sectionTitle}>Últimas Compras Realizadas</Text>
            <View style={styles.compradosContainer}>
              {produtosComprados.length > 0 ? produtosComprados.map((prod) => (
                <View key={prod.id} style={styles.compradosItem}>
                  <View style={styles.compradosItemEsq}>
                    <Feather name="check-circle" size={16} color="#00E676" style={{ marginRight: 10 }} />
                    <Text style={styles.compradosItemNome}>{prod.nome}</Text>
                  </View>
                  <Text style={styles.compradosItemValor}>R$ {prod.valorPago || prod.valor || '0,00'}</Text>
                </View>
              )) : (
                <Text style={{color: '#666', textAlign: 'center', paddingVertical: 10}}>Nenhuma compra recente.</Text>
              )}
            </View>

          </Animated.View>
        </Animated.ScrollView>
      </View>

      {/* --- MODAL DETALHE DA FATURA --- */}
      <Modal visible={modalFaturaVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeaderClose}>
              <View>
                <Text style={[styles.modalTitle, { color: faturaDetalhe.cor }]}>{faturaDetalhe.titulo}</Text>
                <Text style={styles.modalSubtitleFatura}>{faturaDetalhe.responsavel}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalFaturaVisivel(false)} style={styles.btnCloseForm}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabelMicro}>Itens considerados neste ciclo:</Text>
            
            <ScrollView style={{ maxHeight: 350, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
              {faturaDetalhe.itens.length > 0 ? faturaDetalhe.itens.map((item, index) => (
                <View key={item.id || index} style={styles.detalheItemRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.detalheItemDesc} numberOfLines={1}>{item.descricao}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.detalheItemData}>{item.dataCompra}</Text>
                      {item.isParcelado && (
                        <View style={styles.detalheBadgeParcela}>
                           <Text style={styles.detalheBadgeText}>📦 {item.qtdParcelas}x</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.detalheItemValor}>R$ {item.subtotal}</Text>
                </View>
              )) : (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <Feather name="smile" size={40} color="#2D1436" style={{ marginBottom: 10 }} />
                  <Text style={{ color: '#666' }}>Nenhum gasto nesta fatura.</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>Soma do Mês</Text>
              <Text style={[styles.modalTotalValue, { color: faturaDetalhe.cor }]}>{formatarMoeda(faturaDetalhe.total)}</Text>
            </View>

            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={() => {
                setModalFaturaVisivel(false);
                navegarParaGestaoComFiltro(faturaDetalhe.paramsGasto);
              }}
            >
              <Feather name="edit" size={18} color="#FFF" />
              <Text style={styles.saveButtonText}>Gerenciar Despesas</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  mainWrapper: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  
  // Estilo do Cabeçalho Retrátil
  headerFlutuante: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F0414',
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20,
    paddingBottom: 5,
  },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitulo: { fontSize: 12, color: '#888', marginTop: 2 },
  
  calendarioContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E0A24', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2D1436' },
  calendarioBotao: { padding: 15 },
  calendarioCentro: { flexDirection: 'row', flex: 1, alignItems: 'center', justifyContent: 'center' },
  calendarioTexto: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  
  comparisonContainer: { flexDirection: 'row', backgroundColor: '#1E0A24', borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  compCard: { flex: 1, alignItems: 'center' },
  compDivider: { width: 1, height: '80%', backgroundColor: '#2D1436' },
  compLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  compValue: { fontSize: 20, fontWeight: '900' },
  compSub: { color: '#666', fontSize: 9, marginTop: 4, fontWeight: 'bold', textTransform: 'uppercase' },
  
  toggleFixosBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  toggleFixosAtivo: { backgroundColor: '#00E67610', borderColor: '#00E67640' },
  toggleFixosInativo: { backgroundColor: '#0F0414', borderColor: '#2D1436' },
  toggleFixosText: { fontSize: 9, fontWeight: '900', marginLeft: 6, textTransform: 'uppercase' },
  
  statusBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 16, marginBottom: 25, borderWidth: 1 },
  statusBoxPositivo: { backgroundColor: '#00E67610', borderColor: '#00E67640' },
  statusBoxNegativo: { backgroundColor: '#FF336610', borderColor: '#FF336640' },
  statusText: { fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  
  sectionTitle: { color: '#B04FCF', fontSize: 13, fontWeight: '900', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1.5 },
  sectionTitleNoMargin: { color: '#B04FCF', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  faturaCard: { width: '48%', backgroundColor: '#1E0A24', borderRadius: 20, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436', borderTopWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  faturaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  faturaBanco: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgePessoa: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  badgePessoaTexto: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  faturaValor: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 20 },
  faturaFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#2D1436', paddingTop: 12 },
  faturaDateLabel: { fontSize: 9, color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  faturaDateNum: { fontSize: 11, color: '#CCC', fontWeight: '900' },
  
  chartContainer: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 25, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436' },
  chartRow: { marginBottom: 15 },
  chartLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  chartLabel: { color: '#CCC', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  chartValue: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  chartBarBg: { height: 10, backgroundColor: '#0F0414', borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: '#2D1436' },
  chartBarFill: { height: '100%', backgroundColor: '#B04FCF', borderRadius: 5 },
  
  scrollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  setasScrollBox: { flexDirection: 'row', gap: 10 },
  setaBotao: { padding: 8, backgroundColor: '#1E0A24', borderRadius: 10, borderWidth: 1, borderColor: '#2D1436' },
  
  fixedCard: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#B04FCF40', shadowColor: '#B04FCF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  fixedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  fixedIconBox: { width: 45, height: 45, backgroundColor: '#B04FCF', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  fixedTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  fixedSubtitle: { color: '#888', fontSize: 12, marginTop: 2 },
  fixedContent: { alignItems: 'center', backgroundColor: '#0F0414', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2D1436' },
  fixedValueLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  fixedValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  btnAcessarMetas: { marginTop: 15, backgroundColor: '#B04FCF15', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10, borderWidth: 1, borderColor: '#B04FCF30' },
  btnAcessarMetasText: { color: '#B04FCF', fontWeight: '900', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  compradosContainer: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2D1436' },
  compradosItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#2D1436' },
  compradosItemEsq: { flexDirection: 'row', alignItems: 'center' },
  compradosItemNome: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  compradosItemValor: { color: '#00E676', fontSize: 15, fontWeight: 'bold' },

  // Estilos do Modal de Detalhe da Fatura
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E0A24', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%', borderWidth: 1, borderColor: '#2D1436' },
  modalHeaderClose: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 24, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  modalSubtitleFatura: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2 },
  btnCloseForm: { padding: 8, backgroundColor: '#0F0414', borderRadius: 12 },
  inputLabelMicro: { color: '#666', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  
  detalheItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D1436' },
  detalheItemDesc: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  detalheItemData: { color: '#888', fontSize: 11 },
  detalheItemValor: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  detalheBadgeParcela: { backgroundColor: '#B04FCF20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8, borderWidth: 1, borderColor: '#B04FCF40' },
  detalheBadgeText: { color: '#B04FCF', fontSize: 9, fontWeight: 'bold' },

  modalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F0414', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2D1436', marginTop: 10, marginBottom: 15 },
  modalTotalLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  modalTotalValue: { fontSize: 22, fontWeight: '900' },
  
  saveButton: { flexDirection: 'row', backgroundColor: '#B04FCF', height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginLeft: 10, textTransform: 'uppercase', letterSpacing: 1 },
});