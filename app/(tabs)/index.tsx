import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useDialogo } from '../../hooks/useDialogo';
import { usePrivacidade } from '../../hooks/usePrivacidade';

// Importações do Firebase
import { onValue, ref } from 'firebase/database';
import { db } from '../../firebaseConfig';

// Tema e utilitários
import { Colors } from '../../constants/theme';
import { converterParaNumero, formatarMoeda } from '../../utils/formatadores';
import { useEscolhaRapida } from '../../hooks/useEscolhaRapida';

const { width, height } = Dimensions.get('window');

// Lista de símbolos que vão aparecer no fundo, bem sutil, só pra dar textura
const SIMBOLOS = ['R$', '%', '$', '€', '¥', '+', '-'];
const CORES_SIMBOLOS = [Colors.lime, Colors.lavender];

const elementosFundo = Array.from({ length: 22 }).map((_, i) => ({
  id: i,
  simbolo: SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)],
  cor: CORES_SIMBOLOS[Math.floor(Math.random() * CORES_SIMBOLOS.length)],
  left: Math.random() * width,
  top: Math.random() * height,
  fontSize: Math.random() * 26 + 14,
  opacity: Math.random() * 0.06 + 0.04,
  rotacao: `${Math.random() * 60 - 30}deg`,
}));

