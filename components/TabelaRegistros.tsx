// Tabela de produtos das compras de supermercado, com ZOOM (+ / −) e "ajustar à tela".
// Por padrão a tabela já nasce do tamanho da tela, então a coluna TOTAL sempre aparece.
// Se aumentar o zoom, dá para deslizar para o lado.
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { infoCategoria } from '../utils/categoriasMercado';
import { formatarMoeda } from '../utils/formatadores';

export type LinhaRegistro = {
  notaId: string;
  idx: string;
  nome: string;
  categoria: string;
  mercado: string;
  data: string;
  qtd: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
};

const BASE = { produto: 170, qtd: 62, unit: 85, categoria: 140, mercado: 130, data: 80, total: 105 };
const PASSO = 0.15;
const ZOOM_MIN = 0.45;
const ZOOM_MAX = 2;

type Props = {
  linhas: LinhaRegistro[];
  mostrarOrigem: boolean; // true = colunas Mercado e Data (visão de todas as notas)
  aoEditar: (r: any) => void;
  limite?: number;
};

export default function TabelaRegistros({ linhas, mostrarOrigem, aoEditar, limite = 300 }: Props) {
  const { width } = useWindowDimensions();
  const [zoomManual, setZoomManual] = useState<number | null>(null);

  const colunas = mostrarOrigem
    ? ['produto', 'qtd', 'unit', 'categoria', 'mercado', 'data', 'total']
    : ['produto', 'qtd', 'unit', 'categoria', 'total'];
  const larguraBase = colunas.reduce((acc: number, c: string) => acc + (BASE as any)[c], 0);
  const disponivel = Math.min(width, 700) - 40;
  const ajuste = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, disponivel / larguraBase));
  const z = zoomManual === null ? ajuste : zoomManual;
  const L = (c: string): number => Math.round((BASE as any)[c] * z);
  const fonte = Math.max(8, 12 * z);
  const fonteTh = Math.max(7, 10 * z);
  const pad = Math.max(6, 12 * z);

  const mais = () => setZoomManual(Math.min(ZOOM_MAX, Math.round((z + PASSO) * 100) / 100));
  const menos = () => setZoomManual(Math.max(ZOOM_MIN, Math.round((z - PASSO) * 100) / 100));

  const total: number = linhas.reduce((acc: number, r: LinhaRegistro) => acc + r.valorTotal, 0);
  const visiveis = linhas.slice(0, limite);

  return (
    <View>
      <View style={styles.zoomLinha}>
        <Text style={styles.zoomRotulo}>Zoom</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={menos} accessibilityLabel="Diminuir tabela">
          <Feather name="zoom-out" size={16} color="#D4FF3A" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomPct} onPress={() => setZoomManual(null)} accessibilityLabel="Ajustar à tela">
          <Text style={styles.zoomPctTexto}>{Math.round(z * 100)}%</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={mais} accessibilityLabel="Aumentar tabela">
          <Feather name="zoom-in" size={16} color="#D4FF3A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => setZoomManual(null)}>
          <Text style={styles.ajustar}>Ajustar à tela</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled">
        <View>
          <View style={[styles.header, { paddingVertical: pad, paddingHorizontal: 8 }]}>
            <Text style={[styles.th, { width: L('produto'), fontSize: fonteTh }]}>Produto</Text>
            <Text style={[styles.th, { width: L('qtd'), fontSize: fonteTh }]}>Qtd</Text>
            <Text style={[styles.th, { width: L('unit'), fontSize: fonteTh }]}>Unit.</Text>
            <Text style={[styles.th, { width: L('categoria'), fontSize: fonteTh }]}>Categoria</Text>
            {mostrarOrigem && <Text style={[styles.th, { width: L('mercado'), fontSize: fonteTh }]}>Mercado</Text>}
            {mostrarOrigem && <Text style={[styles.th, { width: L('data'), fontSize: fonteTh }]}>Data</Text>}
            <Text style={[styles.th, { width: L('total'), fontSize: fonteTh, textAlign: 'right' }]}>Total</Text>
          </View>

          {visiveis.map((r: LinhaRegistro, i: number) => {
            const cat = infoCategoria(r.categoria);
            return (
              <TouchableOpacity
                key={`${r.notaId}-${r.idx}`}
                activeOpacity={0.7}
                delayLongPress={350}
                onLongPress={() => aoEditar(r)}
                style={[styles.tr, { paddingVertical: pad, paddingHorizontal: 8 }, i % 2 === 0 && styles.zebra]}
              >
                <Text style={[styles.td, { width: L('produto'), fontSize: fonte, fontWeight: 'bold', color: '#F4F5F7' }]} numberOfLines={2}>{r.nome}</Text>
                <Text style={[styles.td, { width: L('qtd'), fontSize: fonte }]} numberOfLines={1}>{r.qtd} {r.unidade}</Text>
                <Text style={[styles.td, { width: L('unit'), fontSize: fonte }]} numberOfLines={1}>{formatarMoeda(r.valorUnitario)}</Text>
                <View style={{ width: L('categoria') }}>
                  <TouchableOpacity
                    onPress={() => aoEditar(r)}
                    style={[styles.tag, { borderColor: cat.cor, backgroundColor: `${cat.cor}20` }]}
                  >
                    <Text style={[styles.tagTexto, { color: cat.cor, fontSize: Math.max(7, 10 * z) }]} numberOfLines={1}>
                      {cat.emoji} {cat.nome}
                    </Text>
                  </TouchableOpacity>
                </View>
                {mostrarOrigem && <Text style={[styles.td, { width: L('mercado'), fontSize: fonte }]} numberOfLines={2}>{r.mercado}</Text>}
                {mostrarOrigem && <Text style={[styles.td, { width: L('data'), fontSize: fonte }]} numberOfLines={1}>{r.data}</Text>}
                <Text
                  style={[styles.td, { width: L('total'), fontSize: fonte, textAlign: 'right', color: '#00E676', fontWeight: 'bold' }]}
                  numberOfLines={1}
                >
                  {formatarMoeda(r.valorTotal)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {linhas.length > limite && (
        <Text style={styles.dica}>Mostrando os {limite} mais recentes. Use a busca para achar os outros.</Text>
      )}

      {/* TOTAL sempre visível, fora da rolagem lateral */}
      <View style={styles.totalBarra}>
        <Text style={styles.totalRotulo}>TOTAL • {linhas.length} {linhas.length === 1 ? 'item' : 'itens'}</Text>
        <Text style={styles.totalValor}>{formatarMoeda(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zoomLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  zoomRotulo: { color: '#8A8D98', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  zoomBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#1C1D25', borderWidth: 1, borderColor: '#2A2B34', justifyContent: 'center', alignItems: 'center' },
  zoomPct: { minWidth: 54, height: 36, borderRadius: 11, backgroundColor: '#0B0B0F', borderWidth: 1, borderColor: '#2A2B34', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  zoomPctTexto: { color: '#F4F5F7', fontSize: 12, fontWeight: 'bold' },
  ajustar: { color: '#D4FF3A', fontSize: 11, fontWeight: 'bold' },

  header: { flexDirection: 'row', backgroundColor: '#2A2B34', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  th: { color: '#D4FF3A', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2A2B34' },
  zebra: { backgroundColor: '#1C1D25' },
  td: { color: '#8A8D98', paddingRight: 6 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1, maxWidth: '96%' },
  tagTexto: { fontWeight: '900' },
  dica: { color: '#8A8D98', fontSize: 11, marginTop: 10, textAlign: 'center' },

  totalBarra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0B0B0F', borderWidth: 1, borderColor: '#00E67640', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 12 },
  totalRotulo: { color: '#8A8D98', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  totalValor: { color: '#00E676', fontSize: 20, fontWeight: '900' },
});
