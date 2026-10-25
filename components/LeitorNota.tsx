import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

interface LeitorNotaProps {
  aoLerCodigo: (url: string) => void;
  aoCancelar: () => void;
}

export default function LeitorNota({ aoLerCodigo, aoCancelar }: LeitorNotaProps) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [escaneado, setEscaneado] = useState(false);

  if (!permissao) return <View />; // Carregando

  if (!permissao.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.texto}>Precisamos da permissão para acessar a câmera</Text>
        <Button title="Permitir Câmera" onPress={pedirPermissao} />
        <Button title="Cancelar" color="red" onPress={aoCancelar} />
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setEscaneado(true);
    aoLerCodigo(data);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={escaneado ? undefined : handleBarCodeScanned}
      />
      <View style={styles.botoes}>
        <Button title="Cancelar" color="red" onPress={aoCancelar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  camera: { flex: 1 },
  texto: { textAlign: 'center', marginBottom: 20 },
  botoes: { padding: 20, backgroundColor: '#000' }
});