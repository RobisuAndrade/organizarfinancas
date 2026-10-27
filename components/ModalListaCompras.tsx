import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { onValue, push, ref, remove, set, update } from 'firebase/database';
import { ComponentProps, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { db } from '../firebaseConfig';
import AvoidTeclado from './AvoidTeclado';
import { DialogoNoModal, useDialogo } from '../hooks/useDialogo';
import { CATEGORIAS_MERCADO, categorizarProduto, chaveProduto, infoCategoria, normalizar } from '../utils/categoriasMercado';
import { formatarMoeda } from '../utils/formatadores';

type ItemLista = {
  id: string;
  nome: string;
  qtd: string;
  comprado: boolean;
  categoria?: string;
};

type Lista = {
  id: string;
  nome: string;
  criadoEm: string;
  itens: ItemLista[];
};

type HistoricoPreco = {
  chave: string;
  nome: string;
  menorPreco: number;
  mercado: string;
};

const COR = {
  lima: '#D4FF3A',
  lavanda: '#B8A6FF',
  grafite: '#0B0B0F',
  card: '#1C1D25',
  borda: '#2A2B34',
  texto: '#F4F5F7',
  cinza: '#8A8D98',
  verde: '#00E676',
  vermelho: '#FF3B5C',
};

const QTD_MAXIMA = 99;
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const dataLonga = (d: Date | string) => {
  const data = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(data.getTime())) return '';
  return `${data.toLocaleDateString('pt-BR')} • ${DIAS_SEMANA[data.getDay()]}`;
};

const suavizarLayout = () => {
  try {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  } catch {}
};

