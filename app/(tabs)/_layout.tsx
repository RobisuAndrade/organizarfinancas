import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Calculadora from './calculadora'; // Importando a calculadora

export default function Layout() {
  const [calcAberto, setCalcAberto] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0414' }}>
      
      {/* O Stack renderiza as páginas (index, gastos, etc) */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="resumo" />
        <Stack.Screen name="gastos" />
        <Stack.Screen name="compras" />
        <Stack.Screen name="metas" />
        <Stack.Screen name="renda" />
      </Stack>

      {/* BOTÃO FLUTUANTE GLOBAL */}
      <TouchableOpacity 
        style={styles.fabGlobal} 
        activeOpacity={0.8}
        onPress={() => setCalcAberto(true)}
      >
        {/* Ícone corrigido para a calculadora */}
        <MaterialCommunityIcons name="calculator" size={22} color="#FFF" />
      </TouchableOpacity>

      {/* MODAL GLOBAL DA CALCULADORA */}
      <Calculadora visivel={calcAberto} fechar={() => setCalcAberto(false)} />
      
    </View>
  );
}

const styles = StyleSheet.create({
  fabGlobal: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40, // Fica no topo da tela
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: '#B04FCF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Garante que ficará acima de tudo
    shadowColor: '#B04FCF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#D475EE'
  }
});