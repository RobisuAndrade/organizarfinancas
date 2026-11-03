// Esconde a barra de baixo (a "pílula") quando a pessoa rola a lista para baixo e traz de volta
// quando rola um pouco para cima. Cada tela chama aoRolarBarra(y) no seu onScroll.
import { Animated } from 'react-native';

const CURSO = 90; // quanto precisa rolar para a barra sumir por completo

export const barraOculta = new Animated.Value(0); // 0 = visível, 1 = escondida
let ultimoY: number | null = null;
let acumulado = 0;

export function aoRolarBarra(y: number) {
  if (ultimoY === null) {
    ultimoY = y;
    return;
  }
  const delta = y - ultimoY;
  ultimoY = y;
  if (y <= 0) acumulado = 0;
  else acumulado = Math.min(CURSO, Math.max(0, acumulado + delta));
  barraOculta.setValue(acumulado / CURSO);
}

export function reiniciarBarra() {
  ultimoY = null;
  acumulado = 0;
  barraOculta.setValue(0);
}

// Para usar no lugar do Animated.event dos cabeçalhos: atualiza o valor da tela e avisa a barra
export function eventoRolagem(scrollY: Animated.Value) {
  return Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e: any) => aoRolarBarra(e?.nativeEvent?.contentOffset?.y ?? 0),
  });
}
