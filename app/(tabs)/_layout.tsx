import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModalListaCompras from '../../components/ModalListaCompras';
import ModalNotaFiscal from '../../components/ModalNotaFiscal';
import { IconeAjustes, IconeCalculadora } from '../../components/IconesCustom';
import { Colors } from '../../constants/theme';
import { EscolhaRapidaContext, ESCOLHAS, TipoEscolhaRapida } from '../../hooks/useEscolhaRapida';
import Calculadora from './calculadora';

// Define, num lugar só, quais abas aparecem na barra debaixo.
// "direto" navega direto pra rota. "grupo" abre a pílula de escolha entre
// as telas daquele grupo (ESCOLHAS, em hooks/useEscolhaRapida.tsx) e fica
// "ativa" quando a tela atual é qualquer uma das rotas daquele grupo.
const ABAS = [
  { tipo: 'direto', nome: 'index', titulo: 'Início', icone: 'home' },
  { tipo: 'direto', nome: 'resumo', titulo: 'Visão Geral', icone: 'activity' },
  { tipo: 'direto', nome: 'gastos', titulo: 'Gestão de Gastos', icone: 'file-text' },
  { tipo: 'grupo', chave: 'comprasMercado' as TipoEscolhaRapida, titulo: 'Compras e Mercado', icone: 'shopping-bag' },
  { tipo: 'grupo', chave: 'salariosMetas' as TipoEscolhaRapida, titulo: 'Salários e Metas', icone: 'dollar-sign' },
] as const;

