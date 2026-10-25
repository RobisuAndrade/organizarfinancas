import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LeitorCodigoBarras({
  visivel,
  fechar,
  aoLerCodigo,
}: {
  visivel: boolean;
  fechar: () => void;
  aoLerCodigo: (codigo: string) => void;
}) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [jaLeu, setJaLeu] = useState(false);

  const aoEscanear = ({ data }: { data: string }) => {
    if (jaLeu) return;
    setJaLeu(true);
    aoLerCodigo(data);
    setTimeout(() => setJaLeu(false), 500);
  };

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={fechar}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.titulo}>Ler Código de Barras</Text>
          <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#F4F5F7" />
          </TouchableOpacity>
        </View>

        {!permissao ? (
          <View style={{ flex: 1 }} />
        ) : !permissao.granted ? (
          <View style={styles.permissaoBox}>
            <Feather name="camera-off" size={40} color="#8A8D98" />
            <Text style={styles.permissaoTexto}>Precisamos da câmera pra ler o código de barras do produto</Text>
            <TouchableOpacity style={styles.btnPermissao} onPress={pedirPermissao}>
              <Text style={styles.btnPermissaoTexto}>Permitir Câmera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraBox}>
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14'] }}
              onBarcodeScanned={jaLeu ? undefined : aoEscanear}
            />
            <View style={styles.mira} pointerEvents="none" />
          </View>
        )}

        <Text style={styles.dica}>Aponte a câmera pro código de barras do produto</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 10 },
  titulo: { color: '#F4F5F7', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  closeBtn: { backgroundColor: '#1C1D25', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34' },
  permissaoBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  permissaoTexto: { color: '#8A8D98', fontSize: 14, textAlign: 'center', marginTop: 15, marginBottom: 20 },
  btnPermissao: { backgroundColor: '#D4FF3A', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  btnPermissaoTexto: { color: '#0B0B0F', fontWeight: 'bold' },
  cameraBox: { flex: 1, borderRadius: 24, overflow: 'hidden', margin: 20, marginTop: 5, borderWidth: 1, borderColor: '#2A2B34' },
  mira: { position: 'absolute', top: '38%', left: '12%', right: '12%', height: 90, borderWidth: 2, borderColor: '#D4FF3A', borderRadius: 14 },
  dica: { color: '#8A8D98', fontSize: 12, textAlign: 'center', paddingBottom: 20 },
});
