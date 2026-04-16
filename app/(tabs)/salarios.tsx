import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, ref, set, update } from 'firebase/database';
import { db } from '../../firebaseConfig';

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

  useEffect(() => {
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

  // Cálculos principais
  const totalRobinho = converterParaNumero(dia15R) + converterParaNumero(dia25R) + converterParaNumero(extrasR);
  const totalVanessinha = converterParaNumero(dia05V) + converterParaNumero(dia20V) + converterParaNumero(extrasV);
  const totalEntradas = totalRobinho + totalVanessinha;

  // NOVO: Cálculos de Gestão focados apenas na aba que está selecionada
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

  // Componente de Input e Gestão 60-20-20 por item
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
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'Robinho' && styles.abaBotaoAtivaR]} onPress={() => setAbaAtiva('Robinho')}>
          <Feather name="user" size={16} color={abaAtiva === 'Robinho' ? '#FFF' : '#3b82f6'} style={styles.abaIcone} />
          <Text style={[styles.abaTexto, abaAtiva === 'Robinho' && styles.abaTextoAtiva]}>Robinho</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'Vanessinha' && styles.abaBotaoAtivaV]} onPress={() => setAbaAtiva('Vanessinha')}>
          <Feather name="heart" size={16} color={abaAtiva === 'Vanessinha' ? '#FFF' : '#ec4899'} style={styles.abaIcone} />
          <Text style={[styles.abaTexto, abaAtiva === 'Vanessinha' && styles.abaTextoAtiva]}>Vanessinha</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
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

          {/* DETALHAMENTO DO TOTAL DA PESSOA SELECIONADA */}
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

        <TouchableOpacity style={styles.saveButton} onPress={salvarDados}>
          <Feather name="save" size={20} color="#FFF" />
          <Text style={styles.saveButtonText}>Gravar Mês ({formatarNomeMes(mesAtivo)})</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: '#0F0414' },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitulo: { fontSize: 12, color: '#888', marginTop: 2 },
  
  calendarioContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E0A24', marginHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: '#B04FCF', marginBottom: 15 },
  calendarioBotao: { padding: 15 },
  calendarioCentro: { flexDirection: 'row', alignItems: 'center' },
  calendarioTexto: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },

  abasContainer: { flexDirection: 'row', backgroundColor: '#1E0A24', marginHorizontal: 20, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#2D1436', marginBottom: 10 },
  abaBotao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  abaBotaoAtivaR: { backgroundColor: '#3b82f6' }, 
  abaBotaoAtivaV: { backgroundColor: '#ec4899' }, 
  abaIcone: { marginRight: 8 },
  abaTexto: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  abaTextoAtiva: { color: '#FFF' },

  container: { padding: 20, paddingBottom: 50, width: '100%', maxWidth: 600, alignSelf: 'center' },
  
  card: { backgroundColor: '#1E0A24', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2D1436' },
  
  inputBloco: { marginBottom: 25 },
  inputLabel: { color: '#B04FCF', fontSize: 13, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
  input: { height: 50, backgroundColor: '#0F0414', borderRadius: 12, paddingHorizontal: 15, fontSize: 18, color: '#FFF', borderWidth: 1, borderColor: '#2D1436', fontWeight: '600' },
  
  gestaoContainer: { flexDirection: 'row', backgroundColor: '#0F0414', marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2D1436', justifyContent: 'space-between' },
  gestaoColuna: { alignItems: 'center', flex: 1 },
  gestaoDivisor: { width: 1, backgroundColor: '#2D1436', height: '100%' },
  gestaoTag: { color: '#888', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  gestaoValor: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },

  subtotalPessoa: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2D1436' },
  subtotalPessoaTexto: { color: '#888', fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  subtotalPessoaValor: { fontSize: 20, fontWeight: '900' },

  // ESTILOS DO CARTÃO TOTAL
  totalCard: { backgroundColor: '#00E67610', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#00E67650', alignItems: 'center' },
  totalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  totalLabel: { color: '#00E676', fontSize: 14, fontWeight: 'bold', marginLeft: 8, textTransform: 'uppercase' },
  totalValue: { color: '#00E676', fontSize: 32, fontWeight: '900' },

  // NOVOS ESTILOS DO DETALHAMENTO (Focado na Aba Ativa)
  totalBreakdownContainer: { width: '100%', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#00E67630' },
  breakdownTitle: { color: '#00E676', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: 15, letterSpacing: 1.5, opacity: 0.8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  breakdownLabel: { color: '#00E676', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  breakdownValue: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  saveButton: { flexDirection: 'row', backgroundColor: '#AA319C', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
});