import { Feather } from '@expo/vector-icons';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardTypeOptions, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { COR } from './corLista';

// ─────────────────────────────────────────────────────────────
// SMOOTH INPUT: rótulo que sobe, borda que acende e brilho suave
// ─────────────────────────────────────────────────────────────
export default function CampoSuave({
  rotulo,
  valor,
  aoMudar,
  aoEnviar,
  autoFocus,
  icone,
  maxLength,
  teclado,
  autoCapitalizar,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (t: string) => void;
  aoEnviar?: () => void;
  autoFocus?: boolean;
  icone?: ComponentProps<typeof Feather>['name'];
  maxLength?: number;
  teclado?: KeyboardTypeOptions;
  autoCapitalizar?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const [focado, setFocado] = useState(false);
  const flutuando = focado || valor.length > 0;
  const foco = useRef(new Animated.Value(0)).current;
  const flut = useRef(new Animated.Value(flutuando ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(foco, { toValue: focado ? 1 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [focado]);
  useEffect(() => {
    Animated.timing(flut, { toValue: flutuando ? 1 : 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [flutuando]);

  const recuo = icone ? 42 : 16;

  return (
    <View style={styles.campoBox}>
      <Animated.View
        style={[styles.campoBrilho, { opacity: foco.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }) }]}
      />
      <Animated.View
        style={[
          styles.campoCaixa,
          {
            borderColor: foco.interpolate({ inputRange: [0, 1], outputRange: [COR.borda, COR.lima] }),
            backgroundColor: foco.interpolate({ inputRange: [0, 1], outputRange: [COR.grafite, '#101109'] }),
          },
        ]}
      >
        {!!icone && (
          <Feather name={icone} size={16} color={focado ? COR.lima : COR.cinza} style={{ position: 'absolute', left: 15, top: 20 }} />
        )}
        <Animated.Text
          style={[
            styles.campoRotulo,
            {
              left: recuo,
              top: flut.interpolate({ inputRange: [0, 1], outputRange: [18, 7] }),
              fontSize: flut.interpolate({ inputRange: [0, 1], outputRange: [14, 10] }),
              color: foco.interpolate({ inputRange: [0, 1], outputRange: [COR.cinza, COR.lima] }),
            },
          ]}
          numberOfLines={1}
        >
          {rotulo}
        </Animated.Text>
        <TextInput
          style={[styles.campoInput, { paddingLeft: recuo, paddingRight: valor.length > 0 ? 40 : 16 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
          value={valor}
          onChangeText={aoMudar}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          onSubmitEditing={aoEnviar}
          submitBehavior="submit"
          returnKeyType="done"
          autoFocus={autoFocus}
          maxLength={maxLength}
          keyboardType={teclado}
          autoCapitalize={autoCapitalizar}
          selectionColor={COR.lima}
        />
        {valor.length > 0 && (
          <TouchableOpacity style={styles.campoLimpar} onPress={() => aoMudar('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={14} color={COR.cinza} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}


const styles = StyleSheet.create({
  campoBox: { position: 'relative' },
  campoBrilho: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 19, backgroundColor: COR.lima },
  campoCaixa: { height: 56, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' },
  campoRotulo: { position: 'absolute', fontWeight: '600' },
  campoInput: { height: 56, paddingTop: 22, paddingBottom: 6, color: COR.texto, fontSize: 15, fontWeight: '600' },
  campoLimpar: { position: 'absolute', right: 12, top: 18, width: 20, height: 20, borderRadius: 10, backgroundColor: COR.borda, justifyContent: 'center', alignItems: 'center' },
});
