import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, ref, set, update } from 'firebase/database';
import { db } from '../../firebaseConfig';

// ----------------------------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------------------------
import { converterParaNumero, formatarInputMoeda, formatarMoeda } from '../../utils/formatadores';

const obterMesAtualString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`; 
};

const formatarNomeMes = (anoMes: string) => {
  const [ano, mes] = anoMes.split('-');
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${meses[parseInt(mes) - 1]} ${ano}`;
};

export default function Salarios() {
  const router = useRouter();

  const [abaAtiva, setAbaAtiva] = useState<'Robinho' | 'Vanessinha'>('Robinho');
  const [mesAtivo, setMesAtivo] = useState(obterMesAtualString());

  // Estados - Robinho
  const [dia15R, setDia15R] = useState('');
  const [dia25R, setDia25R] = useState('');
  const [extrasR, setExtrasR] = useState('');

  // Estados - Vanessinha
  const [dia05V, setDia05V] = useState('');
  const [dia20V, setDia20V] = useState('');
  const [extrasV, setExtrasV] = useState('');

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnimUp = useRef(new Animated.Value(30)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Lógica do Cabeçalho Retrátil (Header Flutuante)
  // 230 é aproximadamente a altura somada do Header + Calendário + Abas
  const headerDiffClamp = Animated.diffClamp(scrollY, 0, 230);
  const headerTranslateY = headerDiffClamp.interpolate({
    inputRange: [0, 230],
    outputRange: [0, -230],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    // Dispara animação ao carregar
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnimUp, { toValue: 0, duration: 800, useNativeDriver: true })
    ]).start();

    const salariosRef = ref(db, `salarios/historico/${mesAtivo}`);
    const unsubscribe = onValue(salariosRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        setDia15R(dados.robinho?.dia15 || '');
        setDia25R(dados.robinho?.dia25 || '');
        setExtrasR(dados.robinho?.extras || '');
        
        setDia05V(dados.vanessinha?.dia05 || '');
        setDia20V(dados.vanessinha?.dia20 || '');
        setExtrasV(dados.vanessinha?.extras || '');
      } else {
        setDia15R(''); setDia25R(''); setExtrasR('');
        setDia05V(''); setDia20V(''); setExtrasV('');
      }
    });
    return () => unsubscribe();
  }, [mesAtivo]);

  // Cálculos principais (INTACTOS)
  const totalRobinho = converterParaNumero(dia15R) + converterParaNumero(dia25R) + converterParaNumero(extrasR);
  const totalVanessinha = converterParaNumero(dia05V) + converterParaNumero(dia20V) + converterParaNumero(extrasV);
  const totalEntradas = totalRobinho + totalVanessinha;

  // Cálculos de Gestão (INTACTOS)
  const totalAbaAtiva = abaAtiva === 'Robinho' ? totalRobinho : totalVanessinha;
  const aba60Fixos = totalAbaAtiva * 0.60;
  const aba20Poupanca = totalAbaAtiva * 0.20;
  const aba20Emergencia = totalAbaAtiva * 0.20;

  const mudarMes = (direcao: number) => {
    const [ano, mes] = mesAtivo.split('-');
    let novaData = new Date(parseInt(ano), parseInt(mes) - 1, 1);
    novaData.setMonth(novaData.getMonth() + direcao);
    
    const novoAno = novaData.getFullYear();
    const novoMes = String(novaData.getMonth() + 1).padStart(2, '0');
    setMesAtivo(`${novoAno}-${novoMes}`);
  };

  const salvarDados = async () => {
    try {
      await set(ref(db, `salarios/historico/${mesAtivo}`), {
        robinho: { dia15: dia15R, dia25: dia25R, extras: extrasR },
        vanessinha: { dia05: dia05V, dia20: dia20V, extras: extrasV }
      });

      if (mesAtivo === obterMesAtualString()) {
        await update(ref(db, 'salarios'), { totalEntradas: totalEntradas });
      }

      Alert.alert("Sucesso", `Renda de ${formatarNomeMes(mesAtivo)} salva!`);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar os dados.");
    }
  };

  const renderInputComGestao = (label: string, valor: string, setValor: (v: string) => void) => {
    const num = converterParaNumero(valor);
    const v60 = num * 0.60;
    const v20a = num * 0.20;
    const v20b = num * 0.20; 

    return (
      <View style={styles.inputBloco}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput 
          style={styles.input} 
          placeholder="R$ 0,00" 
          placeholderTextColor="#666" 
          value={valor} 
          onChangeText={(txt) => setValor(formatarInputMoeda(txt))} 
          keyboardType="numeric" 
        />
        
        {num > 0 && (
          <View style={styles.gestaoContainer}>
            <View style={styles.gestaoColuna}>
              <Text style={styles.gestaoTag}>60% Fixo</Text>
              <Text style={styles.gestaoValor}>{formatarMoeda(v60)}</Text>
            </View>
            <View style={styles.gestaoDivisor} />
            <View style={styles.gestaoColuna}>
              <Text style={styles.gestaoTag}>20% Casa</Text>
              <Text style={[styles.gestaoValor, { color: '#00E676' }]}>{formatarMoeda(v20a)}</Text>
            </View>
            <View style={styles.gestaoDivisor} />
            <View style={styles.gestaoColuna}>
              <Text style={styles.gestaoTag}>20% Emerg.</Text>
              <Text style={[styles.gestaoValor, { color: '#B04FCF' }]}>{formatarMoeda(v20b)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainWrapper}>

        {/* CABEÇALHO FLUTUANTE (AGRUPA HEADER, CALENDÁRIO E ABAS) */}
        <Animated.View style={[styles.headerFlutuante, { transform: [{ translateY: headerTranslateY }] }]}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#B04FCF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.titulo}>Nossa Renda</Text>
              <Text style={styles.subtitulo}>Distribuição inteligente (60-20-20)</Text>
            </View>
          </View>

          <View style={styles.calendarioContainer}>
            <TouchableOpacity style={styles.calendarioBotao} onPress={() => mudarMes(-1)}>
              <Feather name="chevron-left" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.calendarioCentro}>
              <Feather name="calendar" size={16} color="#B04FCF" style={{ marginRight: 8 }} />
              <Text style={styles.calendarioTexto}>{formatarNomeMes(mesAtivo)}</Text>
            </View>
            <TouchableOpacity style={styles.calendarioBotao} onPress={() => mudarMes(1)}>
              <Feather name="chevron-right" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.abasContainer}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.abaBotao, abaAtiva === 'Robinho' && styles.abaBotaoAtivaR]} onPress={() => setAbaAtiva('Robinho')}>
              <Feather name="user" size={16} color={abaAtiva === 'Robinho' ? '#FFF' : '#3b82f6'} style={styles.abaIcone} />
              <Text style={[styles.abaTexto, abaAtiva === 'Robinho' && styles.abaTextoAtiva]}>Robinho</Text>
            </TouchableOpacity>
            
            <TouchableOpacity activeOpacity={0.8} style={[styles.abaBotao, abaAtiva === 'Vanessinha' && styles.abaBotaoAtivaV]} onPress={() => setAbaAtiva('Vanessinha')}>
              <Feather name="heart" size={16} color={abaAtiva === 'Vanessinha' ? '#FFF' : '#ec4899'} style={styles.abaIcone} />
              <Text style={[styles.abaTexto, abaAtiva === 'Vanessinha' && styles.abaTextoAtiva]}>Vanessinha</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ÁREA DE ROLAGEM COM ANIMATED SCROLLVIEW */}
        <Animated.ScrollView 
          showsVerticalScrollIndicator={false} 
          // O paddingTop: 250 afasta os cards para baixo do cabeçalho flutuante no estado inicial
          contentContainerStyle={{ paddingTop: 250, paddingBottom: 50, paddingHorizontal: 20 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnimUp }] }}>
            
            <View style={styles.card}>
              {abaAtiva === 'Robinho' ? (
                <>
                  {renderInputComGestao("Dia 15 (Adiantamento)", dia15R, setDia15R)}
                  {renderInputComGestao("Dia 25 (Pagamento)", dia25R, setDia25R)}
                  {renderInputComGestao("Renda Extra / Bônus", extrasR, setExtrasR)}
                  
                  <View style={styles.subtotalPessoa}>
                    <Text style={styles.subtotalPessoaTexto}>Total Robinho:</Text>
                    <Text style={[styles.subtotalPessoaValor, { color: '#3b82f6' }]}>{formatarMoeda(totalRobinho)}</Text>
                  </View>
                </>
              ) : (
                <>
                  {renderInputComGestao("Dia 05 (Pagamento)", dia05V, setDia05V)}
                  {renderInputComGestao("Dia 20 (Adiantamento)", dia20V, setDia20V)}
                  {renderInputComGestao("Renda Extra / Bônus", extrasV, setExtrasV)}

                  <View style={styles.subtotalPessoa}>
                    <Text style={styles.subtotalPessoaTexto}>Total Vanessinha:</Text>
                    <Text style={[styles.subtotalPessoaValor, { color: '#ec4899' }]}>{formatarMoeda(totalVanessinha)}</Text>
                  </View>
                </>
              )}
            </View>

            {/* CARTÃO TOTAL ENTRADAS E DIVISÃO ATIVA */}
            <View style={styles.totalCard}>
              <View style={styles.totalHeader}>
                <Feather name="trending-up" size={24} color="#00E676" />
                <Text style={styles.totalLabel}>Entradas de {formatarNomeMes(mesAtivo)}</Text>
              </View>
              <Text style={styles.totalValue}>{formatarMoeda(totalEntradas)}</Text>

              {totalAbaAtiva > 0 && (
                <View style={styles.totalBreakdownContainer}>
                  <Text style={styles.breakdownTitle}>DIVISÃO DE {abaAtiva}</Text>
                  
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Gastos Fixos</Text>
                    <Text style={styles.breakdownValue}>{formatarMoeda(aba60Fixos)}</Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Poupança de Casa</Text>
                    <Text style={[styles.breakdownValue, { color: '#00E676' }]}>{formatarMoeda(aba20Poupanca)}</Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Reserva de Emergência</Text>
                    <Text style={[styles.breakdownValue, { color: '#B04FCF' }]}>{formatarMoeda(aba20Emergencia)}</Text>
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity activeOpacity={0.8} style={styles.saveButton} onPress={salvarDados}>
              <Feather name="save" size={20} color="#FFF" />
              <Text style={styles.saveButtonText}>Gravar Mês ({formatarNomeMes(mesAtivo)})</Text>
            </TouchableOpacity>

          </Animated.View>
        </Animated.ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  mainWrapper: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  
  // O segredo do Cabeçalho Retrátil
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

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitulo: { fontSize: 12, color: '#888', marginTop: 2 },
  
  calendarioContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E0A24', borderRadius: 16, borderWidth: 1, borderColor: '#B04FCF', marginBottom: 15 },
  calendarioBotao: { padding: 15 },
  calendarioCentro: { flexDirection: 'row', alignItems: 'center' },
  calendarioTexto: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },

  abasContainer: { flexDirection: 'row', backgroundColor: '#1E0A24', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#2D1436', marginBottom: 5 },
  abaBotao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  abaBotaoAtivaR: { backgroundColor: '#3b82f6' }, 
  abaBotaoAtivaV: { backgroundColor: '#ec4899' }, 
  abaIcone: { marginRight: 8 },
  abaTexto: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  abaTextoAtiva: { color: '#FFF' },
  
  card: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2D1436', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  
  inputBloco: { marginBottom: 25 },
  inputLabel: { color: '#B04FCF', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { height: 50, backgroundColor: '#0F0414', borderRadius: 12, paddingHorizontal: 15, fontSize: 18, color: '#FFF', borderWidth: 1, borderColor: '#2D1436', fontWeight: '600' },
  
  gestaoContainer: { flexDirection: 'row', backgroundColor: '#0F0414', marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2D1436', justifyContent: 'space-between' },
  gestaoColuna: { alignItems: 'center', flex: 1 },
  gestaoDivisor: { width: 1, backgroundColor: '#2D1436', height: '100%' },
  gestaoTag: { color: '#888', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  gestaoValor: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },

  subtotalPessoa: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2D1436' },
  subtotalPessoaTexto: { color: '#888', fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  subtotalPessoaValor: { fontSize: 22, fontWeight: '900' },

  totalCard: { backgroundColor: '#00E67610', borderRadius: 24, padding: 25, marginBottom: 20, borderWidth: 1, borderColor: '#00E67640', alignItems: 'center', shadowColor: '#00E676', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  totalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  totalLabel: { color: '#00E676', fontSize: 14, fontWeight: 'bold', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { color: '#00E676', fontSize: 36, fontWeight: '900' },

  totalBreakdownContainer: { width: '100%', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#00E67630' },
  breakdownTitle: { color: '#00E676', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: 15, letterSpacing: 1.5, opacity: 0.8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  breakdownLabel: { color: '#00E676', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  breakdownValue: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  saveButton: { flexDirection: 'row', backgroundColor: '#B04FCF', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 10, textTransform: 'uppercase', letterSpacing: 1 },
});