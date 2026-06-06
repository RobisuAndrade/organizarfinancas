import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Calculadora({ visivel, fechar }: { visivel: boolean, fechar: () => void }) {
  const [display, setDisplay] = useState('0');

  const pressionarBotao = (valor: string) => {
    if (valor === 'C') setDisplay('0');
    else if (valor === '=') {
      try {
        setDisplay(eval(display).toString());
      } catch {
        setDisplay('Erro');
      }
    } else {
      setDisplay(display === '0' ? valor : display + valor);
    }
  };

  const botoes = [
    ['C', '/', '*'],
    ['7', '8', '9', '-'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['0', '.']
  ];

  return (
    <Modal visible={visivel} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.titulo}>Calculadora Rápida</Text>
            <TouchableOpacity onPress={fechar}>
              <Feather name="x" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.displayArea}>
            <Text style={styles.displayText}>{display}</Text>
          </View>

          <View style={styles.teclado}>
            {botoes.map((linha, i) => (
              <View key={i} style={styles.linha}>
                {linha.map((btn) => (
                  <TouchableOpacity 
                    key={btn} 
                    style={[styles.botao, btn === '=' && styles.botaoIgual]} 
                    onPress={() => pressionarBotao(btn)}
                  >
                    <Text style={styles.botaoTexto}>{btn}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#1E0A24', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  titulo: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  displayArea: { backgroundColor: '#0F0414', padding: 20, borderRadius: 16, marginBottom: 20, alignItems: 'flex-end', borderWidth: 1, borderColor: '#2D1436' },
  displayText: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  teclado: { flex: 1 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  botao: { backgroundColor: '#2D1436', width: 70, height: 70, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  botaoIgual: { backgroundColor: '#B04FCF', flex: 1 },
  botaoTexto: { color: '#FFF', fontSize: 24, fontWeight: 'bold' }
});