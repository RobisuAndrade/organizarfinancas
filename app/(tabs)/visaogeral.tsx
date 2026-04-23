import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, ref } from 'firebase/database';
import { db } from '../../firebaseConfig';

// ----------------------------------------------------
// REGRAS DE NEGÓCIO DOS CARTÕES
// ----------------------------------------------------
const REGRAS_CARTOES: { [key: string]: { fechamento: number, vencimento: number, cor: string } } = {
  'NUBANK-Vanessinha': { fechamento: 4, vencimento: 11, cor: '#8A05BE' },
  'INTER-Robinho': { fechamento: 9, vencimento: 15, cor: '#FF7A00' },
  'BRADESCO-Vanessinha': { fechamento: 26, vencimento: 5, cor: '#CC092F' },
  'NUBANK-Robinho': { fechamento: 20, vencimento: 26, cor: '#8A05BE' },
  'BRADESCO-Robinho': { fechamento: 7, vencimento: 18, cor: '#CC092F' }
};

const converterParaNumero = (valorString: string) => {
  if (!valorString) return 0;
  const numeroLimpo = valorString.replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(numeroLimpo);
  return isNaN(numero) ? 0 : numero;
};

const formatarMoeda = (valor: number) => {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const hoje = new Date();
const MES_ATUAL = hoje.getMonth() + 1;
const ANO_ATUAL = hoje.getFullYear();

const formatarNomeMes = (mes: number, ano: number) => {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${meses[mes - 1]} ${ano}`;
};

// Largura do Card dinâmico para o carrossel
const windowWidth = Dimensions.get('window').width;
const CARD_WIDTH = windowWidth > 600 ? 560 : windowWidth - 40;

export default function VisaoGeral() {
  const router = useRouter();

  // Estados
  const [listaGastos, setListaGastos] = useState<any[]>([]);
  const [listaCompras, setListaCompras] = useState<any[]>([]);
  const [salariosMes, setSalariosMes] = useState<any>(null);
  const [ultimoGasto, setUltimoGasto] = useState<any>(null);
  const [ultimaCompra, setUltimaCompra] = useState<any>(null);
  
  const [mesView, setMesView] = useState(MES_ATUAL);
  const [anoView, setAnoView] = useState(ANO_ATUAL);

  // Controle do Carrossel Inferior
  const scrollCardsRef = useRef<ScrollView>(null);
  const [offsetCards, setOffsetCards] = useState(0);

  useEffect(() => {
    // 1. Buscar Gastos
    const gastosRef = ref(db, 'gastos');
    const unsubGastos = onValue(gastosRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const itens = Object.keys(dados).map(key => ({ id: key, ...dados[key] }));
        setListaGastos(itens);
        const ordenados = [...itens].sort((a, b) => new Date(b.dataRegistro).getTime() - new Date(a.dataRegistro).getTime());
        setUltimoGasto(ordenados[0]);
      }
    });

    // 2. Buscar Compras (Para o Ticker e para a lista inferior)
    const comprasRef = ref(db, 'compras');
    const unsubCompras = onValue(comprasRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const itens = Object.keys(dados).map(key => ({ id: key, ...dados[key] }));
        setListaCompras(itens);
        const ordenados = [...itens].sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime());
        setUltimaCompra(ordenados[0]);
      }
    });

    // 3. Buscar Salários do Mês
    const mesFormatado = `${anoView}-${String(mesView).padStart(2, '0')}`;
    const salariosRef = ref(db, `salarios/historico/${mesFormatado}`);
    const unsubSalarios = onValue(salariosRef, (snapshot) => {
      setSalariosMes(snapshot.val());
    });

    return () => {
      unsubGastos();
      unsubCompras();
      unsubSalarios();
    };
  }, [mesView, anoView]);

  const mudarMes = (direcao: number) => {
    let novoMes = mesView + direcao;
    let novoAno = anoView;
    if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    setMesView(novoMes);
    setAnoView(novoAno);
  };

  const rolarCards = (direcao: 'esq' | 'dir') => {
    const passo = CARD_WIDTH + 15; // Largura do card + margem
    const novoOffset = direcao === 'dir' ? offsetCards + passo : Math.max(0, offsetCards - passo);
    scrollCardsRef.current?.scrollTo({ x: novoOffset, animated: true });
    setOffsetCards(novoOffset);
  };

  const processarDados = () => {
    let totaisCartoes: { [key: string]: number } = {};
    let totalAvista = 0;
    let somaFixos = 0;

    listaGastos.forEach(gasto => {
      const partesData = (gasto.dataCompra || '').split('/');
      if (partesData.length !== 3) return;

      const diaCompra = parseInt(partesData[0]);
      let mesBase = parseInt(partesData[1]);
      let anoBase = parseInt(partesData[2]);

      const chaveCartao = `${gasto.pagamento}-${gasto.responsavel}`;
      const regra = REGRAS_CARTOES[chaveCartao];
      let isCredito = !!regra;

      if (gasto.isFixo) somaFixos += converterParaNumero(gasto.subtotal);

      if (isCredito && diaCompra > regra.fechamento) {
        mesBase += 1;
        if (mesBase > 12) { mesBase = 1; anoBase += 1; }
      }

      const diferencaMeses = (anoView - anoBase) * 12 + (mesView - mesBase);
      const qtdParcelas = gasto.isParcelado ? parseInt(gasto.qtdParcelas) || 1 : 1;

      if (diferencaMeses >= 0 && diferencaMeses < qtdParcelas) {
        const valorAdicionar = converterParaNumero(gasto.subtotal);
        if (isCredito) {
          totaisCartoes[chaveCartao] = (totaisCartoes[chaveCartao] || 0) + valorAdicionar;
        } else if (diferencaMeses === 0) {
          totalAvista += valorAdicionar;
        }
      }
    });

    let totalBrutoEntradas = 0;
    if (salariosMes) {
      const r = salariosMes.robinho;
      const v = salariosMes.vanessinha;
      totalBrutoEntradas += converterParaNumero(r?.dia15) + converterParaNumero(r?.dia25) + converterParaNumero(r?.extras);
      totalBrutoEntradas += converterParaNumero(v?.dia05) + converterParaNumero(v?.dia20) + converterParaNumero(v?.extras);
    }

    const totalDisponivel60 = totalBrutoEntradas * 0.60;
    const totalGeralGastos = Object.values(totaisCartoes).reduce((a, b) => a + b, 0) + totalAvista;

    return { totaisCartoes, totalAvista, totalGeralGastos, somaFixos, totalDisponivel60 };
  };

  const { totaisCartoes, totalAvista, totalGeralGastos, somaFixos, totalDisponivel60 } = processarDados();

  // Filtrar os produtos da lista de compras que já foram PAGOS (checkbox marcado)
  const produtosComprados = listaCompras
    .filter(item => item.pago === true)
    .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
    .slice(0, 5); // Pega os 5 mais recentes

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#B04FCF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.titulo}>Visão Geral</Text>
            <Text style={styles.subtitulo}>Inteligência Financeira</Text>
          </View>
        </View>

        {/* TICKER */}
        <View style={styles.tickerContainer}>
          <View style={styles.tickerBadge}>
             <Text style={styles.tickerBadgeText}>RECENTE</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {ultimoGasto && (
              <View style={styles.tickerItem}>
                <Text style={styles.tickerLabel}>GASTO:</Text>
                <Text style={styles.tickerDesc}>{ultimoGasto.descricao}</Text>
                <Text style={[styles.tickerValor, { color: '#B04FCF' }]}>R$ {ultimoGasto.subtotal}</Text>
                <View style={styles.tickerDot} />
              </View>
            )}
            {ultimaCompra && (
              <View style={styles.tickerItem}>
                <Text style={styles.tickerLabel}>COMPRA:</Text>
                <Text style={styles.tickerDesc}>{ultimaCompra.nome}</Text>
                <Text style={[styles.tickerValor, { color: '#00E676' }]}>R$ {ultimaCompra.valor || '0,00'}</Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={styles.calendarioContainer}>
          <TouchableOpacity style={styles.calendarioBotao} onPress={() => mudarMes(-1)}>
            <Feather name="chevron-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.calendarioCentro}>
            <Text style={styles.calendarioTexto}>{formatarNomeMes(mesView, anoView)}</Text>
          </View>
          <TouchableOpacity style={styles.calendarioBotao} onPress={() => mudarMes(1)}>
            <Feather name="chevron-right" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
          
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
              <Text style={styles.compSub}>Faturas + À Vista</Text>
            </View>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusText}>
              {totalDisponivel60 >= totalGeralGastos 
                ? `Você ainda tem ${formatarMoeda(totalDisponivel60 - totalGeralGastos)} livres.`
                : `Atenção! Você ultrapassou o limite em ${formatarMoeda(totalGeralGastos - totalDisponivel60)}.`}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Faturas dos Cartões</Text>
          <View style={styles.cardsGrid}>
            {Object.keys(REGRAS_CARTOES).map(chave => {
              const regra = REGRAS_CARTOES[chave];
              const [banco, responsavel] = chave.split('-');
              const valorFatura = totaisCartoes[chave] || 0;

              return (
                <View key={chave} style={[styles.faturaCard, { borderTopColor: regra.cor, borderTopWidth: 4 }]}>
                  <View style={styles.faturaHeader}>
                     <Text style={[styles.faturaBanco, { color: regra.cor }]}>{banco}</Text>
                     <View style={[styles.badgePessoa, { backgroundColor: responsavel === 'Robinho' ? '#3b82f620' : '#ec489920' }]}>
                        <Text style={[styles.badgePessoaTexto, { color: responsavel === 'Robinho' ? '#3b82f6' : '#ec4899' }]}>{responsavel}</Text>
                     </View>
                  </View>
                  <Text style={styles.faturaValor}>{formatarMoeda(valorFatura)}</Text>
                  <View style={styles.faturaFooter}>
                     <View style={styles.faturaDateBox}>
                        <Text style={styles.faturaDateLabel}>FECHA</Text>
                        <Text style={styles.faturaDateNum}>Dia {regra.fechamento}</Text>
                     </View>
                     <View style={styles.faturaDateBox}>
                        <Text style={styles.faturaDateLabel}>VENCE</Text>
                        <Text style={styles.faturaDateNum}>Dia {regra.vencimento}</Text>
                     </View>
                  </View>
                </View>
              );
            })}

            <View style={[styles.faturaCard, { borderTopColor: '#00E676', borderTopWidth: 4 }]}>
                <View style={styles.faturaHeader}>
                    <Text style={[styles.faturaBanco, { color: '#00E676' }]}>À VISTA</Text>
                    <Feather name="zap" size={14} color="#00E676" />
                </View>
                <Text style={styles.faturaValor}>{formatarMoeda(totalAvista)}</Text>
                <View style={styles.faturaFooter}>
                  <Text style={{ color: '#666', fontSize: 10, fontStyle: 'italic' }}>Dinheiro/Pix/Débito</Text>
                </View>
            </View>
          </View>

          {/* NOVO: HEADER DO CARROSSEL (FIXOS E METAS) */}
          <View style={styles.scrollHeader}>
            <Text style={styles.sectionTitleNoMargin}>Projetos & Fixos</Text>
            <View style={styles.setasScrollBox}>
              <TouchableOpacity onPress={() => rolarCards('esq')} style={styles.setaBotao}>
                <Feather name="chevron-left" size={18} color="#B04FCF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => rolarCards('dir')} style={styles.setaBotao}>
                <Feather name="chevron-right" size={18} color="#B04FCF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* CARROSSEL */}
          <ScrollView 
            ref={scrollCardsRef} 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={{ marginBottom: 25 }}
            onScroll={(e) => setOffsetCards(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
          >
            {/* CARD 1: GASTOS FIXOS */}
            <View style={[styles.fixedCard, { width: CARD_WIDTH, marginRight: 15 }]}>
              <View style={styles.fixedHeader}>
                <View style={styles.fixedIconBox}>
                  <Feather name="repeat" size={24} color="#FFF" />
                </View>
                <View>
                  <Text style={styles.fixedTitle}>Gastos FIXOS</Text>
                  <Text style={styles.fixedSubtitle}>Contas recorrentes do mês</Text>
                </View>
              </View>
              <View style={styles.fixedContent}>
                <Text style={styles.fixedValueLabel}>Total Mensal Reservado</Text>
                <Text style={styles.fixedValue}>{formatarMoeda(somaFixos)}</Text>
              </View>
            </View>

            {/* CARD 2: NOSSAS METAS (Preparado para expansão) */}
            <View style={[styles.fixedCard, { width: CARD_WIDTH, borderColor: '#FFD70030' }]}>
              <View style={styles.fixedHeader}>
                <View style={[styles.fixedIconBox, { backgroundColor: '#FFD700' }]}>
                  <Feather name="target" size={24} color="#0F0414" />
                </View>
                <View>
                  <Text style={styles.fixedTitle}>Nossas Metas</Text>
                  <Text style={styles.fixedSubtitle}>Acompanhe os sonhos</Text>
                </View>
              </View>
              <View style={styles.fixedContent}>
                <Text style={styles.fixedValueLabel}>Metas em Andamento</Text>
                <Text style={styles.fixedValue}>Em breve</Text>
              </View>
              <TouchableOpacity style={styles.btnAcessarMetas}>
                <Text style={styles.btnAcessarMetasText}>Ver Página de Metas</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* NOVO: LISTA DE PRODUTOS COMPRADOS */}
          <Text style={styles.sectionTitle}>Últimas Compras Realizadas</Text>
          <View style={styles.compradosContainer}>
            {produtosComprados.length === 0 ? (
              <Text style={styles.compradosEmpty}>Nenhum produto finalizado ainda.</Text>
            ) : (
              produtosComprados.map((prod) => (
                <View key={prod.id} style={styles.compradosItem}>
                  <View style={styles.compradosItemEsq}>
                    <Feather name="check-circle" size={16} color="#00E676" style={{ marginRight: 8 }} />
                    <Text style={styles.compradosItemNome}>{prod.nome}</Text>
                  </View>
                  <Text style={styles.compradosItemValor}>R$ {prod.valor || '0,00'}</Text>
                </View>
              ))
            )}
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  container: { flex: 1, padding: 20, paddingTop: 40, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitulo: { fontSize: 12, color: '#888', marginTop: 2 },
  
  tickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E0A24', borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#2D1436' },
  tickerBadge: { backgroundColor: '#B04FCF', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, marginRight: 12 },
  tickerBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  tickerItem: { flexDirection: 'row', alignItems: 'center' },
  tickerLabel: { color: '#666', fontSize: 10, fontWeight: 'bold', marginRight: 5 },
  tickerDesc: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  tickerValor: { fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  tickerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#2D1436', marginHorizontal: 15 },

  calendarioContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E0A24', borderRadius: 16, marginBottom: 20 },
  calendarioBotao: { padding: 15 },
  calendarioCentro: { flex: 1, alignItems: 'center' },
  calendarioTexto: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },

  comparisonContainer: { flexDirection: 'row', backgroundColor: '#1E0A24', borderRadius: 20, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: '#2D1436', alignItems: 'center' },
  compCard: { flex: 1, alignItems: 'center' },
  compDivider: { width: 1, height: '70%', backgroundColor: '#2D1436' },
  compLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 },
  compValue: { fontSize: 18, fontWeight: '900' },
  compSub: { color: '#444', fontSize: 9, marginTop: 4, fontWeight: 'bold' },

  statusBox: { backgroundColor: '#1E0A24', padding: 12, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: '#2D1436' },
  statusText: { color: '#AAA', fontSize: 11, textAlign: 'center', fontWeight: '600' },

  sectionTitle: { color: '#B04FCF', fontSize: 14, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitleNoMargin: { color: '#B04FCF', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },

  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  faturaCard: { width: '48%', backgroundColor: '#1E0A24', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436' },
  faturaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  faturaBanco: { fontSize: 13, fontWeight: '900' },
  badgePessoa: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  badgePessoaTexto: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  faturaValor: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
  faturaFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#2D1436', paddingTop: 10 },
  faturaDateBox: { alignItems: 'flex-start' },
  faturaDateLabel: { fontSize: 8, color: '#666', fontWeight: 'bold' },
  faturaDateNum: { fontSize: 10, color: '#CCC', fontWeight: '600', marginTop: 2 },

  // CARROSSEL HEADER
  scrollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  setasScrollBox: { flexDirection: 'row', gap: 8 },
  setaBotao: { padding: 4, backgroundColor: '#1E0A24', borderRadius: 6, borderWidth: 1, borderColor: '#2D1436' },

  // CARDS GRANDES
  fixedCard: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#B04FCF30' },
  fixedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  fixedIconBox: { width: 40, height: 40, backgroundColor: '#B04FCF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  fixedTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  fixedSubtitle: { color: '#666', fontSize: 12 },
  fixedContent: { alignItems: 'center', backgroundColor: '#0F0414', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#2D1436' },
  fixedValueLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 },
  fixedValue: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  
  btnAcessarMetas: { marginTop: 15, backgroundColor: '#FFD70015', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FFD70030' },
  btnAcessarMetasText: { color: '#FFD700', fontWeight: 'bold', fontSize: 12 },

  // LISTA DE COMPRADOS
  compradosContainer: { backgroundColor: '#1E0A24', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#2D1436' },
  compradosEmpty: { color: '#666', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: 10 },
  compradosItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2D1436' },
  compradosItemEsq: { flexDirection: 'row', alignItems: 'center' },
  compradosItemNome: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  compradosItemValor: { color: '#00E676', fontSize: 14, fontWeight: 'bold' }
});