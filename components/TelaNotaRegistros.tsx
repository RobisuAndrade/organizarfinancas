// Tela só com os produtos de UMA nota (aberta por "Ver Registros" no detalhe da nota).
// Tem busca e filtro de categorias só dentro da nota, destaques comparando com as outras notas
// (rodando no cabeçalho) e zoom na tabela. O cabeçalho some ao rolar e volta ao rolar um pouco para cima.
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { CATEGORIAS_MERCADO, chaveProduto } from '../utils/categoriasMercado';
import { formatarMoeda } from '../utils/formatadores';
import { eventoRolagem } from './BarraScroll';
import TabelaRegistros, { LinhaRegistro } from './TabelaRegistros';

type Destaque = { texto: string; cor: string; icone: string };

type Props = {
  mercado: string;
  data: string;
  linhas: LinhaRegistro[]; // produtos desta nota (ao vivo)
  outras: LinhaRegistro[]; // produtos das OUTRAS notas
  aoFechar: () => void;
  aoEditar: (r: any) => void;
};

export default function TelaNotaRegistros({ mercado, data, linhas, outras, aoFechar, aoEditar }: Props) {
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [alturaTopo, setAlturaTopo] = useState(300);
  const [indice, setIndice] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  // botão voltar do celular fecha esta tela primeiro
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      aoFechar();
      return true;
    });
    return () => sub.remove();
  }, [aoFechar]);

  const categorias = useMemo(
    () => CATEGORIAS_MERCADO.filter((c: any) => linhas.some((l: LinhaRegistro) => l.categoria === c.nome)),
    [linhas]
  );

  const filtradas: LinhaRegistro[] = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l: LinhaRegistro) => {
      if (cat && l.categoria !== cat) return false;
      if (termo && !l.nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [linhas, busca, cat]);

  // Destaques: compara cada produto desta nota com as MESMAS mercadorias das outras notas
  const destaques: Destaque[] = useMemo(() => {
    const porChave: { [k: string]: LinhaRegistro[] } = {};
    outras.forEach((o: LinhaRegistro) => {
      if (0 >= o.valorUnitario) return;
      const k = chaveProduto(o.nome);
      if (!porChave[k]) porChave[k] = [];
      porChave[k].push(o);
    });
    const baratos: { d: Destaque; pct: number }[] = [];
    const caros: { d: Destaque; pct: number }[] = [];
    linhas.forEach((l: LinhaRegistro) => {
      if (0 >= l.valorUnitario) return;
      const lista = porChave[chaveProduto(l.nome)];
      if (!lista || lista.length === 0) return;
      const menor = lista.reduce((a: LinhaRegistro, b: LinhaRegistro) => (a.valorUnitario > b.valorUnitario ? b : a));
      const maior = lista.reduce((a: LinhaRegistro, b: LinhaRegistro) => (b.valorUnitario > a.valorUnitario ? b : a));
      if (menor.valorUnitario > l.valorUnitario) {
        const pct = Math.round(((menor.valorUnitario - l.valorUnitario) / menor.valorUnitario) * 100);
        baratos.push({
          pct,
          d: {
            texto: `${l.nome} está ${pct}% mais barato aqui: ${formatarMoeda(l.valorUnitario)} (o menor nas outras notas foi ${formatarMoeda(menor.valorUnitario)} em ${menor.mercado})`,
            cor: '#00E676',
            icone: 'trending-down',
          },
        });
      } else if (l.valorUnitario > maior.valorUnitario) {
        const pct = Math.round(((l.valorUnitario - maior.valorUnitario) / maior.valorUnitario) * 100);
        caros.push({
          pct,
          d: {
            texto: `${l.nome} está ${pct}% mais caro aqui: ${formatarMoeda(l.valorUnitario)} (o maior nas outras notas foi ${formatarMoeda(maior.valorUnitario)} em ${maior.mercado})`,
            cor: '#FF3B5C',
            icone: 'trending-up',
          },
        });
      }
    });
    baratos.sort((a, b) => b.pct - a.pct);
    caros.sort((a, b) => b.pct - a.pct);
    const lista: Destaque[] = [];
    if (baratos.length > 0 || caros.length > 0) {
      lista.push({
        texto: `${baratos.length} produto(s) mais barato(s) e ${caros.length} mais caro(s) do que em todas as outras notas`,
        cor: '#D4FF3A',
        icone: 'bar-chart-2',
      });
    }
    baratos.slice(0, 6).forEach((x) => lista.push(x.d));
    caros.slice(0, 4).forEach((x) => lista.push(x.d));
    if (lista.length === 0) {
      lista.push({ texto: 'Ainda não há produtos repetidos em outras notas para comparar.', cor: '#8A8D98', icone: 'info' });
    }
    return lista;
  }, [linhas, outras]);

  // Troca o destaque a cada poucos segundos, com um fade simples
  useEffect(() => {
    if (destaques.length <= 1) return;
    const t = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setIndice((i: number) => (i + 1) % destaques.length);
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(t);
  }, [destaques.length]);

  const atual: Destaque = destaques[indice % destaques.length];
  const total: number = linhas.reduce((acc: number, l: LinhaRegistro) => acc + l.valorTotal, 0);

  const topoY = useMemo(
    () => Animated.multiply(Animated.diffClamp(scrollY, 0, Math.max(alturaTopo, 1)), -1),
    [scrollY, alturaTopo]
  );

  return (
    <SafeAreaView style={styles.tela}>
      <Animated.ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: alturaTopo + 6, paddingBottom: 170, paddingHorizontal: 20 }}
        onScroll={eventoRolagem(scrollY)}
        scrollEventThrottle={16}
      >
        <View style={styles.miolo}>
          {filtradas.length === 0 ? (
            <Text style={styles.vazio}>Nenhum produto com esses filtros.</Text>
          ) : (
            <TabelaRegistros linhas={filtradas} mostrarOrigem={false} aoEditar={aoEditar} limite={500} />
          )}
        </View>
      </Animated.ScrollView>

      <Animated.View
        style={[styles.topo, { transform: [{ translateY: topoY }] }]}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (Math.abs(h - alturaTopo) > 1) setAlturaTopo(h);
        }}
      >
        <View style={styles.linhaTitulo}>
          <TouchableOpacity onPress={aoFechar} style={styles.voltar}>
            <Feather name="arrow-left" size={24} color="#D4FF3A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo} numberOfLines={1}>{mercado}</Text>
            <Text style={styles.sub}>{data} • {linhas.length} {linhas.length === 1 ? 'produto' : 'produtos'} • {formatarMoeda(total)}</Text>
          </View>
        </View>

        <Animated.View style={[styles.destaque, { borderColor: atual.cor + '66', backgroundColor: atual.cor + '14', opacity: fade }]}>
          <Feather name={atual.icone as any} size={16} color={atual.cor} style={{ marginTop: 1 }} />
          <Text style={[styles.destaqueTexto, { color: atual.cor === '#8A8D98' ? '#8A8D98' : '#F4F5F7' }]} numberOfLines={3}>
            {atual.texto}
          </Text>
        </Animated.View>

        <View style={styles.busca}>
          <Feather name="search" size={16} color="#B8A6FF" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.buscaInput}
            placeholder="Buscar produto nesta nota..."
            placeholderTextColor="#8A8D98"
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')}>
              <Feather name="x" size={16} color="#8A8D98" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 8 }}>
          <TouchableOpacity style={[styles.chip, !cat && styles.chipAtivo]} onPress={() => setCat(null)}>
            <Text style={[styles.chipTexto, !cat && { color: '#0B0B0F' }]}>Todas</Text>
          </TouchableOpacity>
          {categorias.map((c: any) => {
            const ativo = cat === c.nome;
            return (
              <TouchableOpacity
                key={c.nome}
                style={[styles.chip, ativo && { backgroundColor: `${c.cor}25`, borderColor: c.cor }]}
                onPress={() => setCat(ativo ? null : c.nome)}
              >
                <Text style={[styles.chipTexto, ativo && { color: c.cor }]}>{c.emoji} {c.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B0B0F', zIndex: 20 },
  miolo: { width: '100%', maxWidth: 700, alignSelf: 'center' },
  topo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#0B0B0F',
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  voltar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1C1D25', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2A2B34' },
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#F4F5F7' },
  sub: { fontSize: 12, color: '#D4FF3A', fontWeight: 'bold', marginTop: 2 },
  destaque: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10, minHeight: 62 },
  destaqueTexto: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  busca: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1D25', borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: '#2A2B34', marginBottom: 10 },
  buscaInput: { flex: 1, color: '#F4F5F7', fontSize: 15 },
  chip: { backgroundColor: '#1C1D25', paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#2A2B34', marginRight: 8, justifyContent: 'center' },
  chipAtivo: { backgroundColor: '#D4FF3A', borderColor: '#D4FF3A' },
  chipTexto: { color: '#8A8D98', fontWeight: 'bold', fontSize: 12 },
  vazio: { color: '#8A8D98', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