// Barra de navegação flutuante e customizada.
// Regra pedida: na tela inicial ("index") ela some por completo；
// em qualquer outra tela do app, ela aparece com as opções acima.
function BarraInferior({ state, navigation, abrirEscolha }: any) {
  const insets = useSafeAreaInsets();
  const rotaAtual = state.routes[state.index].name;

  if (rotaAtual === 'index') return null;

  return (
    <View style={[styles.barraWrapper, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
      <View style={styles.barra}>
        {ABAS.map((aba) => {
          const ativa = aba.tipo === 'direto'
            ? rotaAtual === aba.nome
            : ESCOLHAS[aba.chave].rotas.includes(rotaAtual);

          return (
            <TouchableOpacity
              key={aba.tipo === 'direto' ? aba.nome : aba.chave}
              onPress={() => (aba.tipo === 'direto' ? navigation.navigate(aba.nome) : abrirEscolha(aba.chave))}
              activeOpacity={0.85}
              style={[styles.item, ativa && styles.itemAtivo]}
            >
              <Feather
                name={aba.icone as any}
                size={18}
                color={ativa ? Colors.background : Colors.muted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Botão flutuante único (speed-dial): toca pra abrir e revela as duas
// opções (calculadora e registrar nota). Toca de novo, ou fora dele, pra
// fechar. Facilita acrescentar uma 3ª opção no futuro: é só adicionar um
// item no array SUBACOES.
function BotaoFlutuante({
  onAbrirCalculadora,
  onAbrirNota,
  onAbrirLista,
}: {
  onAbrirCalculadora: () => void;
  onAbrirNota: () => void;
  onAbrirLista: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [aberto, setAberto] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const alternar = () => {
    Animated.spring(anim, {
      toValue: aberto ? 0 : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 60,
    }).start();
    setAberto(!aberto);
  };

  const fechar = () => {
    if (!aberto) return;
    Animated.spring(anim, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }).start();
    setAberto(false);
  };

  const SUBACOES = [
    { chave: 'calculadora', Icone: IconeCalculadora, cor: Colors.lavender, onPress: () => { fechar(); onAbrirCalculadora(); } },
    { chave: 'nota', icone: 'shopping-cart' as const, cor: Colors.lime, onPress: () => { fechar(); onAbrirNota(); } },
    { chave: 'lista', icone: 'clipboard' as const, cor: Colors.surface3, onPress: () => { fechar(); onAbrirLista(); } },
  ];

  return (
    <>
      {/* Fundo transparente: toca fora pra fechar */}
      {aberto && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={fechar} />
      )}

      <View style={[styles.fabWrapper, { top: insets.top + 10 }]} pointerEvents="box-none">
        {SUBACOES.map((acao, i) => {
          const offset = (i + 1) * 58;
          const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, offset] });
          const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
          return (
            <Animated.View
              key={acao.chave}
              pointerEvents={aberto ? 'auto' : 'none'}
              style={[
                styles.subBotao,
                { backgroundColor: acao.cor, opacity: anim, transform: [{ translateY }, { scale }] },
              ]}
            >
              <TouchableOpacity style={styles.subBotaoToque} activeOpacity={0.8} onPress={acao.onPress}>
                {acao.chave === 'calculadora' ? (
                  <IconeCalculadora size={20} color={Colors.background} />
                ) : (
                  <Feather
                    name={acao.icone}
                    size={19}
                    color={acao.chave === 'lista' ? Colors.lime : Colors.background}
                  />
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <TouchableOpacity style={styles.fabPrincipal} activeOpacity={0.85} onPress={alternar}>
          {aberto ? (
            <Feather name="x" size={22} color={Colors.background} />
          ) : (
            <IconeAjustes size={22} color={Colors.background} />
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const [calcVisivel, setCalcVisivel] = useState(false);
  const [notaVisivel, setNotaVisivel] = useState(false);
  const [listaVisivel, setListaVisivel] = useState(false);
  const [escolhaAberta, setEscolhaAberta] = useState<TipoEscolhaRapida | null>(null);

  const navegarPara = (caminho: string) => {
    setEscolhaAberta(null);
    router.push(caminho as any);
  };

  const escolha = escolhaAberta ? ESCOLHAS[escolhaAberta] : null;

  return (
    <EscolhaRapidaContext.Provider value={{ abrir: setEscolhaAberta, abrirLista: () => setListaVisivel(true) }}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <Tabs
          tabBar={(props) => <BarraInferior {...props} abrirEscolha={setEscolhaAberta} />}
          screenOptions={{ headerShown: false }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="resumo" />
          <Tabs.Screen name="gastos" />
          <Tabs.Screen name="compras" />
          <Tabs.Screen name="mercado" />
          <Tabs.Screen name="metas" />
          <Tabs.Screen name="renda" />
          {/* Arquivo existe para a Calculadora funcionar como componente, mas não é uma tela navegável */}
          <Tabs.Screen name="calculadora" options={{ href: null }} />
        </Tabs>

        <BotaoFlutuante
          onAbrirCalculadora={() => setCalcVisivel(true)}
          onAbrirNota={() => setNotaVisivel(true)}
          onAbrirLista={() => setListaVisivel(true)}
        />

        {/* MODAIS */}
        <Calculadora visivel={calcVisivel} fechar={() => setCalcVisivel(false)} />
        <ModalNotaFiscal visivel={notaVisivel} fechar={() => setNotaVisivel(false)} />
        <ModalListaCompras visivel={listaVisivel} fechar={() => setListaVisivel(false)} />

        {/* PÍLULA DE ESCOLHA RÁPIDA (compartilhada entre a Home e a barra debaixo) */}
        <Modal visible={!!escolha} transparent animationType="fade" onRequestClose={() => setEscolhaAberta(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setEscolhaAberta(null)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitulo}>{escolha?.titulo}</Text>
              <Text style={styles.modalSubtitulo}>Qual você quer abrir?</Text>

              {escolha?.opcoes.map((op) => (
                <TouchableOpacity key={op.rota} style={styles.modalOpcao} activeOpacity={0.8} onPress={() => navegarPara(op.rota)}>
                  <View style={[styles.modalOpcaoIcon, { backgroundColor: op.cor + '22' }]}>
                    <Feather name={op.icone as any} size={20} color={op.cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalOpcaoTitulo}>{op.titulo}</Text>
                    <Text style={styles.modalOpcaoSubtitulo}>{op.subtitulo}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.muted} />
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.modalCancelar} onPress={() => setEscolhaAberta(null)}>
                <Text style={styles.modalCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </EscolhaRapidaContext.Provider>
  );
}

const styles = StyleSheet.create({
  // Botão flutuante único (speed-dial)
  fabWrapper: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  fabPrincipal: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.lime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  subBotao: {
    position: 'absolute',
    top: 0,
    width: 44,
    height: 44,
    borderRadius: 14,
    elevation: 6,
  },
  subBotaoToque: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Barra inferior flutuante
  barraWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface2,
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.surface3,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  item: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemAtivo: {
    backgroundColor: Colors.lime,
  },

  // Pílula de escolha rápida
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.surface3,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  modalSubtitulo: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 4,
    marginBottom: 20,
  },
  modalOpcao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.surface3,
    gap: 14,
  },
  modalOpcaoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOpcaoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  modalOpcaoSubtitulo: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  modalCancelar: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalCancelarTexto: {
    color: Colors.muted,
    fontWeight: '700',
  },
});
