import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, ref } from 'firebase/database';
import { db } from '../../firebaseConfig';

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

  useEffect(() => {
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

  // Funções de Navegação
  const navegarParaGestaoComFiltro = (bancoClicado: string, responsavelClicado: string) => {
    router.push({ pathname: '/gestaogastos', params: { banco: bancoClicado, responsavel: responsavelClicado } });
  };

  const navegarParaGestaoMetodo = (metodo: string) => {
    router.push({ pathname: '/gestaogastos', params: { banco: metodo } });
  };

  const navegarParaGestaoStatus = (status: string) => {
    router.push({ pathname: '/gestaogastos', params: { status: status } });
  };

  const processarDados = () => {
    let totaisCartoes: { [key: string]: number } = {};
    let totaisCategorias: { [key: string]: number } = {};
    let totalAvista = 0; let totalBoleto = 0; let somaFixos = 0; let totalGeralGastos = 0; 

    listaGastos.forEach(gasto => {
      const partesData = (gasto.dataCompra || '').split('/');
      if (partesData.length !== 3) return;
      const diaCompra = parseInt(partesData[0]);
      let mesBase = parseInt(partesData[1]);
      let anoBase = parseInt(partesData[2]);

      const chaveCartao = `${gasto.pagamento}-${gasto.responsavel}`;
      const regra = REGRAS_CARTOES[chaveCartao];
      if (regra && diaCompra > regra.fechamento) {
        mesBase += 1; if (mesBase > 12) { mesBase = 1; anoBase += 1; }
      }

      const diferencaMeses = (anoView - anoBase) * 12 + (mesView - mesBase);
      const qtdParcelas = gasto.isParcelado ? parseInt(gasto.qtdParcelas) || 1 : 1;
      const validoNesteMes = gasto.isFixo ? diferencaMeses >= 0 : (diferencaMeses >= 0 && diferencaMeses < qtdParcelas);

      if (validoNesteMes) {
        const valorAdicionar = converterParaNumero(gasto.subtotal);
        if (gasto.isFixo) somaFixos += valorAdicionar;
        if (!incluirFixos && gasto.isFixo) return;

        totalGeralGastos += valorAdicionar;
        if (regra) totaisCartoes[chaveCartao] = (totaisCartoes[chaveCartao] || 0) + valorAdicionar;
        else if (String(gasto.pagamento).toUpperCase() === 'BOLETO') totalBoleto += valorAdicionar;
        else if (['PIX', 'DINHEIRO', 'DEBITO', 'DÉBITO'].includes(String(gasto.pagamento).toUpperCase())) totalAvista += valorAdicionar;

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
    return { totaisCartoes, totaisCategorias, totalAvista, totalBoleto, totalGeralGastos, somaFixos, totalDisponivel60: totalBrutoEntradas * 0.60 };
  };

  const { totaisCartoes, totaisCategorias, totalAvista, totalBoleto, totalGeralGastos, somaFixos, totalDisponivel60 } = processarDados();
  const produtosComprados = listaCompras.filter(c => c.status === 'comprado').slice(0, 5);
  const categoriasOrdenadas = Object.entries(totaisCategorias).sort((a, b) => b[1] - a[1]);
  const maxCategoriaValor = categoriasOrdenadas.length > 0 ? Math.max(...Object.values(totaisCategorias)) : 1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FundoFinanceiro />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Feather name="arrow-left" size={24} color="#B04FCF" /></TouchableOpacity>
          <View><Text style={styles.titulo}>Visão Geral</Text><Text style={styles.subtitulo}>Inteligência Financeira</Text></View>
        </View>

        <View style={styles.calendarioContainer}>
          <TouchableOpacity style={styles.calendarioBotao} onPress={() => mudarMes(-1)}><Feather name="chevron-left" size={24} color="#FFF" /></TouchableOpacity>
          <View style={styles.calendarioCentro}><Text style={styles.calendarioTexto}>{formatarNomeMes(mesView, anoView)}</Text></View>
          <TouchableOpacity style={styles.calendarioBotao} onPress={() => mudarMes(1)}><Feather name="chevron-right" size={24} color="#FFF" /></TouchableOpacity>
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
              <TouchableOpacity style={[styles.toggleFixosBtn, incluirFixos ? styles.toggleFixosAtivo : styles.toggleFixosInativo]} onPress={() => setIncluirFixos(!incluirFixos)}>
                <Feather name={incluirFixos ? "check-circle" : "circle"} size={12} color={incluirFixos ? "#00E676" : "#888"} />
                <Text style={[styles.toggleFixosText, { color: incluirFixos ? '#FFF' : '#888' }]}>{incluirFixos ? "FIXO ATIVO" : "FIXO DESATIVADO"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusText}>
              {totalDisponivel60 >= totalGeralGastos ? `Você ainda tem ${formatarMoeda(totalDisponivel60 - totalGeralGastos)} livres.` : `Atenção! Você ultrapassou em ${formatarMoeda(totalGeralGastos - totalDisponivel60)}.`}
            </Text>
          </View>

          <View style={styles.scrollHeader}>
            <Text style={styles.sectionTitleNoMargin}>{viewFaturas === 'cartoes' ? 'Faturas & Cartões' : 'Gráfico por Categoria'}</Text>
            <View style={styles.setasScrollBox}>
              <TouchableOpacity onPress={() => setViewFaturas(v => v === 'cartoes' ? 'categorias' : 'cartoes')} style={styles.setaBotao}><Feather name="refresh-cw" size={18} color="#B04FCF" /></TouchableOpacity>
            </View>
          </View>

          {viewFaturas === 'cartoes' ? (
            <View style={styles.cardsGrid}>
              {Object.keys(REGRAS_CARTOES).map(chave => {
                const regra = REGRAS_CARTOES[chave]; const [banco, responsavel] = chave.split('-');
                return (
                  <TouchableOpacity key={chave} onPress={() => navegarParaGestaoComFiltro(banco, responsavel)} style={[styles.faturaCard, { borderTopColor: regra.cor, borderTopWidth: 4 }]}>
                    <View style={styles.faturaHeader}>
                      <Text style={[styles.faturaBanco, { color: regra.cor }]}>{banco}</Text>
                      <View style={[styles.badgePessoa, { backgroundColor: responsavel === 'Robinho' ? '#3b82f620' : '#ec489920' }]}>
                        <Text style={[styles.badgePessoaTexto, { color: responsavel === 'Robinho' ? '#3b82f6' : '#ec4899' }]}>{responsavel}</Text>
                      </View>
                    </View>
                    <Text style={styles.faturaValor}>{formatarMoeda(totaisCartoes[chave] || 0)}</Text>
                    <View style={styles.faturaFooter}>
                      <View><Text style={styles.faturaDateLabel}>FECHA</Text><Text style={styles.faturaDateNum}>Dia {regra.fechamento}</Text></View>
                      <View><Text style={styles.faturaDateLabel}>VENCE</Text><Text style={styles.faturaDateNum}>Dia {regra.vencimento}</Text></View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity onPress={() => navegarParaGestaoMetodo('PIX,DINHEIRO,DEBITO')} style={[styles.faturaCard, { borderTopColor: '#00E676', borderTopWidth: 4 }]}>
                  <View style={styles.faturaHeader}><Text style={[styles.faturaBanco, { color: '#00E676' }]}>À VISTA</Text><Feather name="zap" size={14} color="#00E676" /></View>
                  <Text style={styles.faturaValor}>{formatarMoeda(totalAvista)}</Text>
                  <View style={styles.faturaFooter}><Text style={{ color: '#666', fontSize: 10 }}>Dinheiro/Pix/Débito</Text></View>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navegarParaGestaoMetodo('BOLETO')} style={[styles.faturaCard, { width: '100%', borderTopColor: '#AAA', borderTopWidth: 4 }]}>
                  <View style={styles.faturaHeader}><Text style={[styles.faturaBanco, { color: '#AAA' }]}>BOLETO</Text><Feather name="file-text" size={14} color="#AAA" /></View>
                  <Text style={styles.faturaValor}>{formatarMoeda(totalBoleto)}</Text>
                  <View style={styles.faturaFooter}><Text style={{ color: '#666', fontSize: 10 }}>Contas pagas via boleto bancário</Text></View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              {categoriasOrdenadas.map(([cat, val]) => (
                <View key={cat} style={styles.chartRow}>
                  <View style={styles.chartLabelRow}><Text style={styles.chartLabel}>{cat}</Text><Text style={styles.chartValue}>{formatarMoeda(val)}</Text></View>
                  <View style={styles.chartBarBg}><View style={[styles.chartBarFill, { width: `${(val / maxCategoriaValor) * 100}%` }]} /></View>
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

          <ScrollView ref={scrollCardsRef} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }} onScroll={(e) => setOffsetCards(e.nativeEvent.contentOffset.x)} scrollEventThrottle={16}>
            {/* CARD GASTOS FIXOS AGORA COM FUNÇÃO DE FILTRO CLICÁVEL */}
            <TouchableOpacity 
              activeOpacity={0.7}
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
            {produtosComprados.map((prod) => (
              <View key={prod.id} style={styles.compradosItem}>
                <View style={styles.compradosItemEsq}><Feather name="check-circle" size={16} color="#00E676" style={{ marginRight: 8 }} /><Text style={styles.compradosItemNome}>{prod.nome}</Text></View>
                <Text style={styles.compradosItemValor}>R$ {prod.valor || '0,00'}</Text>
              </View>
            ))}
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
  calendarioContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E0A24', borderRadius: 16, marginBottom: 20 },
  calendarioBotao: { padding: 15 },
  calendarioCentro: { flex: 1, alignItems: 'center' },
  calendarioTexto: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },
  comparisonContainer: { flexDirection: 'row', backgroundColor: '#1E0A24', borderRadius: 20, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: '#2D1436', alignItems: 'center' },
  compCard: { flex: 1, alignItems: 'center' },
  compDivider: { width: 1, height: '70%', backgroundColor: '#2D1436' },
  compLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  compValue: { fontSize: 18, fontWeight: '900' },
  compSub: { color: '#444', fontSize: 9, marginTop: 4, fontWeight: 'bold' },
  toggleFixosBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1 },
  toggleFixosAtivo: { backgroundColor: '#00E67615', borderColor: '#00E67630' },
  toggleFixosInativo: { backgroundColor: '#0F0414', borderColor: '#2D1436' },
  toggleFixosText: { fontSize: 9, fontWeight: 'bold', marginLeft: 4, textTransform: 'uppercase' },
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
  faturaDateLabel: { fontSize: 8, color: '#666', fontWeight: 'bold' },
  faturaDateNum: { fontSize: 10, color: '#CCC', fontWeight: '600', marginTop: 2 },
  chartContainer: { backgroundColor: '#1E0A24', borderRadius: 20, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: '#2D1436' },
  chartRow: { marginBottom: 15 },
  chartLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  chartLabel: { color: '#CCC', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  chartValue: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  chartBarBg: { height: 8, backgroundColor: '#0F0414', borderRadius: 4, overflow: 'hidden' },
  chartBarFill: { height: '100%', backgroundColor: '#B04FCF', borderRadius: 4 },
  scrollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  setasScrollBox: { flexDirection: 'row', gap: 8 },
  setaBotao: { padding: 4, backgroundColor: '#1E0A24', borderRadius: 6, borderWidth: 1, borderColor: '#2D1436' },
  fixedCard: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#B04FCF30' },
  fixedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  fixedIconBox: { width: 40, height: 40, backgroundColor: '#B04FCF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  fixedTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  fixedSubtitle: { color: '#666', fontSize: 12 },
  fixedContent: { alignItems: 'center', backgroundColor: '#0F0414', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#2D1436' },
  fixedValueLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 },
  fixedValue: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  btnAcessarMetas: { marginTop: 10, backgroundColor: '#B04FCF20', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#B04FCF30' },
  btnAcessarMetasText: { color: '#B04FCF', fontWeight: 'bold', fontSize: 10 },
  compradosContainer: { backgroundColor: '#1E0A24', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#2D1436' },
  compradosItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2D1436' },
  compradosItemEsq: { flexDirection: 'row', alignItems: 'center' },
  compradosItemNome: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  compradosItemValor: { color: '#00E676', fontSize: 14, fontWeight: 'bold' }
});