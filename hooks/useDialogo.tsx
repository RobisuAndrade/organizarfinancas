import { Feather } from '@expo/vector-icons';
import { ComponentProps, createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme';

/**
 * Diálogos do app com a nossa cara — substituem Alert.alert e window.confirm,
 * para NUNCA aparecer janela padrão do celular ou do navegador.
 *
 * Uso:
 *   const { avisar, confirmar } = useDialogo();
 *   avisar('Erro', 'Não foi possível salvar.', 'erro');
 *   if (await confirmar({ titulo: 'Excluir', mensagem: '...', perigo: true })) { ... }
 */

type Tipo = 'sucesso' | 'erro' | 'aviso' | 'info';
type NomeIcone = ComponentProps<typeof Feather>['name'];

export interface OpcoesConfirmar {
  titulo: string;
  mensagem?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Deixa o botão de confirmar vermelho (exclusões, ações sem volta) */
  perigo?: boolean;
  icone?: NomeIcone;
}

interface ContextoDialogo {
  avisar: (titulo: string, mensagem?: string, tipo?: Tipo) => Promise<void>;
  confirmar: (opcoes: OpcoesConfirmar) => Promise<boolean>;
}

interface Item {
  id: number;
  modo: 'aviso' | 'confirmar';
  titulo: string;
  mensagem?: string;
  tipo: Tipo;
  icone: NomeIcone;
  cor: string;
  textoConfirmar: string;
  textoCancelar: string;
  perigo: boolean;
  resolver: (valor: boolean) => void;
}

const VISUAL_TIPO: Record<Tipo, { icone: NomeIcone; cor: string }> = {
  sucesso: { icone: 'check-circle', cor: Colors.success },
  erro: { icone: 'alert-circle', cor: Colors.danger },
  aviso: { icone: 'alert-triangle', cor: Colors.lime },
  info: { icone: 'info', cor: Colors.lavender },
};

const Ctx = createContext<ContextoDialogo>({
  avisar: async () => {},
  confirmar: async () => false,
});

export const useDialogo = () => useContext(Ctx);

export function DialogoProvider({ children }: { children: ReactNode }) {
  const fila = useRef<Item[]>([]);
  const ativoRef = useRef<Item | null>(null);
  const ultimoRef = useRef<Item | null>(null);
  const contador = useRef(0);
  const [ativo, setAtivo] = useState<Item | null>(null);

  const escala = useRef(new Animated.Value(0.9)).current;
  const opacidade = useRef(new Animated.Value(0)).current;

  const mostrarProximo = useCallback(() => {
    const prox = fila.current.shift() ?? null;
    ativoRef.current = prox;
    setAtivo(prox);
  }, []);

  const enfileirar = useCallback((item: Item) => {
    if (ativoRef.current) {
      fila.current.push(item);
    } else {
      ativoRef.current = item;
      setAtivo(item);
    }
  }, []);

  const encerrar = useCallback((resultado: boolean) => {
    const atual = ativoRef.current;
    if (!atual) return;
    atual.resolver(resultado);
    mostrarProximo();
  }, [mostrarProximo]);

  const avisar = useCallback((titulo: string, mensagem?: string, tipo: Tipo = 'info') => {
    return new Promise<void>((resolve) => {
      const v = VISUAL_TIPO[tipo];
      enfileirar({
        id: ++contador.current,
        modo: 'aviso',
        titulo,
        mensagem,
        tipo,
        icone: v.icone,
        cor: v.cor,
        textoConfirmar: 'OK',
        textoCancelar: '',
        perigo: false,
        resolver: () => resolve(),
      });
    });
  }, [enfileirar]);

  const confirmar = useCallback((o: OpcoesConfirmar) => {
    return new Promise<boolean>((resolve) => {
      const perigo = !!o.perigo;
      enfileirar({
        id: ++contador.current,
        modo: 'confirmar',
        titulo: o.titulo,
        mensagem: o.mensagem,
        tipo: perigo ? 'erro' : 'aviso',
        icone: o.icone ?? (perigo ? 'trash-2' : 'help-circle'),
        cor: perigo ? Colors.danger : Colors.lime,
        textoConfirmar: o.textoConfirmar ?? (perigo ? 'Excluir' : 'Confirmar'),
        textoCancelar: o.textoCancelar ?? 'Cancelar',
        perigo,
        resolver: resolve,
      });
    });
  }, [enfileirar]);

  // Animação de entrada toda vez que um diálogo novo aparece
  useEffect(() => {
    if (!ativo) return;
    ultimoRef.current = ativo;
    escala.setValue(0.9);
    opacidade.setValue(0);
    Animated.parallel([
      Animated.spring(escala, { toValue: 1, useNativeDriver: true, friction: 8, tension: 90 }),
      Animated.timing(opacidade, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [ativo?.id]);

  const valor = useMemo(() => ({ avisar, confirmar }), [avisar, confirmar]);

  // Mantém o conteúdo na tela durante o fade-out do Modal
  const item = ativo ?? ultimoRef.current;

  return (
    <Ctx.Provider value={valor}>
      {children}
      <Modal
        visible={!!ativo}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => encerrar(false)}
      >
        <View style={styles.fundo}>
          {item && (
            <Animated.View style={[styles.caixa, { opacity: opacidade, transform: [{ scale: escala }] }]}>
              <View style={[styles.circuloIcone, { backgroundColor: `${item.cor}22`, borderColor: `${item.cor}55` }]}>
                <Feather name={item.icone} size={26} color={item.cor} />
              </View>

              <Text style={styles.titulo}>{item.titulo}</Text>
              {!!item.mensagem && <Text style={styles.mensagem}>{item.mensagem}</Text>}

              <View style={styles.linhaBotoes}>
                {item.modo === 'confirmar' && (
                  <TouchableOpacity style={[styles.botao, styles.botaoCancelar]} onPress={() => encerrar(false)} activeOpacity={0.8}>
                    <Text style={styles.textoCancelar}>{item.textoCancelar}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.botao, { backgroundColor: item.perigo ? Colors.danger : Colors.lime }]}
                  onPress={() => encerrar(true)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.textoConfirmar, { color: item.perigo ? '#FFFFFF' : Colors.background }]}>
                    {item.textoConfirmar}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  caixa: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
  },
  circuloIcone: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  titulo: { color: Colors.text, fontSize: 17, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  mensagem: { color: Colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  linhaBotoes: { flexDirection: 'row', gap: 10, marginTop: 24, width: '100%' },
  botao: { flex: 1, paddingVertical: 15, paddingHorizontal: 10, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  botaoCancelar: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  textoCancelar: { color: Colors.text, fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  textoConfirmar: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
});
