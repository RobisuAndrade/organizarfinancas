// Leitor de QR Code para a versão SITE (navegador do celular / Chrome).
// No navegador o expo-camera abre a câmera em baixa resolução e sem foco contínuo — por isso aqui
// usamos a câmera do navegador direto: alta resolução, foco contínuo, lanterna/zoom quando o aparelho deixa.
import { Feather } from '@expo/vector-icons';
import { createElement, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme';

interface LeitorNotaProps {
  aoLerCodigo: (url: string) => void;
  aoCancelar: () => void;
}

const LADO = Math.min(Dimensions.get('window').width * 0.78, 330);
const ESPESSURA = 4;
const TAMANHO_CANTO = 36;

// Leitor de QR em JavaScript (usado nos navegadores que não têm leitor de código embutido, como o Safari)
function carregarJsQR(): Promise<any> {
  const w = window as any;
  if (w.jsQR) return Promise.resolve(w.jsQR);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = () => resolve(w.jsQR);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function LeitorNota({ aoLerCodigo, aoCancelar }: LeitorNotaProps) {
  const videoRef = useRef<any>(null);
  const trackRef = useRef<any>(null);
  const travado = useRef(false);
  const aoLerRef = useRef(aoLerCodigo);
  aoLerRef.current = aoLerCodigo;

  const [erro, setErro] = useState<string | null>(null);
  const [leu, setLeu] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [lanterna, setLanterna] = useState(false);
  const [temLanterna, setTemLanterna] = useState(false);
  const [faixaZoom, setFaixaZoom] = useState<{ min: number; max: number } | null>(null);
  const [nivelZoom, setNivelZoom] = useState(0);

  const linha = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(linha, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(linha, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [linha]);

  useEffect(() => {
    let parou = false;
    let stream: any = null;
    let raf = 0;

    const iniciar = async () => {
      setErro(null);
      const nav: any = navigator;
      if (!nav.mediaDevices || !nav.mediaDevices.getUserMedia) {
        setErro('Este navegador não deixou usar a câmera. Abra o site pelo Chrome, com endereço https.');
        return;
      }
      try {
        stream = await nav.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch (e: any) {
        setErro(
          e && e.name === 'NotAllowedError'
            ? 'A câmera está bloqueada. Toque no cadeado ao lado do endereço do site, libere a câmera e tente de novo.'
            : 'Não consegui abrir a câmera deste aparelho.'
        );
        return;
      }
      if (parou) {
        stream.getTracks().forEach((t: any) => t.stop());
        return;
      }

      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      try {
        if (caps.focusMode && caps.focusMode.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        }
      } catch (e) {}
      setTemLanterna(!!caps.torch);
      if (caps.zoom && caps.zoom.max > caps.zoom.min) setFaixaZoom({ min: caps.zoom.min, max: caps.zoom.max });

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      try {
        await video.play();
      } catch (e) {}

      const w = window as any;
      const detector = w.BarcodeDetector ? new w.BarcodeDetector({ formats: ['qr_code'] }) : null;
      let jsQR: any = null;
      if (!detector) {
        try {
          jsQR = await carregarJsQR();
        } catch (e) {
          setErro('Não consegui carregar o leitor de QR Code. Verifique a internet e tente de novo.');
          return;
        }
      }

      const canvas = document.createElement('canvas');
      const ctx: any = canvas.getContext('2d', { willReadFrequently: true });
      let ocupado = false;
      let ultimo = 0;

      const passo = async (agora: number) => {
        if (parou || travado.current) return;
        raf = requestAnimationFrame(passo);
        if (ocupado || agora - ultimo < 140) return;
        if (video.readyState < 2 || !video.videoWidth) return;
        ultimo = agora;
        ocupado = true;
        try {
          // Lê só o pedaço central quadrado — exatamente o que aparece dentro do quadrado na tela
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const lado = Math.min(vw, vh);
          const tam = Math.min(lado, 900);
          canvas.width = tam;
          canvas.height = tam;
          ctx.drawImage(video, (vw - lado) / 2, (vh - lado) / 2, lado, lado, 0, 0, tam, tam);

          let texto: string | null = null;
          if (detector) {
            const achados = await detector.detect(canvas);
            if (achados && achados.length) texto = achados[0].rawValue;
          } else {
            const img = ctx.getImageData(0, 0, tam, tam);
            const r = jsQR(img.data, tam, tam, { inversionAttempts: 'dontInvert' });
            if (r && r.data) texto = r.data;
          }

          if (texto && !travado.current) {
            travado.current = true;
            setLeu(true);
            try {
              (navigator as any).vibrate && (navigator as any).vibrate(60);
            } catch (e) {}
            setTimeout(() => aoLerRef.current(texto!.trim()), 350);
          }
        } catch (e) {
          // frame ruim: ignora e tenta o próximo
        } finally {
          ocupado = false;
        }
      };
      raf = requestAnimationFrame(passo);
    };

    iniciar();

    return () => {
      parou = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t: any) => t.stop());
    };
  }, [tentativa]);

  const alternarLanterna = async () => {
    const novo = !lanterna;
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: novo }] });
      setLanterna(novo);
    } catch (e) {}
  };

  const alternarZoom = async () => {
    if (!faixaZoom) return;
    const proximo = (nivelZoom + 1) % 3;
    const valor = faixaZoom.min + (faixaZoom.max - faixaZoom.min) * [0, 0.3, 0.6][proximo];
    try {
      await trackRef.current.applyConstraints({ advanced: [{ zoom: valor }] });
      setNivelZoom(proximo);
    } catch (e) {}
  };

  // Tocar no quadrado pede para a câmera focar de novo
  const refocar = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
      setTimeout(() => track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {}), 900);
    } catch (e) {}
  };

  if (erro) {
    return (
      <View style={[styles.container, styles.centro]}>
        <Feather name="camera-off" size={40} color={Colors.muted} />
        <Text style={styles.textoErro}>{erro}</Text>
        <TouchableOpacity style={styles.botaoPrincipal} onPress={() => setTentativa((t) => t + 1)}>
          <Text style={styles.textoBotaoPrincipal}>Tentar de novo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoSecundario} onPress={aoCancelar}>
          <Text style={styles.textoBotaoSecundario}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const corMira = leu ? Colors.success : Colors.lime;

  return (
    <View style={styles.container}>
      <View style={styles.centroTela}>
        <TouchableOpacity activeOpacity={1} onPress={refocar} style={styles.quadrado}>
          {createElement('video', {
            ref: videoRef,
            autoPlay: true,
            muted: true,
            playsInline: true,
            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
          })}

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.canto, styles.cantoTE, { borderColor: corMira }]} />
            <View style={[styles.canto, styles.cantoTD, { borderColor: corMira }]} />
            <View style={[styles.canto, styles.cantoBE, { borderColor: corMira }]} />
            <View style={[styles.canto, styles.cantoBD, { borderColor: corMira }]} />
            {!leu && (
              <Animated.View
                style={[styles.linhaVarredura, { top: linha.interpolate({ inputRange: [0, 1], outputRange: [10, LADO - 14] }) }]}
              />
            )}
            {leu && (
              <View style={styles.checkCentro}>
                <Feather name="check" size={48} color={Colors.success} />
              </View>
            )}
          </View>
        </TouchableOpacity>

        <Text style={styles.dica}>{leu ? 'QR Code lido!' : 'Centralize o QR Code da nota dentro do quadrado'}</Text>
        {!leu && <Text style={styles.dicaPequena}>Toque no quadrado para focar de novo</Text>}
      </View>

      <View style={styles.barraBotoes}>
        {temLanterna ? (
          <TouchableOpacity style={[styles.botaoRedondo, lanterna && styles.botaoRedondoAtivo]} onPress={alternarLanterna}>
            <Feather name={lanterna ? 'zap' : 'zap-off'} size={20} color={lanterna ? Colors.background : Colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.botaoRedondoVazio} />
        )}

        <TouchableOpacity style={styles.botaoCancelar} onPress={aoCancelar}>
          <Text style={styles.textoCancelar}>Cancelar</Text>
        </TouchableOpacity>

        {faixaZoom ? (
          <TouchableOpacity style={[styles.botaoRedondo, nivelZoom > 0 && styles.botaoRedondoAtivo]} onPress={alternarZoom}>
            <Text style={[styles.textoZoom, nivelZoom > 0 && { color: Colors.background }]}>{nivelZoom + 1}x</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.botaoRedondoVazio} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centro: { justifyContent: 'center', alignItems: 'center', padding: 30 },
  centroTela: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80, paddingHorizontal: 24 },
  quadrado: { width: LADO, height: LADO, borderRadius: 26, overflow: 'hidden', backgroundColor: '#000', marginBottom: 26 },
  dica: { color: Colors.text, fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  dicaPequena: { color: Colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },

  canto: { position: 'absolute', width: TAMANHO_CANTO, height: TAMANHO_CANTO },
  cantoTE: { top: 10, left: 10, borderTopWidth: ESPESSURA, borderLeftWidth: ESPESSURA, borderTopLeftRadius: 16 },
  cantoTD: { top: 10, right: 10, borderTopWidth: ESPESSURA, borderRightWidth: ESPESSURA, borderTopRightRadius: 16 },
  cantoBE: { bottom: 10, left: 10, borderBottomWidth: ESPESSURA, borderLeftWidth: ESPESSURA, borderBottomLeftRadius: 16 },
  cantoBD: { bottom: 10, right: 10, borderBottomWidth: ESPESSURA, borderRightWidth: ESPESSURA, borderBottomRightRadius: 16 },
  linhaVarredura: { position: 'absolute', left: 18, right: 18, height: 2, borderRadius: 1, backgroundColor: Colors.lime, opacity: 0.85 },
  checkCentro: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,230,118,0.18)' },

  barraBotoes: { position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  botaoRedondo: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  botaoRedondoVazio: { width: 50, height: 50 },
  botaoRedondoAtivo: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  textoZoom: { color: Colors.text, fontWeight: '900', fontSize: 14 },
  botaoCancelar: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 25 },
  textoCancelar: { color: Colors.danger, fontWeight: 'bold', fontSize: 14 },

  textoErro: { color: Colors.text, fontSize: 14, textAlign: 'center', marginTop: 16, marginBottom: 20 },
  botaoPrincipal: { backgroundColor: Colors.lime, paddingHorizontal: 26, paddingVertical: 14, borderRadius: 16 },
  textoBotaoPrincipal: { color: Colors.background, fontWeight: 'bold' },
  botaoSecundario: { marginTop: 12, padding: 12 },
  textoBotaoSecundario: { color: Colors.muted, fontWeight: 'bold' },
});
