import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, ref } from 'firebase/database';
import { db } from '../../firebaseConfig';

// Importação das funções utilitárias
import { converterParaNumero, formatarMoeda } from '../../utils/formatadores';

const { width, height } = Dimensions.get('window');

// Lista de símbolos que vão aparecer no fundo
const SIMBOLOS = ['R$', '%', '$', '€', '¥', '+', '-'];

// Gera posições aleatórias para espalhar os símbolos pela tela
const elementosFundo = Array.from({ length: 30 }).map((_, i) => ({
  id: i,
  simbolo: SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)],
  left: Math.random() * width,
  top: Math.random() * height,
  fontSize: Math.random() * 30 + 15, 
  opacity: Math.random() * 0.1 + 0.05, 
  rotacao: `${Math.random() * 60 - 30}deg` 
}));

function FundoFinanceiro() {
  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', zIndex: 0 }]} pointerEvents="none">
      {elementosFundo.map((el) => (
        <Text
          key={el.id}
          style={{
            position: 'absolute',
            left: el.left,
            top: el.top,
            fontSize: el.fontSize,
            opacity: el.opacity,
            color: '#B04FCF', 
            fontWeight: '900',
            transform: [{ rotate: el.rotacao }]
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

  // Estados dos valores dinâmicos do Resumo Rápido
  const [qtdItensPendentes, setQtdItensPendentes] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [totalSaidasPendentes, setTotalSaidasPendentes] = useState(0);
  const [totalMetas, setTotalMetas] = useState(0);

  // Animação de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Dispara a animação assim que a tela abre
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true })
    ]).start();

    // 1. Buscar Itens da Lista de Compras (Apenas os NÃO comprados)
    const unsubscribeCompras = onValue(ref(db, 'compras'), (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const pendentes = Object.values(dados).filter((item: any) => !item.comprado).length;
        setQtdItensPendentes(pendentes);
      } else {
        setQtdItensPendentes(0);
      }
    });

    // 2. Buscar Renda (Total de Entradas do mês)
    const unsubscribeRenda = onValue(ref(db, 'salarios'), (snapshot) => {
      const dados = snapshot.val();
      setTotalEntradas(dados?.totalEntradas || 0);
    });

    // 3. Buscar Gastos (Total a pagar / Saídas pendentes)
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

    // 4. Buscar Metas (Total poupado pelo casal)
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

  return (
    <SafeAreaView style={styles.safeArea}>
       <FundoFinanceiro />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
       
        <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {/* CABEÇALHO COM LOGO */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.saudacao}>Bem-vindos de volta!</Text>
              <Text style={styles.titulo}>Finanças{"\n"}Robinho & Vanessinha</Text>
              <View style={styles.linhaDecorativa} />
            </View>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/logo-rv.png')} 
                style={styles.logoImage} 
                resizeMode="cover" 
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Menu Principal</Text>

          {/* Grade de Menu (Ícones Modernizados) */}
          <View style={styles.gridContainer}>
            
            <TouchableOpacity style={styles.squareCard} activeOpacity={0.8} onPress={() => navegarPara('/resumo')}>
              <View style={[styles.iconCircle, { backgroundColor: '#AA319C' }]}>
                <Feather name="activity" size={26} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Visão Geral</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.squareCard} activeOpacity={0.8} onPress={() => navegarPara('/gastos')}>
              <View style={[styles.iconCircle, { backgroundColor: '#B04FCF' }]}>
                <Feather name="file-text" size={26} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Gestão de Gastos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.squareCard} activeOpacity={0.8} onPress={() => navegarPara('/compras')}>
              <View style={[styles.iconCircle, { backgroundColor: '#AA319C' }]}>
                <Feather name="shopping-bag" size={26} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Lista de Compras</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.squareCard} activeOpacity={0.8} onPress={() => navegarPara('/metas')}>
              <View style={[styles.iconCircle, { backgroundColor: '#B04FCF' }]}>
                <Feather name="target" size={26} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Nossas Metas</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.squareCard, { width: '100%' }]} 
              activeOpacity={0.8}
              onPress={() => navegarPara('/renda')}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#B04FCF' }]}>
                <Feather name="dollar-sign" size={26} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Salários & Renda</Text>
            </TouchableOpacity>

          </View>

          {/* Seção de Resumo no Rodapé */}
          <View style={styles.footerSection}>
            <Text style={styles.sectionTitle}>Resumo Rápido</Text>
            
            <View style={styles.footerGrid}>
              
              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="trending-up" size={16} color="#00E676" />
                  <Text style={[styles.infoTag, { color: '#00E676' }]}>Entradas</Text>
                </View>
                <Text style={styles.infoValor}>{formatarMoeda(totalEntradas)}</Text>
                <Text style={styles.infoDesc}>Receitas do mês</Text>
              </View>

              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="alert-circle" size={16} color="#FF3366" />
                  <Text style={[styles.infoTag, { color: '#FF3366' }]}>A Pagar</Text>
                </View>
                <Text style={styles.infoValor}>{formatarMoeda(totalSaidasPendentes)}</Text>
                <Text style={styles.infoDesc}>Despesas pendentes</Text>
              </View>

              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="target" size={16} color="#AA319C" />
                  <Text style={styles.infoTag}>Metas</Text>
                </View>
                <Text style={styles.infoValor}>{formatarMoeda(totalMetas)}</Text>
                <Text style={styles.infoDesc}>Poupança do Casal</Text>
              </View>

              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="shopping-cart" size={16} color="#B04FCF" />
                  <Text style={[styles.infoTag, { color: '#B04FCF' }]}>Na Lista</Text>
                </View>
                <Text style={styles.infoValor}>{qtdItensPendentes} {qtdItensPendentes === 1 ? 'Item' : 'Itens'}</Text>
                <Text style={styles.infoDesc}>Faltam comprar</Text>
              </View>

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
    backgroundColor: '#0F0414' 
  },
  container: { 
    paddingTop: 30, 
    paddingBottom: 60, 
    alignItems: 'center' 
  },
  contentWrapper: { 
    width: '100%', 
    maxWidth: 500, 
    paddingHorizontal: 20 
  },
  
  // ESTILOS DO CABEÇALHO ATUALIZADOS
  header: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30 
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 15,
  },
  saudacao: { 
    fontSize: 16, 
    color: '#B04FCF', 
    fontWeight: '600' 
  },
  titulo: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    marginTop: 8, 
    lineHeight: 34 
  },
  linhaDecorativa: { 
    height: 4, 
    width: 40, 
    backgroundColor: '#AA319C', 
    borderRadius: 2, 
    marginTop: 15 
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: '#1E0A24',
    borderWidth: 1,
    borderColor: '#2D1436',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#B04FCF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },

  sectionTitle: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: '#888', 
    marginBottom: 15, 
    textTransform: 'uppercase', 
    letterSpacing: 2 
  },
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    marginBottom: 20 
  },
  squareCard: { 
    backgroundColor: '#1E0A24', 
    width: '47%', 
    height: 125, 
    borderRadius: 24, 
    padding: 15, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2D1436',
    shadowColor: '#B04FCF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  iconCircle: { 
    width: 52, 
    height: 52, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  squareCardTitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#EEE', 
    textAlign: 'center' 
  },
  
  footerSection: {
    marginTop: 10,
    paddingTop: 25,
    borderTopWidth: 1,
    borderTopColor: '#2D1436'
  },
  footerGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  infoBox: { 
    backgroundColor: '#1E0A24', 
    width: '48%', 
    borderRadius: 20, 
    padding: 16,
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#2D1436'
  },
  infoIconRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  infoTag: { 
    fontSize: 10, 
    fontWeight: 'bold', 
    marginLeft: 6, 
    textTransform: 'uppercase' 
  },
  infoValor: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: '#FFFFFF' 
  },
  infoDesc: { 
    fontSize: 11, 
    color: '#666', 
    marginTop: 4,
    fontWeight: '500'
  }
});