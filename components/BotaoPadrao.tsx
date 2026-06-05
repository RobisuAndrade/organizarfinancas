import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';

// Definimos o que o nosso botão pode receber de informação
interface BotaoPadraoProps extends TouchableOpacityProps {
  titulo: string;
  icone?: keyof typeof Feather.glyphMap; // Permite passar o nome de um ícone do Feather
  variante?: 'primario' | 'secundario' | 'perigo';
}

export default function BotaoPadrao({ titulo, icone, variante = 'primario', style, ...rest }: BotaoPadraoProps) {
  // Cores padrão (Primário)
  let bgCor = '#B04FCF';
  let textoCor = '#FFFFFF';
  let borderCor = '#B04FCF';

  // Mudamos as cores se a variante for diferente
  if (variante === 'secundario') {
    bgCor = '#1E0A24';
    textoCor = '#B04FCF';
    borderCor = '#2D1436';
  } else if (variante === 'perigo') {
    bgCor = '#FF4D4D15';
    textoCor = '#FF4D4D';
    borderCor = '#FF4D4D30';
  }

  return (
    <TouchableOpacity
      style={[
        styles.botao,
        { backgroundColor: bgCor, borderColor: borderCor },
        style // Permite aceitar margens/espaçamentos extras que passarmos nas telas
      ]}
      activeOpacity={0.7}
      {...rest}
    >
      {icone && <Feather name={icone} size={18} color={textoCor} style={styles.icone} />}
      <Text style={[styles.texto, { color: textoCor }]}>
        {titulo}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
    borderRadius: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  icone: {
    marginRight: 8,
  },
  texto: {
    fontWeight: 'bold',
    fontSize: 15,
  }
});