const vibrar = (tipo: 'leve' | 'sucesso' = 'leve') => {
  if (Platform.OS === 'web') return;
  try {
    if (tipo === 'sucesso') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {}
};

// ─────────────────────────────────────────────────────────────
// Entrada suave: o conteúdo sobe e aparece ao trocar de tela
// ─────────────────────────────────────────────────────────────
function Aparecer({ children, atraso = 0, cheio = false }: { children: ReactNode; atraso?: number; cheio?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, delay: atraso, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: v, flexShrink: 1, ...(cheio ? { flex: 1 } : null), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// SMOOTH INPUT: rótulo que sobe, borda que acende e brilho suave
// ─────────────────────────────────────────────────────────────
function CampoSuave({
  rotulo,
  valor,
  aoMudar,
  aoEnviar,
  autoFocus,
  icone,
  maxLength,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (t: string) => void;
  aoEnviar?: () => void;
  autoFocus?: boolean;
  icone?: ComponentProps<typeof Feather>['name'];
  maxLength?: number;
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

// ─────────────────────────────────────────────────────────────
// Certinho desenhado (a ponta curta aparece primeiro, depois a longa)
// ─────────────────────────────────────────────────────────────
function CheckDesenhado({
  progresso,
  tam,
  cor,
}: {
  progresso: Animated.Value | Animated.AnimatedInterpolation<number>;
  tam: number;
  cor: string;
}) {
  const largura = progresso.interpolate({ inputRange: [0, 1], outputRange: [0, tam], extrapolate: 'clamp' });
  const w = tam * 0.3;
  const h = tam * 0.58;
  const e = Math.max(2, tam * 0.13);
  return (
    <View style={{ width: tam, height: tam }}>
      <Animated.View style={{ width: largura, height: tam, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            left: tam * 0.5 - w / 2,
            top: tam * 0.44 - h / 2,
            width: w,
            height: h,
            borderRightWidth: e,
            borderBottomWidth: e,
            borderColor: cor,
            borderBottomRightRadius: e / 2,
            transform: [{ rotate: '45deg' }],
          }}
        />
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Trilho com carrinho: a barra enche e o carrinho vai empurrando a ponta
// ─────────────────────────────────────────────────────────────
function TrilhoCarrinho({
  valor,
  gatilho = 0,
  rodando = false,
  cor = COR.lima,
  mini = false,
}: {
  valor: Animated.Value;
  gatilho?: number;
  rodando?: boolean;
  cor?: string;
  mini?: boolean;
}) {
  const pulo = useRef(new Animated.Value(0)).current;
  const primeiro = useRef(true);

  // Cada item marcado dá um pulinho no carrinho
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    pulo.setValue(0);
    Animated.sequence([
      Animated.timing(pulo, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pulo, { toValue: 0, friction: 4, tension: 170, useNativeDriver: true }),
    ]).start();
  }, [gatilho]);

  // Na animação final o carrinho vai chacoalhando enquanto anda
  useEffect(() => {
    if (!rodando) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(pulo, { toValue: 0.55, duration: 130, useNativeDriver: true }),
        Animated.timing(pulo, { toValue: 0, duration: 130, useNativeDriver: true }),
      ])
    );
    laco.start();
    return () => {
      laco.stop();
      pulo.setValue(0);
    };
  }, [rodando]);

  const largura = valor.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });

  return (
    <View style={[styles.trilhoWrap, mini && styles.trilhoWrapMini]}>
      <View style={[styles.trilho, mini && styles.trilhoMini]}>
        <Animated.View style={[styles.trilhoFill, mini && styles.trilhoMini, { width: largura, backgroundColor: cor }]}>
          {/* riscos de velocidade atrás do carrinho */}
          <Animated.View style={[styles.riscos, mini && { display: 'none' }, { opacity: pulo.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.7] }) }]}>
            <View style={[styles.risco, { width: 14 }]} />
            <View style={[styles.risco, { width: 22, marginLeft: -6 }]} />
            <View style={[styles.risco, { width: 10 }]} />
          </Animated.View>
          <Animated.View
            style={[
              styles.carrinho,
              mini && styles.carrinhoMini,
              {
                transform: [
                  { translateY: pulo.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                  { rotate: pulo.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-14deg'] }) },
                ],
              },
            ]}
          >
            <Feather name="shopping-cart" size={mini ? 13 : 20} color={COR.grafite} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

function BarraCarrinho({ feitos, total, compacta = false }: { feitos: number; total: number; compacta?: boolean }) {
  const pct = total > 0 ? feitos / total : 0;
  const valor = useRef(new Animated.Value(pct)).current;
  const anterior = useRef(feitos);
  const [gatilho, setGatilho] = useState(0);
  const completo = total > 0 && feitos === total;

  useEffect(() => {
    Animated.timing(valor, { toValue: pct, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (feitos !== anterior.current) setGatilho((g) => g + 1);
    anterior.current = feitos;
  }, [pct, feitos]);

  if (compacta) {
    return (
      <View style={[styles.progressoBox, styles.progressoBoxMini]}>
        <Text style={styles.progressoMiniTexto}>{completo ? 'Completo' : `${feitos}/${total}`}</Text>
        <View style={{ flex: 1 }}>
          <TrilhoCarrinho valor={valor} gatilho={gatilho} cor={completo ? COR.verde : COR.lima} mini />
        </View>
        <Text style={[styles.progressoMiniTexto, { color: completo ? COR.verde : COR.lima }]}>{Math.round(pct * 100)}%</Text>
      </View>
    );
  }

  return (
    <View style={styles.progressoBox}>
      <View style={styles.progressoTopo}>
        <Text style={styles.progressoTexto}>
          {completo ? 'Compras completas!' : `${feitos} de ${total} ${total === 1 ? 'item' : 'itens'}`}
        </Text>
        <Text style={[styles.progressoPct, completo && { color: COR.verde }]}>{Math.round(pct * 100)}%</Text>
      </View>
      <TrilhoCarrinho valor={valor} gatilho={gatilho} cor={completo ? COR.verde : COR.lima} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Quantidade: setas para cima/baixo (segurar repete) ou arrastar o número como roleta
// ─────────────────────────────────────────────────────────────
function SeletorQuantidade({ valor, aoMudar }: { valor: number; aoMudar: (novo: number) => void }) {
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const base = useRef(valor);
  const repetir = useRef<ReturnType<typeof setInterval> | null>(null);
  const desliz = useRef(new Animated.Value(0)).current;
  const anterior = useRef(valor);

  const limitar = (n: number) => Math.max(1, Math.min(QTD_MAXIMA, n));

  useEffect(() => {
    if (anterior.current !== valor) {
      const dir = valor > anterior.current ? 1 : -1;
      desliz.setValue(dir * 14);
      Animated.timing(desliz, { toValue: 0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      anterior.current = valor;
    }
  }, [valor]);

  useEffect(() => () => pararRepeticao(), []);

  const pararRepeticao = () => {
    if (repetir.current) {
      clearInterval(repetir.current);
      repetir.current = null;
    }
  };

  const passo = (delta: number) => {
    const novo = limitar(valorRef.current + delta);
    if (novo !== valorRef.current) {
      aoMudarRef.current(novo);
      vibrar('leve');
    }
  };

  const segurar = (delta: number) => {
    pararRepeticao();
    repetir.current = setInterval(() => passo(delta), 90);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        base.current = valorRef.current;
      },
      onPanResponderMove: (_, g) => {
        // a cada ~14px arrastados para cima soma 1; para baixo, subtrai 1
        const novo = limitar(base.current + Math.round(-g.dy / 14));
        if (novo !== valorRef.current) aoMudarRef.current(novo);
      },
    })
  ).current;

  return (
    <View style={styles.seletorQtd}>
      <TouchableOpacity
        style={[styles.setaQtd, valor <= 1 && { opacity: 0.4 }]}
        onPress={() => passo(-1)}
        onLongPress={() => segurar(-1)}
        onPressOut={pararRepeticao}
        delayLongPress={350}
        disabled={valor <= 1}
      >
        <Feather name="chevron-down" size={20} color={COR.lima} />
      </TouchableOpacity>

      <View style={styles.caixaQtd} {...pan.panHandlers}>
        <Animated.Text
          style={[styles.numeroQtd, { opacity: desliz.interpolate({ inputRange: [-14, 0, 14], outputRange: [0.2, 1, 0.2] }), transform: [{ translateY: desliz }] }]}
        >
          {valor}
        </Animated.Text>
      </View>

      <TouchableOpacity
        style={[styles.setaQtd, valor >= QTD_MAXIMA && { opacity: 0.4 }]}
        onPress={() => passo(1)}
        onLongPress={() => segurar(1)}
        onPressOut={pararRepeticao}
        delayLongPress={350}
        disabled={valor >= QTD_MAXIMA}
      >
        <Feather name="chevron-up" size={20} color={COR.lima} />
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Linha de item com checkbox animado (caixa preenche, certinho se desenha, nome é riscado)
// ─────────────────────────────────────────────────────────────
function ItemLinha({
  item,
  categoria,
  preco,
  aoMarcar,
  aoExcluir,
  aoEditar,
}: {
  item: ItemLista;
  categoria: string;
  preco: HistoricoPreco | null;
  aoMarcar: () => void;
  aoExcluir: () => void;
  aoEditar: () => void;
}) {
  const cat = infoCategoria(categoria);
  const marc = useRef(new Animated.Value(item.comprado ? 1 : 0)).current;
  const toque = useRef(new Animated.Value(1)).current;
  const anel = useRef(new Animated.Value(1)).current;
  const [largTexto, setLargTexto] = useState(0);
  const primeiro = useRef(true);

  useEffect(() => {
    Animated.timing(marc, { toValue: item.comprado ? 1 : 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    if (item.comprado) {
      anel.setValue(0);
      Animated.timing(anel, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [item.comprado]);

  const aoPressionar = () => {
    vibrar('leve');
    toque.setValue(0.8);
    Animated.spring(toque, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }).start();
    aoMarcar();
  };

  return (
    <Animated.View style={[styles.itemRow, { opacity: marc.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={aoPressionar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Animated.View style={[styles.checkbox, { transform: [{ scale: toque }] }]}>
          <Animated.View
            style={[
              styles.checkAnel,
              {
                opacity: anel.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                transform: [{ scale: anel.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.checkFundo,
              {
                opacity: marc.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
                transform: [{ scale: marc.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.12, 1] }) }],
              },
            ]}
          />
          <CheckDesenhado progresso={marc.interpolate({ inputRange: [0.35, 1], outputRange: [0, 1], extrapolate: 'clamp' })} tam={18} cor={COR.grafite} />
        </Animated.View>
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
          <Animated.Text
            style={[styles.itemNome, { color: marc.interpolate({ inputRange: [0, 1], outputRange: [COR.texto, COR.cinza] }) }]}
            numberOfLines={1}
            onLayout={(e) => setLargTexto(e.nativeEvent.layout.width)}
          >
            {item.nome}
          </Animated.Text>
          <Animated.View
            style={[styles.riscado, { width: marc.interpolate({ inputRange: [0, 1], outputRange: [0, largTexto], extrapolate: 'clamp' }) }]}
          />
        </View>
        <Text style={styles.itemQtd} numberOfLines={1}>
          Qtd: {item.qtd}  •  <Text style={{ color: cat.cor, fontWeight: 'bold' }}>{cat.emoji} {cat.nome}</Text>
        </Text>
        {!!preco && !item.comprado && (
          <Text style={styles.itemPreco} numberOfLines={1}>
            Menor preço: {formatarMoeda(preco.menorPreco)} ({preco.mercado})
          </Text>
        )}
      </View>

      <View style={styles.acoesItem}>
        <TouchableOpacity onPress={aoExcluir} style={styles.btnLixo}>
          <Feather name="trash-2" size={16} color={COR.vermelho} />
        </TouchableOpacity>
        <TouchableOpacity onPress={aoEditar} style={styles.btnLixo}>
          <Feather name="edit-2" size={16} color={COR.lima} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Animação final: carrinho percorre a barra e vira um certinho no meio da tela
// ─────────────────────────────────────────────────────────────
function Celebracao({ total, aoTerminar }: { total: number; aoTerminar: () => void }) {
  const fundo = useRef(new Animated.Value(0)).current;
  const viagem = useRef(new Animated.Value(0)).current;
  const sai = useRef(new Animated.Value(0)).current;
  const selo = useRef(new Animated.Value(0)).current;
  const traco = useRef(new Animated.Value(0)).current;
  const onda = useRef(new Animated.Value(0)).current;
  const texto = useRef(new Animated.Value(0)).current;
  const confetes = useRef(Array.from({ length: 14 }, () => new Animated.Value(0))).current;
  const [rodando, setRodando] = useState(true);
  const encerrado = useRef(false);
  const aoTerminarRef = useRef(aoTerminar);
  aoTerminarRef.current = aoTerminar;

  const encerrar = () => {
    if (encerrado.current) return;
    encerrado.current = true;
    Animated.timing(fundo, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => aoTerminarRef.current());
  };

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    Animated.timing(fundo, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    Animated.timing(viagem, { toValue: 1, duration: 1100, delay: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (!finished || !ativo) return;
      setRodando(false);
      vibrar('sucesso');
      Animated.parallel([
        Animated.timing(sai, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(selo, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
        Animated.timing(onda, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(texto, { toValue: 1, duration: 350, delay: 220, useNativeDriver: true }),
        Animated.timing(traco, { toValue: 1, duration: 400, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ...confetes.map((c, i) => Animated.timing(c, { toValue: 1, duration: 850, delay: i * 18, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
      ]).start();
      timer = setTimeout(() => {
        if (ativo) encerrar();
      }, 2400);
    });

    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const CORES_CONFETE = [COR.lima, COR.lavanda, COR.verde, '#FFFFFF'];

  return (
    <Animated.View style={[styles.celebFundo, { opacity: fundo }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={encerrar} />
      <Animated.View
        style={[styles.celebCard, { pointerEvents: 'none', transform: [{ scale: fundo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}
      >
        <View style={styles.celebPalco}>
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              opacity: sai.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ scale: sai.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }) }],
            }}
          >
            <TrilhoCarrinho valor={viagem} rodando={rodando} />
          </Animated.View>

          {confetes.map((c, i) => {
            const ang = (i / confetes.length) * Math.PI * 2;
            const raio = i % 2 === 0 ? 92 : 68;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.confete,
                  {
                    backgroundColor: CORES_CONFETE[i % CORES_CONFETE.length],
                    opacity: c.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                    transform: [
                      { translateX: c.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * raio] }) },
                      { translateY: c.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * raio] }) },
                      { scale: c.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0.6] }) },
                    ],
                  },
                ]}
              />
            );
          })}

          <Animated.View
            style={[
              styles.celebOnda,
              {
                opacity: onda.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                transform: [{ scale: onda.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.celebSelo,
              { opacity: selo.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ scale: selo }] },
            ]}
          >
            <CheckDesenhado progresso={traco} tam={56} cor={COR.grafite} />
          </Animated.View>
        </View>

        <Animated.Text
          style={[styles.celebTitulo, { opacity: texto, transform: [{ translateY: texto.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
        >
          Compras completas!
        </Animated.Text>
        <Animated.Text style={[styles.celebSub, { opacity: texto }]}>
          {total} {total === 1 ? 'item' : 'itens'} no carrinho. Tudo certinho!
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// TELA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ModalListaCompras({ visivel, fechar }: { visivel: boolean; fechar: () => void }) {
  const { confirmar } = useDialogo();
  const { height: alturaTela } = useWindowDimensions();

  // Abertura/fechamento suave do painel (em vez do "pulo" padrão do Modal)
  const [montado, setMontado] = useState(visivel);
  const entrada = useRef(new Animated.Value(visivel ? 1 : 0)).current;
  useEffect(() => {
    if (visivel) {
      setMontado(true);
      entrada.setValue(0);
      Animated.timing(entrada, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(entrada, { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMontado(false);
      });
    }
  }, [visivel]);

  const [listas, setListas] = useState<any>({});
  const [notas, setNotas] = useState<any>({});
  const [aprendidas, setAprendidas] = useState<Record<string, string>>({});
  const [listaAtualId, setListaAtualId] = useState<string | null>(null);

  const [criando, setCriando] = useState(false);
  const [nomeNova, setNomeNova] = useState('');

  const [renomeando, setRenomeando] = useState(false);
  const [nomeEditado, setNomeEditado] = useState('');

  const [addAberto, setAddAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState('');

  // Cabeçalho que acompanha a rolagem: sai suavemente ao descer a lista e volta ao subir
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const [alturaTopo, setAlturaTopo] = useState(0);
  const translateTopo = useMemo(
    () => Animated.multiply(Animated.diffClamp(scrollY, 0, Math.max(alturaTopo, 1)), -1),
    [alturaTopo]
  );
  const [nomeItem, setNomeItem] = useState('');
  const [qtdItem, setQtdItem] = useState(1);
  const [catEscolhida, setCatEscolhida] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('Todas');
  const [celebrando, setCelebrando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alturaTeclado, setAlturaTeclado] = useState(0);

  useEffect(() => {
    const unsubListas = onValue(ref(db, 'listasCompras'), (snap) => setListas(snap.val() || {}));
    const unsubNotas = onValue(ref(db, 'mercado/notas'), (snap) => setNotas(snap.val() || {}));
    const unsubCats = onValue(ref(db, 'mercado/categoriasAprendidas'), (snap) => setAprendidas(snap.val() || {}));
    return () => {
      unsubListas();
      unsubNotas();
      unsubCats();
    };
  }, []);

  // Histórico de menor preço já pago, por produto (olhando todas as notas registradas)
  const historico: HistoricoPreco[] = useMemo(() => {
    const grupos: { [chave: string]: { nome: string; valorUnitario: number; mercado: string }[] } = {};
    Object.keys(notas).forEach((notaId: string) => {
      const nota = notas[notaId];
      const itens = nota?.itens || {};
      Object.keys(itens).forEach((idx: string) => {
        const it = itens[idx];
        if (!it || !it.nome) return;
        const chave = chaveProduto(it.nome);
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push({
          nome: it.nome,
          valorUnitario: Number(it.valorUnitario) || 0,
          mercado: nota.mercado || 'Mercado',
        });
      });
    });
    return Object.keys(grupos).map((chave) => {
      const lista = grupos[chave];
      const comPreco = lista.filter((i) => i.valorUnitario > 0);
      const menor = comPreco.length ? comPreco.reduce((a, b) => (b.valorUnitario < a.valorUnitario ? b : a)) : lista[0];
      return { chave, nome: menor.nome, menorPreco: menor.valorUnitario, mercado: menor.mercado };
    });
  }, [notas]);

  const buscarMenorPreco = (nomeProduto: string): HistoricoPreco | null => {
    if (!nomeProduto.trim()) return null;
    const chaveExata = chaveProduto(nomeProduto);
    const exato = historico.find((h) => h.chave === chaveExata);
    if (exato) return exato;
    // Se não achou igual, procura algo parecido (contém o texto digitado)
    const termo = normalizar(nomeProduto);
    if (termo.length < 3) return null;
    const parecido = historico.filter((h) => normalizar(h.nome).includes(termo));
    if (!parecido.length) return null;
    return parecido.reduce((a, b) => (b.menorPreco > 0 && b.menorPreco < a.menorPreco ? b : a));
  };

  const listasArray: Lista[] = useMemo(() => {
    return Object.keys(listas)
      .map((id: string): Lista => {
        const l = listas[id];
        const itensObj = l?.itens || {};
        const itens: ItemLista[] = Object.keys(itensObj).map((itemId) => ({
          id: itemId,
          nome: itensObj[itemId]?.nome || '',
          qtd: itensObj[itemId]?.qtd || '1',
          comprado: !!itensObj[itemId]?.comprado,
          categoria: itensObj[itemId]?.categoria || '',
        }));
        return { id, nome: l?.nome || 'Lista de Compras', criadoEm: l?.criadoEm || '', itens };
      })
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  }, [listas]);

  const listaAtual = listaAtualId ? listasArray.find((l) => l.id === listaAtualId) || null : null;

  // Itens da lista aberta, já com a categoria (a gravada, ou a detectada para itens antigos)
  const itensComCat = useMemo(
    () => (listaAtual ? listaAtual.itens.map((it) => ({ ...it, categoria: it.categoria || categorizarProduto(it.nome, aprendidas) })) : []),
    [listaAtual, aprendidas]
  );

  const contagemCat = useMemo(() => {
    const m: Record<string, number> = {};
    itensComCat.forEach((it) => {
      m[it.categoria] = (m[it.categoria] || 0) + 1;
    });
    return m;
  }, [itensComCat]);

  const filtroAtivo = filtro !== 'Todas' && contagemCat[filtro] ? filtro : 'Todas';
  // Busca por nome (ignora o filtro de categoria enquanto você procura)
  const termoBusca = buscaAberta ? normalizar(busca) : '';
  const itensVisiveis = termoBusca
    ? itensComCat.filter((it) => normalizar(it.nome).includes(termoBusca))
    : filtroAtivo === 'Todas'
    ? itensComCat
    : itensComCat.filter((it) => it.categoria === filtroAtivo);
  const totalItens = itensComCat.length;
  const totalFeitos = itensComCat.filter((i) => i.comprado).length;

  // Dispara a animação final quando o ÚLTIMO item é marcado (e não ao abrir uma lista já completa)
  const progressoRef = useRef<{ id: string; feitos: number } | null>(null);
  useEffect(() => {
    if (!listaAtual) {
      progressoRef.current = null;
      return;
    }
    const total = listaAtual.itens.length;
    const feitos = listaAtual.itens.filter((i) => i.comprado).length;
    const ant = progressoRef.current;
    if (ant && ant.id === listaAtual.id && feitos > ant.feitos && total > 0 && feitos === total) {
      setCelebrando(true);
    }
    progressoRef.current = { id: listaAtual.id, feitos };
  }, [listaAtual]);

  const abrirLista = (id: string | null) => {
    suavizarLayout();
    scrollY.setValue(0);
    setListaAtualId(id);
    setFiltro('Todas');
    setAddAberto(false);
    setRenomeando(false);
    setBuscaAberta(false);
    setBusca('');
    setNomeItem('');
    setQtdItem(1);
    setCatEscolhida(null);
    setEditandoId(null);
  };

  const iniciarEdicao = (it: ItemLista & { categoria: string }) => {
    suavizarLayout();
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
    setEditandoId(it.id);
    setNomeItem(it.nome);
    setQtdItem(Math.max(1, Math.min(QTD_MAXIMA, parseInt(it.qtd, 10) || 1)));
    setCatEscolhida(it.categoria);
    setBuscaAberta(false);
    setBusca('');
    setAddAberto(true);
  };

  const cancelarEdicao = () => {
    suavizarLayout();
    setEditandoId(null);
    setNomeItem('');
    setQtdItem(1);
    setCatEscolhida(null);
  };

  const iniciarCriacao = () => {
    setNomeNova('');
    setCriando(true);
  };

  const criarLista = async () => {
    const agora = new Date();
    const nome = nomeNova.trim() || `Lista ${agora.toLocaleDateString('pt-BR')}`;
    const novaRef = push(ref(db, 'listasCompras'));
    await set(novaRef, { nome, criadoEm: agora.toISOString(), itens: {} });
    setCriando(false);
    setNomeNova('');
    abrirLista(novaRef.key);
  };

  const salvarNome = async () => {
    if (!listaAtualId) return;
    await update(ref(db, `listasCompras/${listaAtualId}`), { nome: nomeEditado.trim() || 'Lista de Compras' });
    setRenomeando(false);
  };

  const excluirLista = async (id: string, nome: string) => {
    const ok = await confirmar({
      titulo: 'Excluir lista',
      mensagem: `Apagar "${nome}" e todos os itens dela?`,
      perigo: true,
    });
    if (!ok) return;
    await remove(ref(db, `listasCompras/${id}`));
    if (listaAtualId === id) abrirLista(null);
  };

  const categoriaDetectada = nomeItem.trim() ? categorizarProduto(nomeItem, aprendidas) : null;
  const categoriaFinal = catEscolhida || categoriaDetectada;

  const adicionarItem = async () => {
    if (!listaAtualId || !nomeItem.trim()) return;
    if (editandoId) {
      const id = editandoId;
      const novosDados = { nome: nomeItem.trim(), qtd: String(qtdItem), categoria: categoriaFinal || 'Outros' };
      suavizarLayout();
      Keyboard.dismiss();
      setEditandoId(null);
      setNomeItem('');
      setQtdItem(1);
      setCatEscolhida(null);
      setAddAberto(false);
      vibrar('leve');
      await update(ref(db, `listasCompras/${listaAtualId}/itens/${id}`), novosDados);
      return;
    }
    const novoItemRef = push(ref(db, `listasCompras/${listaAtualId}/itens`));
    const dados = {
      nome: nomeItem.trim(),
      qtd: String(qtdItem),
      comprado: false,
      categoria: categoriaFinal || 'Outros',
    };
    setNomeItem('');
    setQtdItem(1);
    setCatEscolhida(null);
    setAddAberto(true);
    vibrar('leve');
    await set(novoItemRef, dados);
  };

  const alternarComprado = async (itemId: string, comprado: boolean) => {
    if (!listaAtualId) return;
    await update(ref(db, `listasCompras/${listaAtualId}/itens/${itemId}`), { comprado: !comprado });
  };

  const excluirItem = async (itemId: string) => {
    if (!listaAtualId) return;
    if (editandoId === itemId) cancelarEdicao();
    await remove(ref(db, `listasCompras/${listaAtualId}/itens/${itemId}`));
  };

  const fecharTudo = () => {
    setCriando(false);
    setCelebrando(false);
    abrirLista(null);
    fechar();
  };

  // Botão "voltar" do Android: desfaz um passo de cada vez
  const voltarOuFechar = () => {
    if (celebrando) setCelebrando(false);
    else if (criando) setCriando(false);
    else if (listaAtual) abrirLista(null);
    else fecharTudo();
  };

  const abrirAbaAdicionar = () => {
    suavizarLayout();
    setBuscaAberta(false);
    setBusca('');
    setAddAberto((v) => !v);
  };

  const abrirAbaBusca = () => {
    suavizarLayout();
    setAddAberto(false);
    if (buscaAberta) {
      setBuscaAberta(false);
      setBusca('');
    } else {
      setBuscaAberta(true);
    }
  };

  const alternarAdd = () => {
    suavizarLayout();
    setAddAberto((v) => !v);
  };

  const escolherFiltro = (f: string) => {
    suavizarLayout();
    setFiltro(f);
  };

  const dicaPreco = buscarMenorPreco(nomeItem);
  const addVisivel = addAberto || totalItens === 0;
  const telaCheia = !!listaAtual && !criando;
  const alturaItens = Math.max(150, alturaTela * 0.9 - 330);

  return (
    <Modal visible={montado} animationType="none" transparent statusBarTranslucent onRequestClose={voltarOuFechar}>
      <AvoidTeclado aoMudarAltura={setAlturaTeclado}>
        <View style={styles.overlay}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', opacity: entrada }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={fecharTudo} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              telaCheia && styles.sheetCheia,
              telaCheia && { height: Math.max(300, alturaTela - alturaTeclado), maxHeight: Math.max(300, alturaTela - alturaTeclado), flexGrow: 0, flexShrink: 0 },
              { opacity: entrada.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 1] }), transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [alturaTela * 0.35, 0] }) }] },
            ]}
          >
            {criando ? (
              // ───────── NOVA LISTA: nome em destaque, data embaixo ─────────
              <Aparecer key="criando">
                <View style={styles.header}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.titulo}>Nova lista</Text>
                    <Text style={styles.sub}>Dê um nome ou siga só com a data</Text>
                  </View>
                  <TouchableOpacity onPress={() => setCriando(false)} style={styles.closeBtn}>
                    <Feather name="x" size={20} color={COR.texto} />
                  </TouchableOpacity>
                </View>

                <CampoSuave rotulo="Nome da lista (opcional)" valor={nomeNova} aoMudar={setNomeNova} aoEnviar={criarLista} autoFocus icone="edit-3" maxLength={40} />

                <View style={styles.dataLinha}>
                  <Feather name="calendar" size={14} color={COR.lima} />
                  <Text style={styles.dataTexto}>{dataLonga(new Date())}</Text>
                </View>

                <TouchableOpacity style={styles.btnPrimario} onPress={criarLista} activeOpacity={0.85}>
                  <Feather name="check" size={18} color={COR.grafite} style={{ marginRight: 8 }} />
                  <Text style={styles.btnPrimarioTexto}>{nomeNova.trim() ? 'Criar lista' : 'Criar só com a data'}</Text>
                </TouchableOpacity>
              </Aparecer>
            ) : !listaAtual ? (
              // ───────── TODAS AS LISTAS ─────────
              <Aparecer key="listas">
                <View style={styles.header}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.titulo}>Listas de Compras</Text>
                    <Text style={styles.sub}>
                      {listasArray.length} {listasArray.length === 1 ? 'lista' : 'listas'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={fecharTudo} style={styles.closeBtn}>
                    <Feather name="x" size={20} color={COR.texto} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btnPrimario} onPress={iniciarCriacao} activeOpacity={0.85}>
                  <Feather name="plus" size={18} color={COR.grafite} style={{ marginRight: 8 }} />
                  <Text style={styles.btnPrimarioTexto}>Nova lista</Text>
                </TouchableOpacity>

                <ScrollView style={{ flexShrink: 1, marginTop: 14, maxHeight: alturaItens + 60 }} showsVerticalScrollIndicator={false}>
                  {listasArray.length === 0 ? (
                    <View style={styles.vazio}>
                      <Feather name="clipboard" size={42} color={COR.borda} />
                      <Text style={styles.vazioTexto}>Nenhuma lista ainda.{'\n'}Crie uma pra organizar a próxima compra.</Text>
                    </View>
                  ) : (
                    listasArray.map((l) => {
                      const feitos = l.itens.filter((i) => i.comprado).length;
                      const completa = l.itens.length > 0 && feitos === l.itens.length;
                      return (
                        <TouchableOpacity key={l.id} style={styles.cardLista} activeOpacity={0.8} onPress={() => abrirLista(l.id)}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardListaNome} numberOfLines={1}>{l.nome}</Text>
                            <Text style={styles.cardListaInfo}>
                              {l.itens.length} {l.itens.length === 1 ? 'item' : 'itens'}
                              {l.itens.length > 0 ? ` • ${feitos} marcado${feitos === 1 ? '' : 's'}` : ''}
                              {l.criadoEm ? ` • ${new Date(l.criadoEm).toLocaleDateString('pt-BR')}` : ''}
                            </Text>
                            {l.itens.length > 0 && (
                              <View style={styles.miniTrilho}>
                                <View
                                  style={[
                                    styles.miniPreench,
                                    { width: `${Math.round((feitos / l.itens.length) * 100)}%`, backgroundColor: completa ? COR.verde : COR.lima },
                                  ]}
                                />
                              </View>
                            )}
                          </View>
                          <TouchableOpacity onPress={() => excluirLista(l.id, l.nome)} style={styles.btnLixo}>
                            <Feather name="trash-2" size={16} color={COR.vermelho} />
                          </TouchableOpacity>
                          <Feather name="chevron-right" size={18} color={COR.cinza} />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </Aparecer>
            ) : (
              // ───────── LISTA ABERTA ─────────
              <Aparecer key={`lista-${listaAtual.id}`} cheio>
                <View style={{ flex: 1, overflow: 'hidden' }}>
                {/* ITENS */}
                <Animated.ScrollView
                  ref={scrollRef}
                  onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                  scrollEventThrottle={16}
                  contentContainerStyle={{ paddingTop: alturaTopo }}
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  onScrollBeginDrag={() => Keyboard.dismiss()}
                >
                  {itensVisiveis.length === 0 ? (
                    <View style={styles.vazio}>
                      <Feather name="shopping-bag" size={36} color={COR.borda} />
                      <Text style={styles.vazioTexto}>
                        {totalItens === 0 ? 'Adicione os produtos que precisam comprar.' : termoBusca ? 'Nada encontrado com esse nome.' : 'Nenhum item nessa categoria.'}
                      </Text>
                    </View>
                  ) : (
                    itensVisiveis.map((it) => (
                      <ItemLinha
                        key={it.id}
                        item={it}
                        categoria={it.categoria}
                        preco={buscarMenorPreco(it.nome)}
                        aoMarcar={() => alternarComprado(it.id, it.comprado)}
                        aoExcluir={() => excluirItem(it.id)}
                        aoEditar={() => iniciarEdicao(it)}
                      />
                    ))
                  )}
                </Animated.ScrollView>
                  <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: COR.card, transform: [{ translateY: translateTopo }] }}>
                <Pressable
                  accessible={false}
                  onPress={() => Keyboard.dismiss()}
                  onLayout={(e) => {
                    const h = Math.round(e.nativeEvent.layout.height);
                    if (h > 0 && Math.abs(h - alturaTopo) > 1) setAlturaTopo(h);
                  }}
                >
                <View style={styles.header}>
                  <TouchableOpacity onPress={() => abrirLista(null)} style={styles.closeBtn}>
                    <Feather name="arrow-left" size={20} color={COR.texto} />
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    {renomeando ? (
                      <View style={styles.renomearLinha}>
                        <View style={{ flex: 1 }}>
                          <CampoSuave rotulo="Nome da lista" valor={nomeEditado} aoMudar={setNomeEditado} aoEnviar={salvarNome} autoFocus maxLength={40} />
                        </View>
                        <TouchableOpacity onPress={salvarNome} style={styles.btnConfirmarRenome}>
                          <Feather name="check" size={18} color={COR.grafite} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setRenomeando(false)} style={styles.btnCancelarRenome}>
                          <Feather name="x" size={18} color={COR.cinza} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View style={styles.renomearLinha}>
                          <Text style={styles.tituloLista} numberOfLines={1}>{listaAtual.nome}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              setNomeEditado(listaAtual.nome);
                              setRenomeando(true);
                            }}
                            style={styles.btnEditarNome}
                          >
                            <Feather name="edit-2" size={14} color={COR.lima} />
                          </TouchableOpacity>
                        </View>
                        {!!listaAtual.criadoEm && <Text style={styles.sub}>{dataLonga(listaAtual.criadoEm)}</Text>}
                      </>
                    )}
                  </View>

                  <TouchableOpacity onPress={fecharTudo} style={styles.closeBtn}>
                    <Feather name="x" size={20} color={COR.texto} />
                  </TouchableOpacity>
                </View>

                {totalItens > 0 && <BarraCarrinho feitos={totalFeitos} total={totalItens} compacta={buscaAberta} />}

                {/* ABAS: ADICIONAR / BUSCAR */}
                {totalItens > 0 && !editandoId && (
                  <View style={styles.abasTopo}>
                    <TouchableOpacity
                      style={[styles.aba, { borderColor: `${COR.lima}66` }, addAberto && { backgroundColor: COR.lima, borderColor: COR.lima, borderStyle: 'solid' }]}
                      onPress={abrirAbaAdicionar}
                      activeOpacity={0.85}
                    >
                      <Feather name="plus" size={15} color={addAberto ? COR.grafite : COR.lima} />
                      <Text style={[styles.abaTexto, { color: addAberto ? COR.grafite : COR.lima }]}>Adicionar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.aba, { borderColor: `${COR.lavanda}66` }, buscaAberta && { backgroundColor: COR.lavanda, borderColor: COR.lavanda, borderStyle: 'solid' }]}
                      onPress={abrirAbaBusca}
                      activeOpacity={0.85}
                    >
                      <Feather name="search" size={15} color={buscaAberta ? COR.grafite : COR.lavanda} />
                      <Text style={[styles.abaTexto, { color: buscaAberta ? COR.grafite : COR.lavanda }]}>Buscar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ADICIONAR ITEM */}
                {addVisivel ? (
                  <View style={styles.cardAdicionar}>
                    {!!editandoId && (
                      <View style={styles.editandoTopo}>
                        <Feather name="edit-2" size={13} color={COR.lima} />
                        <Text style={styles.editandoTexto}>Editando item</Text>
                        <TouchableOpacity onPress={cancelarEdicao} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.editandoCancelar}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <CampoSuave rotulo="Produto (ex: Arroz 5kg)" valor={nomeItem} aoMudar={setNomeItem} aoEnviar={adicionarItem} icone="shopping-bag" maxLength={60} />

                    <View style={styles.catCabeca}>
                      <Text style={styles.rotuloPeq}>Categoria</Text>
                      <Text style={styles.dicaPeq}>{catEscolhida ? 'escolhida por você' : categoriaDetectada ? 'detectada automaticamente' : ''}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingRight: 6 }}>
                      {CATEGORIAS_MERCADO.map((c) => {
                        const escolhida = catEscolhida === c.nome;
                        const auto = !catEscolhida && categoriaDetectada === c.nome;
                        return (
                          <TouchableOpacity
                            key={c.nome}
                            activeOpacity={0.8}
                            onPress={() => setCatEscolhida(escolhida ? null : c.nome)}
                            style={[
                              styles.catChip,
                              (escolhida || auto) && { backgroundColor: `${c.cor}25`, borderColor: c.cor },
                              auto && { borderStyle: 'dashed' },
                            ]}
                          >
                            <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                            <Text style={[styles.catChipTexto, (escolhida || auto) && { color: c.cor }]}>{c.nome}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.linhaQtdAdd}>
                      <View>
                        <Text style={[styles.rotuloPeq, { marginBottom: 6 }]}>Quantidade</Text>
                        <SeletorQuantidade valor={qtdItem} aoMudar={setQtdItem} />
                      </View>
                      <TouchableOpacity
                        style={[styles.btnAdicionar, !nomeItem.trim() && { opacity: 0.4 }]}
                        onPress={adicionarItem}
                        disabled={!nomeItem.trim()}
                        activeOpacity={0.85}
                      >
                        <Feather name={editandoId ? 'check' : 'plus'} size={18} color={COR.grafite} style={{ marginRight: 6 }} />
                        <Text style={styles.btnPrimarioTexto}>{editandoId ? 'Salvar' : 'Adicionar'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {/* BUSCAR NA LISTA */}
                {buscaAberta && totalItens > 0 && (
                  <View style={styles.cardBusca}>
                    <CampoSuave rotulo="Buscar na lista (ex: arroz)" valor={busca} aoMudar={setBusca} aoEnviar={() => Keyboard.dismiss()} icone="search" autoFocus maxLength={60} />
                    {!!busca.trim() && (
                      <View style={styles.resultadoBusca}>
                        {itensVisiveis.length > 0 ? (
                          <>
                            <Feather name="check-circle" size={15} color={COR.verde} />
                            <Text style={[styles.resultadoTexto, { color: COR.verde }]}>
                              Está na lista • {itensVisiveis.length} {itensVisiveis.length === 1 ? 'resultado' : 'resultados'}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Feather name="x-circle" size={15} color={COR.vermelho} />
                            <Text style={[styles.resultadoTexto, { color: COR.vermelho }]}>Não está na lista</Text>
                            <TouchableOpacity
                              style={styles.btnAddDaBusca}
                              onPress={() => {
                                suavizarLayout();
                                setNomeItem(busca.trim());
                                setBuscaAberta(false);
                                setBusca('');
                                setAddAberto(true);
                              }}
                            >
                              <Feather name="plus" size={13} color={COR.grafite} />
                              <Text style={styles.btnAddDaBuscaTexto}>Adicionar</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {addVisivel && !!dicaPreco && (
                  <View style={styles.dicaPrecoBox}>
                    <Feather name="tag" size={12} color={COR.verde} />
                    <Text style={styles.dicaPrecoTexto} numberOfLines={1}>
                      Mais barato já pago: <Text style={{ fontWeight: '900' }}>{formatarMoeda(dicaPreco.menorPreco)}</Text> em {dicaPreco.mercado}
                    </Text>
                  </View>
                )}

                {/* FILTRO POR CATEGORIA */}
                {totalItens > 0 && !termoBusca && Object.keys(contagemCat).length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flexGrow: 0, marginTop: 4, marginBottom: 8 }}
                    contentContainerStyle={{ paddingRight: 6 }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => escolherFiltro('Todas')}
                      style={[styles.filtroChip, filtroAtivo === 'Todas' && { backgroundColor: COR.lima, borderColor: COR.lima }]}
                    >
                      <Text style={[styles.filtroTexto, filtroAtivo === 'Todas' && { color: COR.grafite }]}>Todas {totalItens}</Text>
                    </TouchableOpacity>
                    {CATEGORIAS_MERCADO.filter((c) => contagemCat[c.nome]).map((c) => {
                      const ativo = filtroAtivo === c.nome;
                      return (
                        <TouchableOpacity
                          key={c.nome}
                          activeOpacity={0.8}
                          onPress={() => escolherFiltro(c.nome)}
                          style={[styles.filtroChip, ativo && { backgroundColor: `${c.cor}25`, borderColor: c.cor }]}
                        >
                          <Text style={[styles.filtroTexto, ativo && { color: c.cor }]}>
                            {c.emoji} {c.nome} {contagemCat[c.nome]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                </Pressable>
                  </Animated.View>
                </View>
              </Aparecer>
            )}
          </Animated.View>

          {celebrando && <Celebracao total={totalItens} aoTerminar={() => setCelebrando(false)} />}
        </View>
      </AvoidTeclado>
      <DialogoNoModal />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COR.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    borderWidth: 1,
    borderColor: COR.borda,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  sheetCheia: {
    height: '100%',
    maxHeight: '100%',
    maxWidth: 900,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 0,
    paddingTop: (Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12),
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  titulo: { color: COR.texto, fontSize: 18, fontWeight: 'bold' },
  tituloLista: { color: COR.texto, fontSize: 18, fontWeight: 'bold', flexShrink: 1 },
  sub: { color: COR.lima, fontSize: 12, fontWeight: 'bold', marginTop: 3 },
  closeBtn: { backgroundColor: COR.grafite, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: COR.borda },

  renomearLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnEditarNome: { backgroundColor: COR.grafite, padding: 7, borderRadius: 10, borderWidth: 1, borderColor: COR.borda },
  btnConfirmarRenome: { backgroundColor: COR.lima, padding: 10, borderRadius: 12 },
  btnCancelarRenome: { backgroundColor: COR.grafite, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COR.borda },

  btnPrimario: { flexDirection: 'row', backgroundColor: COR.lima, paddingVertical: 15, paddingHorizontal: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  btnPrimarioTexto: { color: COR.grafite, fontSize: 15, fontWeight: 'bold' },
  dataLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  dataTexto: { color: COR.cinza, fontSize: 13, fontWeight: '600' },

  // campo suave
  campoBox: { position: 'relative' },
  campoBrilho: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 19, backgroundColor: COR.lima },
  campoCaixa: { height: 56, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' },
  campoRotulo: { position: 'absolute', fontWeight: '600' },
  campoInput: { height: 56, paddingTop: 22, paddingBottom: 6, color: COR.texto, fontSize: 15, fontWeight: '600' },
  campoLimpar: { position: 'absolute', right: 12, top: 18, width: 20, height: 20, borderRadius: 10, backgroundColor: COR.borda, justifyContent: 'center', alignItems: 'center' },

  vazio: { alignItems: 'center', paddingVertical: 30 },
  vazioTexto: { color: COR.cinza, fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 20 },

  cardLista: { flexDirection: 'row', alignItems: 'center', backgroundColor: COR.borda, borderRadius: 16, padding: 14, marginBottom: 10, gap: 10 },
  cardListaNome: { color: COR.texto, fontSize: 14, fontWeight: 'bold' },
  cardListaInfo: { color: COR.cinza, fontSize: 11, marginTop: 3 },
  btnLixo: { padding: 6 },
  acoesItem: { alignItems: 'center', gap: 2 },
  editandoTopo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  editandoTexto: { flex: 1, color: COR.lima, fontSize: 12, fontWeight: 'bold' },
  editandoCancelar: { color: COR.cinza, fontSize: 12, fontWeight: 'bold' },
  miniTrilho: { height: 5, borderRadius: 3, backgroundColor: COR.card, overflow: 'hidden', marginTop: 8 },
  miniPreench: { height: '100%', borderRadius: 3 },

  // progresso com carrinho
  progressoBox: { backgroundColor: COR.grafite, borderRadius: 18, borderWidth: 1, borderColor: COR.borda, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, marginBottom: 10 },
  progressoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressoTexto: { color: COR.texto, fontSize: 13, fontWeight: 'bold' },
  progressoPct: { color: COR.lima, fontSize: 13, fontWeight: '900' },
  trilhoWrap: { height: 52, paddingHorizontal: 20, justifyContent: 'center' },
  trilho: { height: 12, borderRadius: 6, backgroundColor: COR.borda },
  trilhoFill: { height: 12, borderRadius: 6 },
  trilhoWrapMini: { height: 32, paddingHorizontal: 12, flex: 1 },
  trilhoMini: { height: 8, borderRadius: 4 },
  carrinhoMini: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, right: -13, top: -9 },
  progressoBoxMini: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 12 },
  progressoMiniTexto: { color: COR.texto, fontSize: 11, fontWeight: 'bold', minWidth: 34 },
  riscos: { position: 'absolute', right: 22, top: 0, bottom: 0, justifyContent: 'center', gap: 3 },
  risco: { height: 2.5, borderRadius: 2, backgroundColor: '#0B0B0F88' },
  carrinho: {
    position: 'absolute',
    right: -20,
    top: -14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COR.lavanda,
    borderWidth: 3,
    borderColor: COR.grafite,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // adicionar item
  cardAdicionar: { backgroundColor: COR.grafite, borderRadius: 20, borderWidth: 1, borderColor: COR.borda, padding: 14, marginBottom: 10 },
  abasTopo: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  aba: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  abaTexto: { fontSize: 13, fontWeight: 'bold' },
  cardBusca: { backgroundColor: COR.grafite, borderRadius: 20, borderWidth: 1, borderColor: COR.borda, padding: 14, marginBottom: 10 },
  resultadoBusca: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 2 },
  resultadoTexto: { flex: 1, fontSize: 12, fontWeight: 'bold' },
  btnAddDaBusca: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COR.lima, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  btnAddDaBuscaTexto: { color: COR.grafite, fontSize: 12, fontWeight: 'bold' },
  recolher: { alignSelf: 'center', marginTop: -6, marginBottom: 4 },
  catCabeca: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  rotuloPeq: { color: COR.cinza, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  dicaPeq: { color: COR.cinza, fontSize: 10 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: COR.card, borderWidth: 1, borderColor: COR.borda, marginRight: 8 },
  catChipTexto: { color: COR.cinza, fontSize: 11, fontWeight: 'bold' },
  linhaQtdAdd: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  btnAdicionar: { flex: 1, flexDirection: 'row', height: 46, borderRadius: 16, backgroundColor: COR.lima, justifyContent: 'center', alignItems: 'center' },
  btnAbrirAdd: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: `${COR.lima}66`, marginBottom: 10 },
  btnAbrirAddTexto: { color: COR.lima, fontSize: 13, fontWeight: 'bold' },

  seletorQtd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setaQtd: { width: 40, height: 46, borderRadius: 14, backgroundColor: COR.card, borderWidth: 1, borderColor: COR.borda, justifyContent: 'center', alignItems: 'center' },
  caixaQtd: { minWidth: 52, height: 46, borderRadius: 14, backgroundColor: COR.borda, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  numeroQtd: { color: COR.texto, fontSize: 22, fontWeight: '900' },

  dicaPrecoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00E67615', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  dicaPrecoTexto: { color: COR.cinza, fontSize: 11, flex: 1 },

  // filtro
  filtroChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: COR.grafite, borderWidth: 1, borderColor: COR.borda, marginRight: 8 },
  filtroTexto: { color: COR.cinza, fontSize: 11, fontWeight: 'bold' },

  // item
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COR.borda, borderRadius: 14, padding: 12, marginBottom: 8, gap: 12 },
  checkbox: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: COR.lima, justifyContent: 'center', alignItems: 'center' },
  checkAnel: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 9, borderWidth: 2, borderColor: COR.lima },
  checkFundo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 7, backgroundColor: COR.lima },
  itemNome: { fontSize: 14, fontWeight: 'bold', lineHeight: 20 },
  riscado: { position: 'absolute', left: 0, top: 10, height: 2, borderRadius: 1, backgroundColor: COR.cinza },
  itemQtd: { color: COR.cinza, fontSize: 11, marginTop: 2 },
  itemPreco: { color: COR.verde, fontSize: 11, marginTop: 2, fontWeight: 'bold' },

  // animação final
  celebFundo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,8,0.9)', justifyContent: 'center', alignItems: 'center' },
  celebCard: { width: '84%', maxWidth: 340, alignItems: 'center' },
  celebPalco: { width: '100%', height: 130, justifyContent: 'center', alignItems: 'center' },
  celebSelo: { width: 92, height: 92, borderRadius: 46, backgroundColor: COR.lima, justifyContent: 'center', alignItems: 'center' },
  celebOnda: { position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: COR.lima },
  confete: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  celebTitulo: { color: COR.texto, fontSize: 22, fontWeight: '900', marginTop: 10 },
  celebSub: { color: COR.cinza, fontSize: 13, marginTop: 6, textAlign: 'center' },
});
