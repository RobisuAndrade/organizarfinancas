import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Calculadora({ visivel, fechar }: { visivel: boolean, fechar: () => void }) {
  const [display, setDisplay] = useState('0');

  const pressionarBotao = (valor: string) => {
    if (display === 'Erro') {
      if (valor === 'C') setDisplay('0');
      return;
    }

    if (valor === 'C') {
      setDisplay('0');
    } else if (valor === '⌫') {
      setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
    } else if (valor === '%') {
      try {
        setDisplay((parseFloat(display) / 100).toString());
      } catch {
        setDisplay('Erro');
      }
    } else if (valor === '=') {
      try {
        const expressao = display.replace(/×/g, '*').replace(/÷/g, '/');
        // eslint-disable-next-line no-eval
        const resultado = eval(expressao);
        setDisplay(Number.isInteger(resultado) ? resultado.toString() : parseFloat(resultado.toFixed(4)).toString());
      } catch {
        setDisplay('Erro');
      }
    } else {
      const partes = display.split(/[+\-×÷]/);
      const ultimaParte = partes[partes.length - 1];
      if (valor === '.' && ultimaParte.includes('.')) return;

      if (display === '0' && !['+', '-', '×', '÷'].includes(valor)) {
        setDisplay(valor === '.' ? '0.' : valor);
      } else {
        setDisplay(display + valor);
      }
    }
  };

  const botoes = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '=']
  ];

  return (
    <Modal visible={visivel} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.containerWrapper}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.titulo}>Calculadora Rápida</Text>
              <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#F4F5F7" />
              </TouchableOpacity>
            </View>

            <View style={styles.displayArea}>
              <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
                {display}
              </Text>
            </View>

            <View style={styles.teclado}>
              {botoes.map((linha, i) => (
                <View key={i} style={styles.linha}>
                  {linha.map((btn) => {
                    const isZero = btn === '0';
                    const isOperador = ['÷', '×', '-', '+', '='].includes(btn);
                    const isAcao = ['C', '⌫', '%'].includes(btn);

                    return (
                      <TouchableOpacity 
                        key={btn} 
                        activeOpacity={0.7}
                        style={[
                          styles.botao,
                          isZero && styles.botaoZero,
                          isOperador && styles.botaoOperador,
                          isAcao && styles.botaoAcao
                        ]} 
                        onPress={() => pressionarBotao(btn)}
                      >
                        <Text style={[
                          styles.botaoTexto,
                          isOperador && styles.botaoTextoOperador,
                          isAcao && styles.botaoTextoAcao
                        ]}>
                          {btn}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  containerWrapper: { width: '100%', maxWidth: 450, alignSelf: 'center' },
  container: { backgroundColor: '#1C1D25', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 25, borderWidth: 1, borderColor: '#2A2B34' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  titulo: { color: '#F4F5F7', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  closeBtn: { backgroundColor: '#0B0B0F', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34' },
  displayArea: { backgroundColor: '#0B0B0F', padding: 25, borderRadius: 20, marginBottom: 25, alignItems: 'flex-end', borderWidth: 1, borderColor: '#2A2B34' },
  displayText: { color: '#F4F5F7', fontSize: 48, fontWeight: '900' },
  teclado: { width: '100%' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  botao: { width: '22%', aspectRatio: 1, backgroundColor: '#2A2B34', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  botaoZero: { width: '48%', aspectRatio: 2.18, alignItems: 'flex-start', paddingLeft: 30 }, 
  botaoOperador: { backgroundColor: '#D4FF3A' },
  botaoAcao: { backgroundColor: '#262731' },
  botaoTexto: { color: '#F4F5F7', fontSize: 26, fontWeight: 'bold' },
  botaoTextoOperador: { color: '#0B0B0F' },
  botaoTextoAcao: { color: '#F4F5F7' }
});