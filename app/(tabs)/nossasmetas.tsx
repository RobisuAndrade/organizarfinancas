import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, push, ref, set } from 'firebase/database';
import { db } from '../../firebaseConfig';

// ----------------------------------------------------
// CONFIGURAÇÃO DA META
// ----------------------------------------------------
const META_OBJETIVO = 20000;

// ----------------------------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------------------------
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

const converterParaNumero = (valorString: string) => {
  if (!valorString) return 0;
  const numeroLimpo = valorString.replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(numeroLimpo);
  return isNaN(numero) ? 0 : numero;
};

const formatarData = (isoString?: string) => {
  if (!isoString) return '--/--/----';
  try {
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR');
  } catch {
    return '--/--/----';
  }
};

export default function NossasMetas() {
  const router = useRouter();

  // Estados dos Saldos
  const [saldoRobinho, setSaldoRobinho] = useState(0);
  const [saldoVanessinha, setSaldoVanessinha] = useState(0);
  const [historico, setHistorico] = useState<any[]>([]);

  // Estados do Modal de Transação
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoTransacao, setTipoTransacao] = useState<'ENTRADA' | 'SAIDA'>('ENTRADA');
  const [contaSelecionada, setContaSelecionada] = useState<'ROBINHO' | 'VANESSINHA'>('ROBINHO');
  const [valorInput, setValorInput] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    // 1. Escutar Saldos
    const metasRef = ref(db, 'metas/contas');
    onValue(metasRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        setSaldoRobinho(dados.robinho || 0);
        setSaldoVanessinha(dados.vanessinha || 0);
      }
    });

    // 2. Escutar Histórico
    const histRef = ref(db, 'metas/historico');
    onValue(histRef, (snapshot) => {
      const dados = snapshot.val();
      if (dados) {
        const itens = Object.keys(dados).map(key => ({ id: key, ...dados[key] }));
        setHistorico(itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()));
      }
    });
  }, []);

  const realizarTransacao = async () => {
    const valorNum = converterParaNumero(valorInput);
    if (valorNum <= 0 || !descricao) {
      Alert.alert("Erro", "Preencha o valor e a descrição.");
      return;
    }

    const novoSaldoRobinho = contaSelecionada === 'ROBINHO' 
      ? (tipoTransacao === 'ENTRADA' ? saldoRobinho + valorNum : saldoRobinho - valorNum)
      : saldoRobinho;

    const novoSaldoVanessinha = contaSelecionada === 'VANESSINHA'
      ? (tipoTransacao === 'ENTRADA' ? saldoVanessinha + valorNum : saldoVanessinha - valorNum)
      : saldoVanessinha;

    try {
      await set(ref(db, 'metas/contas'), {
        robinho: novoSaldoRobinho,
        vanessinha: novoSaldoVanessinha
      });

      await set(push(ref(db, 'metas/historico')), {
        tipo: tipoTransacao,
        conta: contaSelecionada,
        valor: valorNum,
        descricao: descricao,
        data: new Date().toISOString()
      });

      setModalAberto(false);
      setValorInput('');
      setDescricao('');
    } catch (e) {
      Alert.alert("Erro", "Falha na transação.");
    }
  };

  const totalReserva = saldoRobinho + saldoVanessinha;
  const progressoPercentual = totalReserva > 0 ? (totalReserva / META_OBJETIVO) * 100 : 0;
  const larguraBarra = Math.min(progressoPercentual, 100); 

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#B04FCF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.titulo}>Nossas Metas</Text>
            <Text style={styles.subtitulo}>Acompanhe a evolução do sonho</Text>
          </View>
        </View>

        {/* CARD PRINCIPAL COM BARRA DE PROGRESSO */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View style={styles.goalIconBox}>
              <Feather name="target" size={24} color="#0F0414" />
            </View>
            <View>
              <Text style={styles.goalTitle}>Reserva de Emergência</Text>
              <Text style={styles.goalSubtitle}>Objetivo: {formatarMoeda(META_OBJETIVO)}</Text>
            </View>
          </View>

          <View style={styles.goalValuesRow}>
            <Text style={styles.goalCurrentValue}>{formatarMoeda(totalReserva)}</Text>
            <Text style={styles.goalPercentText}>{progressoPercentual.toFixed(1)}%</Text>
          </View>

          {/* BARRA DE PROGRESSO VISUAL */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${larguraBarra}%` }]} />
          </View>

          {totalReserva >= META_OBJETIVO && (
            <View style={styles.goalSuccessBadge}>
              <Feather name="award" size={14} color="#FFD700" style={{ marginRight: 5 }} />
              <Text style={styles.goalSuccessText}>META ALCANÇADA!</Text>
            </View>
          )}
        </View>

        {/* CONTAS INDIVIDUAIS */}
        <Text style={styles.sectionTitle}>Onde o dinheiro está?</Text>
        <View style={styles.contasRow}>
          <View style={styles.contaCard}>
            <Text style={styles.contaNome}>Mercado Pago (Robinho)</Text>
            <Text style={styles.contaValor}>{formatarMoeda(saldoRobinho)}</Text>
            <TouchableOpacity 
              style={[styles.btnAcao, { backgroundColor: '#3b82f630' }]}
              onPress={() => { setContaSelecionada('ROBINHO'); setModalAberto(true); }}
            >
              <Feather name="repeat" size={14} color="#3b82f6" />
              <Text style={[styles.btnAcaoText, { color: '#3b82f6' }]}>Movimentar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contaCard}>
            <Text style={styles.contaNome}>Caixinha (Vanessinha)</Text>
            <Text style={styles.contaValor}>{formatarMoeda(saldoVanessinha)}</Text>
            <TouchableOpacity 
              style={[styles.btnAcao, { backgroundColor: '#ec489930' }]}
              onPress={() => { setContaSelecionada('VANESSINHA'); setModalAberto(true); }}
            >
              <Feather name="repeat" size={14} color="#ec4899" />
              <Text style={[styles.btnAcaoText, { color: '#ec4899' }]}>Movimentar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* HISTÓRICO DE MOVIMENTAÇÕES */}
        <Text style={styles.sectionTitle}>Últimas Movimentações</Text>
        <FlatList
          data={historico}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.histItem}>
              <View style={[styles.histIcon, { backgroundColor: item.tipo === 'ENTRADA' ? '#00E67620' : '#FF336620' }]}>
                {/* CORREÇÃO DO ÍCONE AQUI */}
                {item.tipo === 'ENTRADA' ? (
                  <Feather name="arrow-up-right" size={18} color="#00E676" />
                ) : (
                  <Feather name="arrow-down-left" size={18} color="#FF3366" />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.histDesc}>{item.descricao}</Text>
                <Text style={styles.histConta}>{item.conta === 'ROBINHO' ? 'Robinho' : 'Vanessinha'} • {formatarData(item.data)}</Text>
              </View>
              <Text style={[styles.histValor, { color: item.tipo === 'ENTRADA' ? '#00E676' : '#FF3366' }]}>
                {item.tipo === 'ENTRADA' ? '+' : '-'} {formatarMoeda(item.valor)}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#666' }}>Nenhuma movimentação ainda.</Text>
            </View>
          }
        />

        {/* MODAL DE TRANSAÇÃO */}
        <Modal visible={modalAberto} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Atualizar Saldo: {contaSelecionada}</Text>
              
              <View style={styles.tipoToggle}>
                <TouchableOpacity 
                  style={[styles.tipoBtn, tipoTransacao === 'ENTRADA' && styles.tipoBtnAtivoEntrada]}
                  onPress={() => setTipoTransacao('ENTRADA')}
                >
                  <Text style={[styles.tipoBtnText, tipoTransacao === 'ENTRADA' && styles.tipoBtnTextAtivo]}>Guardar (+)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tipoBtn, tipoTransacao === 'SAIDA' && styles.tipoBtnAtivoSaida]}
                  onPress={() => setTipoTransacao('SAIDA')}
                >
                  <Text style={[styles.tipoBtnText, tipoTransacao === 'SAIDA' && styles.tipoBtnTextAtivo]}>Retirar (-)</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabelMicro}>Qual o valor?</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="R$ 0,00" 
                placeholderTextColor="#666" 
                keyboardType="numeric"
                value={valorInput}
                onChangeText={t => setValorInput(formatarInputMoeda(t))}
              />

              <Text style={styles.inputLabelMicro}>Motivo da movimentação</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Ex: Sobrou do mês" 
                placeholderTextColor="#666"
                value={descricao}
                onChangeText={setDescricao}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalAberto(false)}>
                  <Text style={styles.btnCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSalvar} onPress={realizarTransacao}>
                  <Text style={styles.btnSalvarText}>Confirmar</Text>
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
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  container: { flex: 1, padding: 20, paddingTop: 40, maxWidth: 600, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  subtitulo: { fontSize: 12, color: '#888' },

  goalCard: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#00E67650', marginBottom: 25 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  goalIconBox: { width: 45, height: 45, backgroundColor: '#00E676', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  goalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  goalSubtitle: { color: '#00E676', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2 },
  
  goalValuesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  goalCurrentValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  goalPercentText: { color: '#888', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },

  progressBarBg: { height: 12, backgroundColor: '#0F0414', borderRadius: 6, borderWidth: 1, borderColor: '#2D1436', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00E676', borderRadius: 6 },
  
  goalSuccessBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD70020', paddingVertical: 8, borderRadius: 10, marginTop: 15, borderWidth: 1, borderColor: '#FFD70050' },
  goalSuccessText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },

  contasRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  contaCard: { width: '48%', backgroundColor: '#1E0A24', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#2D1436' },
  contaNome: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
  contaValor: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  btnAcao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  btnAcaoText: { fontSize: 11, fontWeight: 'bold', marginLeft: 6 },

  sectionTitle: { color: '#B04FCF', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
  
  histItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E0A24', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2D1436' },
  histIcon: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  histDesc: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  histConta: { color: '#666', fontSize: 11 },
  histValor: { fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#2D1436' },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  tipoToggle: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#0F0414', borderRadius: 12, padding: 4 },
  tipoBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tipoBtnAtivoEntrada: { backgroundColor: '#00E676' },
  tipoBtnAtivoSaida: { backgroundColor: '#FF3366' },
  tipoBtnText: { color: '#888', fontWeight: 'bold' },
  tipoBtnTextAtivo: { color: '#0F0414' },
  inputLabelMicro: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginLeft: 5 },
  modalInput: { backgroundColor: '#0F0414', height: 55, borderRadius: 12, paddingHorizontal: 15, color: '#FFF', fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#2D1436' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnCancelar: { padding: 15, flex: 1, alignItems: 'center', backgroundColor: '#0F0414', borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#2D1436' },
  btnCancelarText: { color: '#888', fontWeight: 'bold' },
  btnSalvar: { backgroundColor: '#B04FCF', padding: 15, flex: 1, alignItems: 'center', borderRadius: 12 },
  btnSalvarText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});