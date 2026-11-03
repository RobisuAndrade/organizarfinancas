// Animação simples de "surgir no meio da tela": o cartão cresce de 90% para 100% enquanto aparece.
// Para trocar a animação depois, mexa só aqui (vale para todos os menus do início).
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

export default function CartaoAparece({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={[style, { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}
