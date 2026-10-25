import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { Colors } from '../constants/theme';

interface LeitorNotaProps {
  aoLerCodigo: (url: string) => void;
  aoCancelar: () => void;
}

// Lado do quadrado de leitura (acompanha a largura da tela, com limite)
const LADO = Math.min(Dimensions.get('window').width * 0.66, 290);
const ESPESSURA = 4;
const TAMANHO_CANTO = 34;
const NIVEIS_ZOOM = [0, 0.08, 0.16];

export default function LeitorNota({ aoLerCodigo, aoCancelar }: LeitorNotaProps) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [leu, setLeu] = useState(false);
  const [lanterna, setLanterna] = useState(false);
  const [nivelZoom, setNivelZoom] = useState(0);
  const travado = useRef(false);

  // Linha que desce e sobe dentro do quadrado (mostra que está procurando o QR Code)
  const linha = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(linha, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(linha, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [linha]);

  if (!permissao) return <View style={styles.container} />; // Carregando

  if (!permissao.granted) {
    return (
      <View style={[styles.container, styles.centro]}>
        <Feather name="camera-off" size={40} color={Colors.muted} />
        <Text style={styles.textoPermissao}>Precisamos da câmera para ler o QR Code da nota</Text>
        <TouchableOpacity style={styles.botaoPrincipal} onPress={pedirPermissao}>
          <Text style={styles.textoBotaoPrincipal}>Permitir Câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoSecundario} onPress={aoCancelar}>
          <Text style={styles.textoBotaoSecundario}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const aoEscanear = ({ data }: { data: string }) => {
    if (travado.current) return;
    travado.current = true;
    setLeu(true);
    Vibration.vibrate(60);
    // Pequena pausa para o usuário ver o quadrado ficar verde ("leu!")
    setTimeout(() => aoLerCodigo(data.trim()), 350);
  };

  const corMira = leu ? Colors.success : Colors.lime;
  const alternarZoom = () => setNivelZoom((n) => (n + 1) % NIVEIS_ZOOM.length);

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        zoom={NIVEIS_ZOOM[nivelZoom]}
        enableTorch={lanterna}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={leu ? undefined : aoEscanear}
      />

      {/* Máscara escura em volta do quadrado, para dar foco no que importa */}
      <View style={styles.mascara} pointerEvents="none">
        <View style={styles.escuroTopo} />
        <View style={styles.linhaMeio}>
          <View style={styles.escuroLado} />
          <View style={{ width: LADO, height: LADO }}>
            <View style={[styles.canto, styles.cantoTE, { borderColor: corMira }]} />
            <View style={[styles.canto, styles.cantoTD, { borderColor: corMira }]} />
            <View style={[styles.canto, styles.cantoBE, { borderColor: corMira }]} />
            <View style={[styles.canto, styles.cantoBD, { borderColor: corMira }]} />
            {!leu && (
              <Animated.View
                style={[
                  styles.linhaVarredura,
                  { transform: [{ translateY: linha.interpolate({ inputRange: [0, 1], outputRange: [8, LADO - 12] }) }] },
                ]}
              />
            )}
            {leu && (
              <View style={styles.checkCentro}>
                <Feather name="check" size={44} color={Colors.success} />
              </View>
            )}
          </View>
          <View style={styles.escuroLado} />
        </View>
        <View style={styles.escuroBase}>
          <Text style={styles.dica}>
            {leu ? 'QR Code lido!' : 'Centralize o QR Code da nota dentro do quadrado'}
          </Text>
          {!leu && <Text style={styles.dicaPequena}>Se não ler, afaste um pouco o celular e use a lanterna</Text>}
        </View>
      </View>

      {/* Botões de apoio */}
      <View style={styles.barraBotoes}>
        <TouchableOpacity style={[styles.botaoRedondo, lanterna && styles.botaoRedondoAtivo]} onPress={() => setLanterna((l) => !l)}>
          <Feather name={lanterna ? 'zap' : 'zap-off'} size={20} color={lanterna ? Colors.background : Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.botaoCancelar} onPress={aoCancelar}>
          <Text style={styles.textoCancelar}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.botaoRedondo, nivelZoom > 0 && styles.botaoRedondoAtivo]} onPress={alternarZoom}>
          <Text style={[styles.textoZoom, nivelZoom > 0 && { color: Colors.background }]}>{nivelZoom + 1}x</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ESCURO = 'rgba(0,0,0,0.62)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centro: { justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: Colors.surface },
  mascara: { ...StyleSheet.absoluteFillObject },
  escuroTopo: { flex: 1, backgroundColor: ESCURO },
  linhaMeio: { flexDirection: 'row' },
  escuroLado: { flex: 1, backgroundColor: ESCURO },
  escuroBase: { flex: 1.3, backgroundColor: ESCURO, alignItems: 'center', paddingTop: 22, paddingHorizontal: 30 },
  dica: { color: Colors.text, fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  dicaPequena: { color: Colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },

  canto: { position: 'absolute', width: TAMANHO_CANTO, height: TAMANHO_CANTO },
  cantoTE: { top: 0, left: 0, borderTopWidth: ESPESSURA, borderLeftWidth: ESPESSURA, borderTopLeftRadius: 16 },
  cantoTD: { top: 0, right: 0, borderTopWidth: ESPESSURA, borderRightWidth: ESPESSURA, borderTopRightRadius: 16 },
  cantoBE: { bottom: 0, left: 0, borderBottomWidth: ESPESSURA, borderLeftWidth: ESPESSURA, borderBottomLeftRadius: 16 },
  cantoBD: { bottom: 0, right: 0, borderBottomWidth: ESPESSURA, borderRightWidth: ESPESSURA, borderBottomRightRadius: 16 },
  linhaVarredura: { position: 'absolute', left: 14, right: 14, height: 2, borderRadius: 1, backgroundColor: Colors.lime, opacity: 0.85 },
  checkCentro: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,230,118,0.12)', borderRadius: 16 },

  barraBotoes: { position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  botaoRedondo: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(28,29,37,0.92)', borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  botaoRedondoAtivo: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  textoZoom: { color: Colors.text, fontWeight: '900', fontSize: 14 },
  botaoCancelar: { backgroundColor: 'rgba(28,29,37,0.92)', borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 25 },
  textoCancelar: { color: Colors.danger, fontWeight: 'bold', fontSize: 14 },

  textoPermissao: { color: Colors.text, fontSize: 14, textAlign: 'center', marginTop: 16, marginBottom: 20 },
  botaoPrincipal: { backgroundColor: Colors.lime, paddingHorizontal: 26, paddingVertical: 14, borderRadius: 16 },
  textoBotaoPrincipal: { color: Colors.background, fontWeight: 'bold' },
  botaoSecundario: { marginTop: 12, padding: 12 },
  textoBotaoSecundario: { color: Colors.muted, fontWeight: 'bold' },
});
