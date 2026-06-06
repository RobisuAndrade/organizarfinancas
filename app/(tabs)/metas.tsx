import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, KeyboardAvoidingView, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Importações do Firebase
import { onValue, push, ref, set } from 'firebase/database';
import { db } from '../../firebaseConfig';

// Importação da nossa Calculadora Global
import Calculadora from './calculadora';

// ----------------------------------------------------
// CONFIGURAÇÃO DA META
// ----------------------------------------------------
const META_OBJETIVO = 20000;

// ----------------------------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------------------------
import { converterParaNumero, formatarData, formatarInputMoeda, formatarMoeda } from '../../utils/formatadores';

export default function NossasMetas() {
  const router = useRouter();

  // Estados dos Saldos
  const [saldoRobinho, setSaldoRobinho] = useState(0);
  const [saldoVanessinha, setSaldoVanessinha] = useState(0);
  const [historico, setHistorico] = useState<any[]>([]);

  // Estados de UI e Filtros
  const [filtroExtrato, setFiltroExtrato] = useState<'TODOS' | 'ENTRADAS' | 'SAIDAS' | 'ROBINHO' | 'VANESSINHA'>('TODOS');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnimUp = useRef(new Animated.Value(30)).current;

  // Estados do Modal de Transação
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoTransacao, setTipoTransacao] = useState<'ENTRADA' | 'SAIDA'>('ENTRADA');
  const [contaSelecionada, setContaSelecionada] = useState<'ROBINHO' | 'VANESSINHA'>('ROBINHO');
  const [valorInput, setValorInput] = useState('');
  const [descricao, setDescricao] = useState('');

  // Estado da Calculadora
  const [calcAberto, setCalcAberto] = useState(false);

  useEffect(() => {
    // Animação de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnimUp, { toValue: 0, duration: 800, useNativeDriver: true })
    ]).start();

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
      } else {
        setHistorico([]);
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

  // Filtragem do Histórico
  const historicoFiltrado = historico.filter(item => {
    if (filtroExtrato === 'ENTRADAS') return item.tipo === 'ENTRADA';
    if (filtroExtrato === 'SAIDAS') return item.tipo === 'SAIDA';
    if (filtroExtrato === 'ROBINHO') return item.conta === 'ROBINHO';
    if (filtroExtrato === 'VANESSINHA') return item.conta === 'VANESSINHA';
    return true; // 'TODOS'
  });

  const totalReserva = saldoRobinho + saldoVanessinha;
  const progressoPercentual = totalReserva > 0 ? (totalReserva / META_OBJETIVO) * 100 : 0;
  const larguraBarra = Math.min(progressoPercentual, 100); 

  // Agrupando toda a parte de cima para rolar junto com a lista (Padrão de Bancos)
  const renderHeader = () => (
    <View style={styles.headerComponent}>
      {/* HEADER DE NAVEGAÇÃO */}
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
            <Feather name="shield" size={22} color="#0F0414" />
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
            activeOpacity={0.7}
            style={[styles.btnAcao, { backgroundColor: '#3b82f620', borderColor: '#3b82f640', borderWidth: 1 }]}
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
            activeOpacity={0.7}
            style={[styles.btnAcao, { backgroundColor: '#ec489920', borderColor: '#ec489940', borderWidth: 1 }]}
            onPress={() => { setContaSelecionada('VANESSINHA'); setModalAberto(true); }}
          >
            <Feather name="repeat" size={14} color="#ec4899" />
            <Text style={[styles.btnAcaoText, { color: '#ec4899' }]}>Movimentar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TÍTULO DO EXTRATO E FILTROS */}
      <View style={styles.extratoHeader}>
        <Text style={styles.sectionTitle}>Extrato da Conta</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll} contentContainerStyle={{ paddingBottom: 15 }}>
        {[
          { id: 'TODOS', label: 'Tudo' },
          { id: 'ENTRADAS', label: 'Entradas' },
          { id: 'SAIDAS', label: 'Saídas' },
          { id: 'ROBINHO', label: 'Robinho' },
          { id: 'VANESSINHA', label: 'Vanessinha' }
        ].map(filtro => (
          <TouchableOpacity 
            key={filtro.id}
            activeOpacity={0.8}
            style={[styles.filtroPill, filtroExtrato === filtro.id && styles.filtroPillAtivo]}
            onPress={() => setFiltroExtrato(filtro.id as any)}
          >
            <Text style={[styles.filtroPillText, filtroExtrato === filtro.id && styles.filtroPillTextAtivo]}>{filtro.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnimUp }] }]}>
        
        <FlatList
          data={historicoFiltrado}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.extratoItem}>
              <View style={styles.extratoLeft}>
                <View style={[styles.extratoIcon, { backgroundColor: item.tipo === 'ENTRADA' ? '#00E67615' : '#FF336615' }]}>
                  <Feather 
                    name={item.tipo === 'ENTRADA' ? "arrow-up-right" : "arrow-down-left"} 
                    size={20} 
                    color={item.tipo === 'ENTRADA' ? "#00E676" : "#FF3366"} 
                  />
                </View>
                <View style={styles.extratoInfo}>
                  <Text style={styles.extratoDesc} numberOfLines={1}>{item.descricao}</Text>
                  <Text style={styles.extratoData}>
                    {item.conta === 'ROBINHO' ? 'Robinho' : 'Vanessinha'} • {formatarData(item.data)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.extratoValor, { color: item.tipo === 'ENTRADA' ? '#00E676' : '#FFF' }]}>
                {item.tipo === 'ENTRADA' ? '+' : '-'} {formatarMoeda(item.valor)}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="file-text" size={40} color="#2D1436" />
              <Text style={styles.emptyStateText}>Nenhuma movimentação encontrada.</Text>
            </View>
          }
        />

        {/* MODAL DE TRANSAÇÃO */}
        <Modal visible={modalAberto} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
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
            </KeyboardAvoidingView>
          </View>
        </Modal>

      </Animated.View>

      {/* BOTÃO FLUTUANTE DA CALCULADORA */}
      <TouchableOpacity 
        style={styles.fabCalculadora} 
        activeOpacity={0.8} 
        onPress={() => setCalcAberto(true)}
      >
        <MaterialIcons name="calculate" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* COMPONENTE DA CALCULADORA */}
      <Calculadora visivel={calcAberto} fechar={() => setCalcAberto(false)} />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  container: { flex: 1, maxWidth: 600, alignSelf: 'center', width: '100%', paddingHorizontal: 20 },
  headerComponent: { paddingTop: 40 },
  
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitulo: { fontSize: 12, color: '#888', marginTop: 2 },

  goalCard: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#00E67650', marginBottom: 25, shadowColor: '#00E676', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  goalIconBox: { width: 45, height: 45, backgroundColor: '#00E676', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  goalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  goalSubtitle: { color: '#00E676', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4, letterSpacing: 1 },
  
  goalValuesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 },
  goalCurrentValue: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  goalPercentText: { color: '#888', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },

  progressBarBg: { height: 12, backgroundColor: '#0F0414', borderRadius: 6, borderWidth: 1, borderColor: '#2D1436', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00E676', borderRadius: 6 },
  
  goalSuccessBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD70015', paddingVertical: 10, borderRadius: 12, marginTop: 20, borderWidth: 1, borderColor: '#FFD70040' },
  goalSuccessText: { color: '#FFD700', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },

  contasRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  contaCard: { width: '48%', backgroundColor: '#1E0A24', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#2D1436' },
  contaNome: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  contaValor: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  btnAcao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  btnAcaoText: { fontSize: 12, fontWeight: 'bold', marginLeft: 8 },

  extratoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#B04FCF', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1.5 },
  
  filtrosScroll: { flexDirection: 'row', marginBottom: 5 },
  filtroPill: { backgroundColor: '#1E0A24', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#2D1436', height: 38, justifyContent: 'center' },
  filtroPillAtivo: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  filtroPillText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  filtroPillTextAtivo: { color: '#FFF' },

  // Estilos do Extrato Bancário (Clean Look)
  extratoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2D1436' },
  extratoLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  extratoIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  extratoInfo: { flex: 1 },
  extratoDesc: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  extratoData: { color: '#888', fontSize: 11, fontWeight: '500' },
  extratoValor: { fontSize: 16, fontWeight: 'bold' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { color: '#666', fontSize: 14, marginTop: 15, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E0A24', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#2D1436' },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 25 },
  tipoToggle: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#0F0414', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#2D1436' },
  tipoBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10 },
  tipoBtnAtivoEntrada: { backgroundColor: '#00E676' },
  tipoBtnAtivoSaida: { backgroundColor: '#FF3366' },
  tipoBtnText: { color: '#888', fontWeight: 'bold' },
  tipoBtnTextAtivo: { color: '#0F0414', fontWeight: '900' },
  inputLabelMicro: { color: '#B04FCF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  modalInput: { backgroundColor: '#0F0414', height: 55, borderRadius: 14, paddingHorizontal: 15, color: '#FFF', fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#2D1436' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btnCancelar: { padding: 15, flex: 1, alignItems: 'center', backgroundColor: '#0F0414', borderRadius: 14, marginRight: 10, borderWidth: 1, borderColor: '#2D1436' },
  btnCancelarText: { color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  btnSalvar: { backgroundColor: '#B04FCF', padding: 15, flex: 1, alignItems: 'center', borderRadius: 14 },
  btnSalvarText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Botão flutuante da Calculadora
  fabCalculadora: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    backgroundColor: '#B04FCF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#B04FCF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 100,
    borderWidth: 1,
    borderColor: '#D475EE'
  }
});