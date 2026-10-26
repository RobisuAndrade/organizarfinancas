// Ajuste de teclado para o app inteiro.
//
// Problema: no Android (tela de ponta a ponta) e dentro de Modais, o teclado cobria o campo que
// estava sendo digitado. Aqui o painel é levantado exatamente pela parte que o teclado cobre
// (medida de verdade na tela, então não soma duas vezes se o sistema já tiver ajustado sozinho),
// e a rolagem leva o campo em foco para a parte visível.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, ScrollView, ScrollViewProps, StyleProp, TextInput, View, ViewStyle } from 'react-native';

const EVENTO_MOSTRAR = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
const EVENTO_ESCONDER = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

// Painel que sobe junto com o teclado. Use no lugar do KeyboardAvoidingView.
export default function AvoidTeclado({
  children,
  style,
  aoMudarAltura,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  aoMudarAltura?: (altura: number) => void;
}) {
  const ref = useRef<View>(null);
  const [pad, setPad] = useState(0);
  const padRef = useRef(0);

  const aplicar = (valor: number) => {
    if (Math.abs(valor - padRef.current) < 1) return;
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {}
    padRef.current = valor;
    setPad(valor);
    aoMudarAltura?.(valor);
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const mostrar = Keyboard.addListener(EVENTO_MOSTRAR as any, (e: any) => {
      const topoTeclado = e?.endCoordinates?.screenY;
      if (typeof topoTeclado !== 'number') return;
      const medir = () =>
        ref.current?.measureInWindow((_x, y, _w, h) => {
          if (!h) return;
          aplicar(Math.max(0, Math.round(y + h - topoTeclado)));
        });
      // no Android espera o sistema terminar de ajustar a janela antes de medir
      if (Platform.OS === 'android') setTimeout(medir, 60);
      else medir();
    });
    const esconder = Keyboard.addListener(EVENTO_ESCONDER as any, () => aplicar(0));
    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);

  return (
    <View ref={ref} style={{ flex: 1 }} collapsable={false}>
      <View style={[{ flex: 1 }, style, { paddingBottom: pad }]}>{children}</View>
    </View>
  );
}

// Leva o campo que está em foco para a parte visível da rolagem
export function useAlinharAoTeclado(scrollRef: { current: any }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alinhar = () => {
    try {
      const input: any = (TextInput as any).State?.currentlyFocusedInput?.();
      const sv: any = scrollRef.current;
      if (!input || !sv) return;
      const interno = sv.getInnerViewRef?.() ?? sv.getInnerViewNode?.();
      if (!interno) return;
      input.measureLayout(
        interno,
        (_x: number, y: number) => {
          sv.scrollTo?.({ y: Math.max(0, y - 110), animated: true });
        },
        () => {}
      );
    } catch {}
  };

  const agendar = (atraso: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(alinhar, atraso);
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Keyboard.addListener('keyboardDidShow', () => agendar(120));
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // ao tocar num campo com o teclado já aberto (trocar de campo)
  return { onTouchEnd: () => agendar(350) };
}

// ScrollView que já alinha o campo em foco acima do teclado
export function ScrollTeclado(props: ScrollViewProps & { children?: ReactNode }) {
  const ref = useRef<ScrollView>(null);
  const { onTouchEnd } = useAlinharAoTeclado(ref);
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      {...props}
      onTouchEnd={(e) => {
        onTouchEnd();
        props.onTouchEnd?.(e);
      }}
    />
  );
}

// Altura atual do teclado (para dar espaço extra no fim de telas rolantes)
export function useAlturaTeclado() {
  const [altura, setAltura] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const a = Keyboard.addListener(EVENTO_MOSTRAR as any, (e: any) => setAltura(e?.endCoordinates?.height || 0));
    const b = Keyboard.addListener(EVENTO_ESCONDER as any, () => setAltura(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return altura;
}
