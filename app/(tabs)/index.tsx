import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, ref } from 'firebase/database';
import { db } from '../../firebaseConfig';

export default function Home() {
  const router = useRouter();

  // Estado para guardar a quantidade real de itens na lista
  const [qtdItensLista, setQtdItensLista] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);

  // Efeito para buscar a quantidade de itens no Firebase em tempo real
  useEffect(() => {
    const listaRef = ref(db, 'compras');
    
    const unsubscribe = onValue(listaRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        // Conta quantos itens existem dentro do banco de dados
        const quantidade = Object.keys(dados).length;
        setQtdItensLista(quantidade);
      } else {
        setQtdItensLista(0); // Se não tiver nada, fica 0
      }
    });
const salariosRef = ref(db, 'salarios');
    const unsubscribeSalarios = onValue(salariosRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados && dados.totalEntradas) {
        setTotalEntradas(dados.totalEntradas);
      } else {
        setTotalEntradas(0);
      }
    });

    return () => {

      unsubscribeSalarios();
    };
  }, []);

  const navegarPara = (caminho: string) => {
    router.push(caminho as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.contentWrapper}>
          
          {/* Cabeçalho de Boas-vindas */}
          <View style={styles.header}>
            <Text style={styles.saudacao}>Bem-vindos de volta!</Text>
            <Text style={styles.titulo}>Finanças{"\n"}Robinho & Vanessinha</Text>
            <View style={styles.linhaDecorativa} />
          </View>

          <Text style={styles.sectionTitle}>Menu Principal</Text>

          {/* Grade de Menu */}
          <View style={styles.gridContainer}>
            
            <TouchableOpacity style={styles.squareCard} onPress={() => navegarPara('Visão Geral')}>
              <View style={[styles.iconCircle, { backgroundColor: '#AA319C' }]}>
                <Feather name="pie-chart" size={22} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Visão Geral</Text>
            </TouchableOpacity>

<TouchableOpacity style={styles.squareCard} onPress={() => navegarPara('/gestaogastos')}>
  <View style={[styles.iconCircle, { backgroundColor: '#B04FCF' }]}>
    <Feather name="plus-circle" size={22} color="#FFF" />
  </View>
  <Text style={styles.squareCardTitle}>Gestão de Gastos</Text>
</TouchableOpacity>

            <TouchableOpacity style={styles.squareCard} onPress={() => navegarPara('/compras')}>
              <View style={[styles.iconCircle, { backgroundColor: '#AA319C' }]}>
                <Feather name="shopping-bag" size={22} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Lista de Compras</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.squareCard} onPress={() => navegarPara('Nossas Metas')}>
              <View style={[styles.iconCircle, { backgroundColor: '#B04FCF' }]}>
                <Feather name="star" size={22} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Nossas Metas</Text>
            </TouchableOpacity>

            {/* NOVO BOTÃO: SALÁRIOS */}
            <TouchableOpacity style={styles.squareCard} onPress={() => navegarPara('/salarios')}>
              <View style={[styles.iconCircle, { backgroundColor: '#AA319C' }]}>
                <Feather name="dollar-sign" size={22} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Salários</Text>
            </TouchableOpacity>

          </View>

          {/* Seção de Resumo no Rodapé */}
          <View style={styles.footerSection}>
            <Text style={styles.sectionTitle}>Resumo Rápido</Text>
            
            <View style={styles.footerGrid}>
              
              {/* 1. ENTRADAS */}
<View style={styles.infoBox}>
  <View style={styles.infoIconRow}>
    <Feather name="trending-up" size={16} color="#00E676" />
    <Text style={[styles.infoTag, { color: '#00E676' }]}>Entradas</Text>
  </View>
  {/* AQUI ESTÁ A MÁGICA: */}
  <Text style={styles.infoValor}>
    {totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
  </Text>
  <Text style={styles.infoDesc}>Receitas do mês</Text>
</View>

              {/* 2. SAÍDAS */}
              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="trending-down" size={16} color="#FF3366" />
                  <Text style={[styles.infoTag, { color: '#FF3366' }]}>Saídas</Text>
                </View>
                <Text style={styles.infoValor}>R$ 4.250</Text>
                <Text style={styles.infoDesc}>Gastos este mês</Text>
              </View>

              {/* 3. METAS */}
              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="target" size={16} color="#AA319C" />
                  <Text style={styles.infoTag}>Metas</Text>
                </View>
                <Text style={styles.infoValor}>R$ 2.500</Text>
                <Text style={styles.infoDesc}>Poupança Casal</Text>
              </View>

              {/* 4. QUANTIDADE DE PRODUTOS (AGORA DINÂMICA!) */}
              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="shopping-cart" size={16} color="#B04FCF" />
                  <Text style={[styles.infoTag, { color: '#B04FCF' }]}>Na Lista</Text>
                </View>
                {/* Aqui colocamos a variável que pega do banco de dados */}
                <Text style={styles.infoValor}>{qtdItensLista} Itens</Text>
                <Text style={styles.infoDesc}>Para comprar</Text>
              </View>

            </View>
          </View>

        </View>
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
  header: { 
    marginBottom: 30 
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
    marginBottom: 30 
  },
  squareCard: { 
    backgroundColor: '#1E0A24', 
    width: '47%', 
    height: 125, 
    borderRadius: 24, 
    padding: 15, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D1436'
  },
  iconCircle: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
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
    marginTop: 5,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E0A24'
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
    padding: 15,
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#2D1436'
  },
  infoIconRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  infoTag: { 
    fontSize: 10, 
    fontWeight: 'bold', 
    marginLeft: 6, 
    textTransform: 'uppercase' 
  },
  infoValor: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  infoDesc: { 
    fontSize: 10, 
    color: '#666', 
    marginTop: 2 
  }
});