function FundoFinanceiro() {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 0 }]} pointerEvents="none">
      {elementosFundo.map((el) => (
        <Text
          key={el.id}
          style={{
            position: 'absolute',
            left: el.left,
            top: el.top,
            fontSize: el.fontSize,
            opacity: el.opacity,
            color: el.cor,
            fontWeight: '900',
            transform: [{ rotate: el.rotacao }],
          }}
        >
          {el.simbolo}
        </Text>
      ))}
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { abrir } = useEscolhaRapida();
  const { oculto, alternar: alternarOculto } = usePrivacidade();
  const { confirmar } = useDialogo();

  const sair = async () => {
    const ok = await confirmar({
      titulo: 'Sair da conta',
      mensagem: 'Sair da conta neste aparelho? Vai pedir e-mail e senha de novo.',
      textoConfirmar: 'Sair',
      perigo: true,
      icone: 'log-out',
    });
    if (ok) signOut(auth);
  };

  // Estados dos valores dinâmicos do Resumo Rápido
  const [qtdItensPendentes, setQtdItensPendentes] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [totalSaidasPendentes, setTotalSaidasPendentes] = useState(0);
  const [totalMetas, setTotalMetas] = useState(0);

  // Animação de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    // 1. Itens da Lista de Compras (apenas os não comprados)
    const unsubscribeCompras = onValue(ref(db, 'compras'), (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const pendentes = Object.values(dados).filter((item: any) => !item.comprado).length;
        setQtdItensPendentes(pendentes);
      } else {
        setQtdItensPendentes(0);
      }
    });

    // 2. Renda (total de entradas do mês)
    const unsubscribeRenda = onValue(ref(db, 'salarios'), (snapshot) => {
      const dados = snapshot.val();
      setTotalEntradas(dados?.totalEntradas || 0);
    });

    // 3. Gastos (total a pagar / saídas pendentes)
    const unsubscribeGastos = onValue(ref(db, 'gastos'), (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const totalPendente = Object.values(dados as any)
          .filter((gasto: any) => !gasto.pago)
          .reduce((acc: number, gasto: any) => acc + converterParaNumero(gasto.subtotal), 0);
        setTotalSaidasPendentes(totalPendente);
      } else {
        setTotalSaidasPendentes(0);
      }
    });

    // 4. Metas (total poupado pelo casal)
    const unsubscribeMetas = onValue(ref(db, 'metas/contas'), (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const soma = (dados.robinho || 0) + (dados.vanessinha || 0);
        setTotalMetas(soma);
      } else {
        setTotalMetas(0);
      }
    });

    return () => {
      unsubscribeCompras();
      unsubscribeRenda();
      unsubscribeGastos();
      unsubscribeMetas();
    };
  }, []);

  const navegarPara = (caminho: string) => {
    router.push(caminho as any);
  };

  const saldo = totalEntradas - totalSaidasPendentes;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FundoFinanceiro />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* CABEÇALHO */}
          <View style={styles.header}>
            <View style={styles.saudacaoLinha}>
              <Text style={styles.saudacao}>Bem-vindos de volta!</Text>
              <View style={styles.acoesTopo}>
                <TouchableOpacity onPress={alternarOculto} style={styles.btnTopo} activeOpacity={0.8}>
                  <Feather name={oculto ? 'eye-off' : 'eye'} size={18} color={oculto ? Colors.lime : Colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={sair} style={styles.btnTopo} activeOpacity={0.8}>
                  <Feather name="log-out" size={18} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.titulo}>Finanças{"\n"}Robinho & Vanessinha</Text>
            <View style={styles.linhaDecorativa} />
          </View>

          {/* CARD DE SALDO (hero) */}
          <View style={styles.saldoCard}>
            <Text style={styles.saldoLabel}>Saldo do mês</Text>
            <Text style={styles.saldoValor}>{formatarMoeda(saldo)}</Text>

            <View style={styles.saldoLinha} />

            <View style={styles.saldoStatsRow}>
              <View style={styles.saldoStatItem}>
                <View style={styles.saldoStatIconRow}>
                  <Feather name="arrow-down-left" size={13} color={Colors.success} />
                  <Text style={[styles.saldoStatTag, { color: Colors.success }]}>Entradas</Text>
                </View>
                <Text style={styles.saldoStatValor}>{formatarMoeda(totalEntradas)}</Text>
              </View>

              <View style={styles.saldoStatDivisor} />

              <View style={styles.saldoStatItem}>
                <View style={styles.saldoStatIconRow}>
                  <Feather name="arrow-up-right" size={13} color={Colors.danger} />
                  <Text style={[styles.saldoStatTag, { color: Colors.danger }]}>A pagar</Text>
                </View>
                <Text style={styles.saldoStatValor}>{formatarMoeda(totalSaidasPendentes)}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Menu Principal</Text>

          {/* BENTO: 1 card grande + 2 médios lado a lado + 1 largo e baixo */}
          <View style={styles.bento}>
            <TouchableOpacity
              style={[styles.bentoGrande, { backgroundColor: Colors.lime }]}
              activeOpacity={0.85}
              onPress={() => navegarPara('/resumo')}
            >
              <View style={styles.bentoTopo}>
                <View style={[styles.bentoIconCircle, { backgroundColor: Colors.background + '1A' }]}>
                  <Feather name="activity" size={24} color={Colors.background} />
                </View>
                <Feather name="arrow-up-right" size={20} color={Colors.background} />
              </View>
              <Text style={[styles.bentoTitulo, { color: Colors.background }]}>Visão Geral</Text>
              <Text style={[styles.bentoSubtitulo, { color: Colors.background + 'AA' }]}>Seu extrato completo</Text>
            </TouchableOpacity>

            <View style={styles.bentoLinhaMedia}>
              <TouchableOpacity
                style={[styles.bentoMedio, { backgroundColor: Colors.lavender }]}
                activeOpacity={0.85}
                onPress={() => navegarPara('/gastos')}
              >
                <View style={[styles.bentoIconCircle, { backgroundColor: Colors.background + '1A' }]}>
                  <Feather name="file-text" size={20} color={Colors.background} />
                </View>
                <Text style={[styles.bentoTituloMedio, { color: Colors.background }]}>Gestão de{"\n"}Gastos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bentoMedio}
                activeOpacity={0.85}
                onPress={() => abrir('comprasMercado')}
              >
                <View style={[styles.bentoIconCircle, { backgroundColor: Colors.lime + '22' }]}>
                  <Feather name="shopping-bag" size={20} color={Colors.lime} />
                </View>
                <Text style={styles.bentoTituloMedio}>Compras &{"\n"}Mercado</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.bentoLargo}
              activeOpacity={0.85}
              onPress={() => abrir('salariosMetas')}
            >
              <View style={[styles.bentoIconCircle, { backgroundColor: Colors.lavender + '22' }]}>
                <Feather name="dollar-sign" size={20} color={Colors.lavender} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bentoTituloLargo}>Salários & Metas</Text>
                <Text style={styles.bentoSubtituloLargo}>Renda e poupança do casal</Text>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          {/* RESUMO RÁPIDO */}
          <View style={styles.footerSection}>
            <Text style={styles.sectionTitle}>Resumo Rápido</Text>

            <View style={styles.footerGrid}>
              <TouchableOpacity style={styles.infoBox} activeOpacity={0.8} onPress={() => navegarPara('/renda')}>
                <View style={styles.infoIconRow}>
                  <Feather name="trending-up" size={16} color={Colors.success} />
                  <Text style={[styles.infoTag, { color: Colors.success }]}>Entradas</Text>
                </View>
                <Text style={styles.infoValor}>{formatarMoeda(totalEntradas)}</Text>
                <Text style={styles.infoDesc}>Receitas do mês</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoBox} activeOpacity={0.8} onPress={() => router.push('/gastos?status=PENDENTE' as any)}>
                <View style={styles.infoIconRow}>
                  <Feather name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={[styles.infoTag, { color: Colors.danger }]}>A Pagar</Text>
                </View>
                <Text style={styles.infoValor}>{formatarMoeda(totalSaidasPendentes)}</Text>
                <Text style={styles.infoDesc}>Despesas pendentes</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoBox} activeOpacity={0.8} onPress={() => navegarPara('/metas')}>
                <View style={styles.infoIconRow}>
                  <Feather name="target" size={16} color={Colors.lavender} />
                  <Text style={[styles.infoTag, { color: Colors.lavender }]}>Metas</Text>
                </View>
                <Text style={styles.infoValor}>{formatarMoeda(totalMetas)}</Text>
                <Text style={styles.infoDesc}>Poupança do Casal</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoBox} activeOpacity={0.8} onPress={() => router.push('/compras?status=PENDENTE' as any)}>
                <View style={styles.infoIconRow}>
                  <Feather name="shopping-cart" size={16} color={Colors.lime} />
                  <Text style={[styles.infoTag, { color: Colors.lime }]}>Na Lista</Text>
                </View>
                <Text style={styles.infoValor}>{qtdItensPendentes} {qtdItensPendentes === 1 ? 'Item' : 'Itens'}</Text>
                <Text style={styles.infoDesc}>Faltam comprar</Text>
              </TouchableOpacity>
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    paddingTop: 30,
    paddingBottom: 170,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 500,
    paddingHorizontal: 20,
  },

  // CABEÇALHO
  header: {
    marginBottom: 24,
  },
  saudacaoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // fica colado no texto, longe do botão flutuante do canto direito
  },
  acoesTopo: {
    flexDirection: 'row',
    gap: 8,
  },
  btnTopo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saudacao: {
    fontSize: 16,
    color: Colors.lavender,
    fontWeight: '600',
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
    lineHeight: 34,
  },
  linhaDecorativa: {
    height: 4,
    width: 40,
    backgroundColor: Colors.lime,
    borderRadius: 2,
    marginTop: 15,
  },

  // CARD DE SALDO
  saldoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 24,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.surface3,
  },
  saldoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  saldoValor: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.lime,
    marginTop: 8,
  },
  saldoLinha: {
    height: 1,
    backgroundColor: Colors.surface3,
    marginVertical: 18,
  },
  saldoStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saldoStatItem: {
    flex: 1,
  },
  saldoStatDivisor: {
    width: 1,
    height: 30,
    backgroundColor: Colors.surface3,
    marginHorizontal: 16,
  },
  saldoStatIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  saldoStatTag: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 5,
    textTransform: 'uppercase',
  },
  saldoStatValor: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.muted,
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // BENTO GRID (substitui a lista uniforme de linhas)
  bento: {
    marginBottom: 10,
    gap: 12,
  },
  bentoGrande: {
    borderRadius: 26,
    padding: 22,
    height: 150,
    justifyContent: 'space-between',
  },
  bentoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bentoIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoTitulo: {
    fontSize: 20,
    fontWeight: '900',
  },
  bentoSubtitulo: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  bentoLinhaMedia: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoMedio: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    height: 120,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.surface3,
  },
  bentoTituloMedio: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 19,
  },
  bentoLargo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surface3,
    gap: 14,
  },
  bentoTituloLargo: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  bentoSubtituloLargo: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },

  // RESUMO RÁPIDO
  footerSection: {
    marginTop: 14,
    paddingTop: 25,
    borderTopWidth: 1,
    borderTopColor: Colors.surface3,
  },
  footerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoBox: {
    backgroundColor: Colors.surface,
    width: '48%',
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.surface3,
  },
  infoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoTag: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  infoValor: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  infoDesc: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 4,
    fontWeight: '500',
  },
});
