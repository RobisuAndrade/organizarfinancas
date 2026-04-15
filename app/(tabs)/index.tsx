import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


export default function Home() {
  const router = useRouter();

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

          {/* Grade de Menu (Os 4 quadradinhos) */}
          <View style={styles.gridContainer}>
            
            <TouchableOpacity style={styles.squareCard} onPress={() => navegarPara('Visão Geral')}>
              <View style={[styles.iconCircle, { backgroundColor: '#AA319C' }]}>
                <Feather name="pie-chart" size={22} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Visão Geral</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.squareCard} onPress={() => navegarPara('Novo Gasto')}>
              <View style={[styles.iconCircle, { backgroundColor: '#B04FCF' }]}>
                <Feather name="plus-circle" size={22} color="#FFF" />
              </View>
              <Text style={styles.squareCardTitle}>Novos Gastos</Text>
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

          </View>

          {/* Seção de Resumo no Rodapé */}
          <View style={styles.footerSection}>
            <Text style={styles.sectionTitle}>Resumo Rápido</Text>
            <View style={styles.footerGrid}>
              
              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="trending-down" size={16} color="#B04FCF" />
                  <Text style={styles.infoTag}>Saídas</Text>
                </View>
                <Text style={styles.infoValor}>R$ 450,00</Text>
                <Text style={styles.infoDesc}>Gastos este mês</Text>
              </View>

              <View style={styles.infoBox}>
                <View style={styles.infoIconRow}>
                  <Feather name="check-circle" size={16} color="#AA319C" />
                  <Text style={styles.infoTag}>Meta</Text>
                </View>
                <Text style={styles.infoValor}>R$ 2.500</Text>
                <Text style={styles.infoDesc}>Poupança Casal</Text>
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
    backgroundColor: '#0F0414' // Fundo Dark profundo (roxo quase preto)
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
    marginBottom: 40 
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
    marginBottom: 40 
  },
  squareCard: { 
    backgroundColor: '#1E0A24', // Card levemente mais claro que o fundo
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
  
  // Estilos do Rodapé
  footerSection: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E0A24'
  },
  footerGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  infoBox: { 
    backgroundColor: '#1E0A24', 
    width: '47%', 
    borderRadius: 20, 
    padding: 15,
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
    color: '#B04FCF', 
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