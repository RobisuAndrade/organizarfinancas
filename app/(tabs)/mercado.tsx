import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onValue, ref, remove, update } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LeitorCodigoBarras from '../../components/LeitorCodigoBarras';
import { db } from '../../firebaseConfig';
import { DialogoNoModal, useDialogo } from '../../hooks/useDialogo';
import { CATEGORIAS_MERCADO, chaveProduto, infoCategoria } from '../../utils/categoriasMercado';
import { formatarMoeda } from '../../utils/formatadores';

type Categoria = {
  nome: string;
  emoji: string;
  cor: string;
};

type Registro = {
  notaId: string;
  idx: string;
  nome: string;
  categoria: string;
  mercado: string;
  mercadoOriginal: string;
  data: string;
  criadoEm: string;
  qtd: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
};

type GrupoPreco = {
  chave: string;
  ultimo: Registro;
  menor: Registro;
  vezes: number;
};

type Nota = {
  notaId: string;
  mercado: string;
  mercadoOriginal: string;
  cnpj: string;
  data: string;
  criadoEm: string;
  total: number;
  itens: Registro[];
};

// Lista com tipo explícito (evita o erro de "any" implícito)
const LISTA_CATEGORIAS: Categoria[] = CATEGORIAS_MERCADO as Categoria[];

// Ordem pedida: PRODUTO, QTD, UNIT, CATEGORIA, MERCADO, DATA, TOTAL
const LARGURAS = { produto: 170, qtd: 55, unit: 85, categoria: 140, mercado: 130, data: 80, total: 105 };
const LARGURA_TABELA = LARGURAS.produto + LARGURAS.qtd + LARGURAS.unit + LARGURAS.categoria + LARGURAS.mercado + LARGURAS.data + LARGURAS.total;

export default function Mercado() {
  const router = useRouter();
  const { avisar, confirmar } = useDialogo();

  const [notas, setNotas] = useState<any>({});
  const [busca, setBusca] = useState<string>('');
  const [catFiltro, setCatFiltro] = useState<string | null>(null);
  const [modo, setModo] = useState<'notas' | 'registros' | 'precos'>('notas');
  const [editando, setEditando] = useState<Registro | null>(null);
  const [notaDetalhe, setNotaDetalhe] = useState<Nota | null>(null);
  const [renomeando, setRenomeando] = useState(false);
  const [nomeEditado, setNomeEditado] = useState('');
  const [scannerAberto, setScannerAberto] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, 'mercado/notas'), (snap) => setNotas(snap.val() || {}));
    return () => unsub();
  }, []);

  // Transforma as notas em uma lista única de produtos (uma linha por item)
  const registros: Registro[] = useMemo(() => {
    const lista: Registro[] = [];
    Object.keys(notas).forEach((notaId: string) => {
      const nota = notas[notaId];
      const itens = nota?.itens || {};
      Object.keys(itens).forEach((idx: string) => {
        const it = itens[idx];
        if (!it) return;
        lista.push({
          notaId,
          idx,
          nome: it.nome || 'Produto',
          categoria: it.categoria || 'Outros',
          mercado: nota.mercado || 'Mercado',
          mercadoOriginal: nota.mercadoOriginal || nota.mercado || 'Mercado',
          data: nota.data || '',
          criadoEm: nota.criadoEm || '',
          qtd: Number(it.qtd) || 0,
          unidade: it.unidade || 'UN',
          valorUnitario: Number(it.valorUnitario) || 0,
          valorTotal: Number(it.valorTotal) || 0,
        });
      });
    });
    return lista.sort((a: Registro, b: Registro) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  }, [notas]);

  const categoriasPresentes: Categoria[] = useMemo(
    () => LISTA_CATEGORIAS.filter((c: Categoria) => registros.some((r: Registro) => r.categoria === c.nome)),
    [registros]
  );

  const filtrados: Registro[] = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return registros.filter((r: Registro) => {
      if (catFiltro && r.categoria !== catFiltro) return false;
      if (termo && !r.nome.toLowerCase().includes(termo) && !r.mercado.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [registros, busca, catFiltro]);

  const totalFiltrado: number = filtrados.reduce((acc: number, r: Registro) => acc + r.valorTotal, 0);
  const qtdNotas: number = new Set(filtrados.map((r: Registro) => r.notaId)).size;

  // Agrupa os itens filtrados de volta em "cards" de nota (um quadradinho por compra)
  const notasAgrupadas: Nota[] = useMemo(() => {
    const grupos: { [notaId: string]: Registro[] } = {};
    filtrados.forEach((r: Registro) => {
      if (!grupos[r.notaId]) grupos[r.notaId] = [];
      grupos[r.notaId].push(r);
    });
    return Object.keys(grupos)
      .map((notaId: string): Nota => {
        const itens = grupos[notaId];
        return {
          notaId,
          mercado: itens[0].mercado,
          mercadoOriginal: itens[0].mercadoOriginal,
          cnpj: notas[notaId]?.cnpj || '',
          data: itens[0].data,
          criadoEm: itens[0].criadoEm,
          total: itens.reduce((acc, it) => acc + it.valorTotal, 0),
          itens,
        };
      })
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  }, [filtrados, notas]);

  // Comparação de preços: agrupa pelo mesmo produto e acha o mais barato
  const precos: GrupoPreco[] = useMemo(() => {
    const grupos: { [chave: string]: Registro[] } = {};
    filtrados.forEach((r: Registro) => {
      const k = chaveProduto(r.nome);
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(r);
    });
    return Object.keys(grupos)
      .map((k: string): GrupoPreco => {
        const lista = grupos[k];
        const comPreco = lista.filter((r: Registro) => r.valorUnitario > 0);
        const menor = comPreco.length
          ? comPreco.reduce((a: Registro, b: Registro) => (b.valorUnitario < a.valorUnitario ? b : a))
          : lista[0];
        return { chave: k, ultimo: lista[0], menor, vezes: lista.length };
      })
      .sort((a: GrupoPreco, b: GrupoPreco) => a.ultimo.nome.localeCompare(b.ultimo.nome));
  }, [filtrados]);

  // Muda a categoria de TODOS os registros com o mesmo nome e ensina o app
  const aplicarCategoria = async (r: Registro, novaCategoria: string) => {
    const chave = chaveProduto(r.nome);
    const updates: { [caminho: string]: string } = {};
    registros.forEach((x: Registro) => {
      if (chaveProduto(x.nome) === chave) {
        updates[`mercado/notas/${x.notaId}/itens/${x.idx}/categoria`] = novaCategoria;
      }
    });
    updates[`mercado/categoriasAprendidas/${chave}`] = novaCategoria;

    try {
      await update(ref(db), updates);
      setEditando(null);
    } catch (e) {
      avisar('Erro', 'Não foi possível mudar a categoria.', 'erro');
    }
  };

  // Exclui a nota (com confirmação no estilo do app)
  const excluirNota = async (notaId: string, mercado: string, data: string) => {
    const ok = await confirmar({
      titulo: 'Excluir nota',
      mensagem: `Apagar a compra de "${mercado}" (${data}) com todos os itens?`,
      perigo: true,
    });
    if (!ok) return;
    await remove(ref(db, `mercado/notas/${notaId}`));
    setEditando(null);
    setNotaDetalhe(null);
  };

  // Troca o nome do mercado dessa nota e, se tiver CNPJ, atualiza o apelido pra sempre
  const salvarRenomeacao = async () => {
    if (!notaDetalhe) return;
    const novoNome = nomeEditado.trim();
    if (!novoNome) return;

    const updates: { [caminho: string]: string } = {
      [`mercado/notas/${notaDetalhe.notaId}/mercado`]: novoNome,
    };
    if (notaDetalhe.cnpj) {
      updates[`mercado/apelidosCnpj/${notaDetalhe.cnpj}/nome`] = novoNome;
    }

    try {
      await update(ref(db), updates);
      setNotaDetalhe({ ...notaDetalhe, mercado: novoNome });
      setRenomeando(false);
    } catch (e) {
      avisar('Erro', 'Não foi possível renomear o mercado.', 'erro');
    }
  };

  // Vai pra visão de Registros já filtrada só pro mercado dessa nota
  const verRegistrosDoMercado = () => {
    if (!notaDetalhe) return;
    setBusca(notaDetalhe.mercado);
    setNotaDetalhe(null);
    setModo('registros');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#D4FF3A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.titulo}>Compras de Mercado</Text>
            <Text style={styles.subtitulo}>Tudo que lemos das notas fiscais</Text>
          </View>
        </View>

        {/* RESUMO */}
        <View style={styles.resumoRow}>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoLabel}>Total</Text>
            <Text
              style={[styles.resumoValor, { color: '#00E676' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatarMoeda(totalFiltrado)}
            </Text>
          </View>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoLabel}>Notas</Text>
            <Text style={styles.resumoValor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{qtdNotas}</Text>
          </View>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoLabel}>Itens</Text>
            <Text style={styles.resumoValor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{filtrados.length}</Text>
          </View>
        </View>

        {/* BUSCA */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color="#B8A6FF" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produto ou mercado..."
            placeholderTextColor="#8A8D98"
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} style={{ marginRight: 10 }}>
              <Feather name="x" size={16} color="#8A8D98" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setScannerAberto(true)} style={styles.btnScanner}>
            <Feather name="camera" size={16} color="#D4FF3A" />
          </TouchableOpacity>
        </View>

        {/* ALTERNAR VISÃO (sai de cena quando está em "Registros Totais") */}
        {modo === 'registros' ? (
          <TouchableOpacity style={styles.voltarRegistrosBtn} onPress={() => setModo('notas')}>
            <Feather name="arrow-left" size={16} color="#D4FF3A" />
            <Text style={styles.voltarRegistrosTexto}>Voltar pras Notas</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.voltarRegistrosContagem}>{filtrados.length} itens</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.modoContainer}>
            <TouchableOpacity
              style={[styles.modoBtn, modo === 'notas' && styles.modoBtnAtivo]}
              onPress={() => setModo('notas')}
            >
              <Feather name="file-text" size={13} color={modo === 'notas' ? '#0B0B0F' : '#8A8D98'} style={{ marginRight: 5 }} />
              <Text style={[styles.modoTexto, modo === 'notas' && styles.modoTextoAtivo]} numberOfLines={1}>Notas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modoBtn, modo === 'precos' && styles.modoBtnAtivo]}
              onPress={() => setModo('precos')}
            >
              <Feather name="trending-down" size={13} color={modo === 'precos' ? '#0B0B0F' : '#8A8D98'} style={{ marginRight: 5 }} />
              <Text style={[styles.modoTexto, modo === 'precos' && styles.modoTextoAtivo]} numberOfLines={1}>Menor preço</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FILTRO POR CATEGORIA */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
          <TouchableOpacity
            style={[styles.chip, !catFiltro && styles.chipAtivo]}
            onPress={() => setCatFiltro(null)}
          >
            <Text style={[styles.chipTexto, !catFiltro && { color: '#0B0B0F' }]}>Todas</Text>
          </TouchableOpacity>
          {categoriasPresentes.map((c: Categoria) => {
            const ativo = catFiltro === c.nome;
            return (
              <TouchableOpacity
                key={c.nome}
                style={[styles.chip, ativo && { backgroundColor: `${c.cor}25`, borderColor: c.cor }]}
                onPress={() => setCatFiltro(ativo ? null : c.nome)}
              >
                <Text style={[styles.chipTexto, ativo && { color: c.cor }]}>{c.emoji} {c.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* CONTEÚDO */}
        {filtrados.length === 0 ? (
          <View style={styles.vazio}>
            <Feather name="shopping-cart" size={50} color="#2A2B34" />
            <Text style={styles.vazioTexto}>
              {registros.length === 0
                ? 'Nenhuma compra registrada ainda.\nToque no carrinho no topo e leia uma nota fiscal.'
                : 'Nada encontrado com esses filtros.'}
            </Text>
          </View>
        ) : modo === 'notas' ? (
          <>
            <Text style={styles.dica}>Toque num cartão pra ver os produtos daquela compra</Text>
            <View style={styles.gradeNotas}>
              {notasAgrupadas.map((n: Nota) => (
                <TouchableOpacity
                  key={n.notaId}
                  style={styles.cardNota}
                  activeOpacity={0.8}
                  onPress={() => setNotaDetalhe(n)}
                >
                  <View style={styles.cardNotaTopo}>
                    <Feather name="shopping-bag" size={16} color="#D4FF3A" />
                    <Text style={styles.cardNotaData}>{n.data}</Text>
                  </View>
                  <Text style={styles.cardNotaMercado} numberOfLines={2}>{n.mercado}</Text>
                  <Text style={styles.cardNotaItens}>{n.itens.length} {n.itens.length === 1 ? 'produto' : 'produtos'}</Text>
                  <Text
                    style={styles.cardNotaTotal}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatarMoeda(n.total)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.btnRegistrosTotais} onPress={() => setModo('registros')}>
              <Feather name="list" size={16} color="#0B0B0F" style={{ marginRight: 8 }} />
              <Text style={styles.btnRegistrosTotaisTexto}>Ver Registros Totais</Text>
            </TouchableOpacity>
          </>
        ) : modo === 'registros' ? (
          <>
            <Text style={styles.dica}>
              Segure uma linha (ou toque na categoria) para mudar a categoria • Deslize para o lado para ver tudo
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ width: LARGURA_TABELA }}>
                {/* Cabeçalho da tabela */}
                <View style={styles.tabelaHeader}>
                  <Text style={[styles.th, { width: LARGURAS.produto }]}>Produto</Text>
                  <Text style={[styles.th, { width: LARGURAS.qtd }]}>Qtd</Text>
                  <Text style={[styles.th, { width: LARGURAS.unit }]}>Unit.</Text>
                  <Text style={[styles.th, { width: LARGURAS.categoria }]}>Categoria</Text>
                  <Text style={[styles.th, { width: LARGURAS.mercado }]}>Mercado</Text>
                  <Text style={[styles.th, { width: LARGURAS.data }]}>Data</Text>
                  <Text style={[styles.th, { width: LARGURAS.total, textAlign: 'right' }]}>Total</Text>
                </View>

                {filtrados.slice(0, 300).map((r: Registro, i: number) => {
                  const cat: Categoria = infoCategoria(r.categoria);
                  return (
                    <TouchableOpacity
                      key={`${r.notaId}-${r.idx}`}
                      activeOpacity={0.7}
                      delayLongPress={350}
                      onLongPress={() => setEditando(r)}
                      style={[styles.tr, i % 2 === 0 && styles.trZebra]}
                    >
                      <Text
                        style={[styles.td, { width: LARGURAS.produto, fontWeight: 'bold', color: '#F4F5F7' }]}
                        numberOfLines={2}
                      >
                        {r.nome}
                      </Text>
                      <Text style={[styles.td, { width: LARGURAS.qtd }]} numberOfLines={1}>{r.qtd} {r.unidade}</Text>
                      <Text
                        style={[styles.td, { width: LARGURAS.unit }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {formatarMoeda(r.valorUnitario)}
                      </Text>
                      <View style={{ width: LARGURAS.categoria }}>
                        <TouchableOpacity
                          onPress={() => setEditando(r)}
                          style={[styles.tagCat, { borderColor: cat.cor, backgroundColor: `${cat.cor}20` }]}
                        >
                          <Text style={[styles.tagCatTexto, { color: cat.cor }]} numberOfLines={1}>
                            {cat.emoji} {cat.nome}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.td, { width: LARGURAS.mercado }]} numberOfLines={2}>{r.mercado}</Text>
                      <Text style={[styles.td, { width: LARGURAS.data }]} numberOfLines={1}>{r.data}</Text>
                      <Text
                        style={[styles.td, { width: LARGURAS.total, textAlign: 'right', color: '#00E676', fontWeight: 'bold' }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {formatarMoeda(r.valorTotal)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            {filtrados.length > 300 && (
              <Text style={styles.dica}>Mostrando os 300 mais recentes. Use a busca para achar os outros.</Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.dica}>Para cada produto: onde foi mais barato e quanto pagou na última vez</Text>
            {precos.map((p: GrupoPreco) => {
              const cat: Categoria = infoCategoria(p.ultimo.categoria);
              const ultimoEhMenor = p.ultimo.valorUnitario <= p.menor.valorUnitario;
              return (
                <View key={p.chave} style={styles.precoCard}>
                  <View style={styles.precoTopo}>
                    <Text style={styles.precoNome} numberOfLines={2}>{p.ultimo.nome}</Text>
                    <View style={[styles.tagCat, { borderColor: cat.cor, backgroundColor: `${cat.cor}20` }]}>
                      <Text style={[styles.tagCatTexto, { color: cat.cor }]}>{cat.emoji}</Text>
                    </View>
                  </View>

                  <View style={styles.precoLinha}>
                    <Feather name="award" size={14} color="#00E676" />
                    <Text style={styles.precoTexto}>
                      Mais barato:{' '}
                      <Text style={{ color: '#00E676', fontWeight: '900' }}>{formatarMoeda(p.menor.valorUnitario)}</Text>
                      {' '}em {p.menor.mercado} ({p.menor.data})
                    </Text>
                  </View>
                  <View style={styles.precoLinha}>
                    <Feather name="clock" size={14} color={ultimoEhMenor ? '#00E676' : '#FF3B5C'} />
                    <Text style={styles.precoTexto}>
                      Última vez:{' '}
                      <Text style={{ color: ultimoEhMenor ? '#00E676' : '#FF3B5C', fontWeight: '900' }}>
                        {formatarMoeda(p.ultimo.valorUnitario)}
                      </Text>
                      {' '}em {p.ultimo.mercado}
                    </Text>
                  </View>
                  <Text style={styles.precoVezes}>Comprado {p.vezes}x</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* LEITOR DE CÓDIGO DE BARRAS */}
      <LeitorCodigoBarras
        visivel={scannerAberto}
        fechar={() => setScannerAberto(false)}
        aoLerCodigo={(codigo) => {
          // Por enquanto só mostra o código lido na busca; vai ganhar outra função no futuro
          setBusca(codigo);
          setScannerAberto(false);
        }}
      />

      {/* MODAL: DETALHE DA NOTA */}
      <Modal
        visible={!!notaDetalhe}
        transparent
        animationType="slide"
        onRequestClose={() => { setNotaDetalhe(null); setRenomeando(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                {renomeando ? (
                  <View style={styles.renomearLinha}>
                    <TextInput
                      style={styles.inputRenomear}
                      value={nomeEditado}
                      onChangeText={setNomeEditado}
                      autoFocus
                      placeholder="Nome do mercado"
                      placeholderTextColor="#8A8D98"
                    />
                    <TouchableOpacity onPress={salvarRenomeacao} style={styles.btnConfirmarRenome}>
                      <Feather name="check" size={18} color="#0B0B0F" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setRenomeando(false)} style={styles.btnCancelarRenome}>
                      <Feather name="x" size={18} color="#8A8D98" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.renomearLinha}>
                    <Text style={styles.modalTitulo} numberOfLines={2}>{notaDetalhe?.mercado}</Text>
                    <TouchableOpacity
                      onPress={() => { setNomeEditado(notaDetalhe?.mercado || ''); setRenomeando(true); }}
                      style={styles.btnEditarNome}
                    >
                      <Feather name="edit-2" size={14} color="#D4FF3A" />
                    </TouchableOpacity>
                  </View>
                )}
                {!!notaDetalhe?.mercadoOriginal && notaDetalhe.mercadoOriginal !== notaDetalhe.mercado && (
                  <Text style={styles.modalRazaoSocial} numberOfLines={1}>{notaDetalhe.mercadoOriginal}</Text>
                )}
                <Text style={styles.modalSub}>
                  {notaDetalhe?.data} • {notaDetalhe?.itens.length} {notaDetalhe?.itens.length === 1 ? 'produto' : 'produtos'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setNotaDetalhe(null); setRenomeando(false); }} style={styles.closeBtn}>
                <Feather name="x" size={22} color="#F4F5F7" />
              </TouchableOpacity>
            </View>

            <View style={styles.linhaTotalDetalhe}>
              <Text style={styles.modalTotalDetalhe}>{formatarMoeda(notaDetalhe?.total || 0)}</Text>
              <TouchableOpacity style={styles.btnVerRegistros} onPress={verRegistrosDoMercado}>
                <Feather name="bar-chart-2" size={13} color="#0B0B0F" style={{ marginRight: 6 }} />
                <Text style={styles.btnVerRegistrosTexto}>Ver Registros</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320, marginTop: 10 }} showsVerticalScrollIndicator={false}>
              {notaDetalhe?.itens.map((it: Registro) => {
                const cat = infoCategoria(it.categoria);
                return (
                  <View key={it.idx} style={styles.itemDetalhe}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.itemDetalheNome} numberOfLines={2}>{it.nome}</Text>
                      <Text style={styles.itemDetalheInfo}>{it.qtd} {it.unidade} x {formatarMoeda(it.valorUnitario)}</Text>
                    </View>
                    <Text style={styles.itemDetalheValor}>{formatarMoeda(it.valorTotal)}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.btnExcluir}
              onPress={() => notaDetalhe && excluirNota(notaDetalhe.notaId, notaDetalhe.mercado, notaDetalhe.data)}
            >
              <Feather name="trash-2" size={16} color="#FF3B5C" />
              <Text style={styles.btnExcluirTexto}>Excluir esta nota inteira</Text>
            </TouchableOpacity>
          </View>
        </View>
        <DialogoNoModal />
      </Modal>

      {/* MODAL: ESCOLHER CATEGORIA */}
      <Modal visible={!!editando} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.modalTitulo}>Mudar categoria</Text>
                <Text style={styles.modalSub} numberOfLines={2}>{editando?.nome}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditando(null)} style={styles.closeBtn}>
                <Feather name="x" size={22} color="#F4F5F7" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalAviso}>
              Vale para todos os registros desse produto e para as próximas notas.
            </Text>

            <View style={styles.catGrid}>
              {LISTA_CATEGORIAS.map((c: Categoria) => {
                const atual = editando?.categoria === c.nome;
                return (
                  <TouchableOpacity
                    key={c.nome}
                    activeOpacity={0.8}
                    style={[styles.catBtn, atual && { backgroundColor: `${c.cor}25`, borderColor: c.cor }]}
                    onPress={() => editando && aplicarCategoria(editando, c.nome)}
                  >
                    <Text style={styles.catEmoji}>{c.emoji}</Text>
                    <Text style={[styles.catNome, atual && { color: c.cor }]} numberOfLines={1}>{c.nome}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.btnExcluir}
              onPress={() => editando && excluirNota(editando.notaId, editando.mercado, editando.data)}
            >
              <Feather name="trash-2" size={16} color="#FF3B5C" />
              <Text style={styles.btnExcluirTexto}>Excluir esta nota inteira</Text>
            </TouchableOpacity>
          </View>
        </View>
        <DialogoNoModal />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0B0F' },
  scroll: { paddingTop: Platform.OS === 'ios' ? 20 : 40, paddingBottom: 170, paddingHorizontal: 20, width: '100%', maxWidth: 700, alignSelf: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingRight: 100 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1C1D25', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2A2B34' },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#F4F5F7' },
  subtitulo: { fontSize: 12, color: '#8A8D98', marginTop: 2 },

  resumoRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  resumoCard: { flex: 1, backgroundColor: '#1C1D25', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#2A2B34', alignItems: 'center' },
  resumoLabel: { color: '#8A8D98', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 },
  resumoValor: { color: '#F4F5F7', fontSize: 16, fontWeight: '900' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1D25', borderRadius: 16, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#2A2B34', marginBottom: 15 },
  searchInput: { flex: 1, color: '#F4F5F7', fontSize: 15 },
  btnScanner: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#0B0B0F', borderWidth: 1, borderColor: '#2A2B34', justifyContent: 'center', alignItems: 'center' },

  modoContainer: { flexDirection: 'row', backgroundColor: '#1C1D25', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#2A2B34', marginBottom: 15 },
  modoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10 },
  modoBtnAtivo: { backgroundColor: '#D4FF3A' },
  modoTexto: { color: '#8A8D98', fontWeight: 'bold', fontSize: 12 },
  modoTextoAtivo: { color: '#0B0B0F' },

  voltarRegistrosBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1D25', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2A2B34', marginBottom: 15 },
  voltarRegistrosTexto: { color: '#D4FF3A', fontWeight: 'bold', fontSize: 13, marginLeft: 8 },
  voltarRegistrosContagem: { color: '#8A8D98', fontSize: 11, fontWeight: 'bold' },

  chip: { backgroundColor: '#1C1D25', paddingHorizontal: 14, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#2A2B34', marginRight: 8, justifyContent: 'center' },
  chipAtivo: { backgroundColor: '#D4FF3A', borderColor: '#D4FF3A' },
  chipTexto: { color: '#8A8D98', fontWeight: 'bold', fontSize: 12 },

  dica: { color: '#8A8D98', fontSize: 11, marginBottom: 12, textAlign: 'center' },

  // Grade de "quadradinhos" de notas
  gradeNotas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cardNota: { width: '48%', backgroundColor: '#1C1D25', borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#2A2B34' },
  cardNotaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardNotaData: { color: '#8A8D98', fontSize: 11, fontWeight: 'bold' },
  cardNotaMercado: { color: '#F4F5F7', fontSize: 14, fontWeight: 'bold', marginBottom: 6, minHeight: 36 },
  cardNotaItens: { color: '#8A8D98', fontSize: 11, marginBottom: 8 },
  cardNotaTotal: { color: '#00E676', fontSize: 18, fontWeight: '900' },

  btnRegistrosTotais: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4FF3A', borderRadius: 16, paddingVertical: 15, marginTop: 4 },
  btnRegistrosTotaisTexto: { color: '#0B0B0F', fontWeight: 'bold', fontSize: 14 },

  tabelaHeader: { flexDirection: 'row', backgroundColor: '#2A2B34', paddingVertical: 12, paddingHorizontal: 10, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  th: { color: '#D4FF3A', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#2A2B34' },
  trZebra: { backgroundColor: '#1C1D25' },
  td: { color: '#8A8D98', fontSize: 12, paddingRight: 8 },

  tagCat: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, maxWidth: '95%' },
  tagCatTexto: { fontSize: 10, fontWeight: '900' },

  precoCard: { backgroundColor: '#1C1D25', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2B34' },
  precoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  precoNome: { color: '#F4F5F7', fontSize: 15, fontWeight: 'bold', flex: 1, paddingRight: 10 },
  precoLinha: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  precoTexto: { color: '#8A8D98', fontSize: 12, flex: 1 },
  precoVezes: { color: '#8A8D98', fontSize: 11, marginTop: 4 },

  vazio: { alignItems: 'center', paddingVertical: 50 },
  vazioTexto: { color: '#8A8D98', fontSize: 14, marginTop: 15, textAlign: 'center', lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1C1D25', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, borderWidth: 1, borderColor: '#2A2B34', maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  modalTitulo: { color: '#F4F5F7', fontSize: 20, fontWeight: 'bold', flexShrink: 1 },
  modalRazaoSocial: { color: '#8A8D98', fontSize: 11, marginTop: 2 },
  modalSub: { color: '#D4FF3A', fontSize: 13, fontWeight: 'bold', marginTop: 4 },
  modalAviso: { color: '#8A8D98', fontSize: 11, marginBottom: 18 },
  closeBtn: { padding: 8, backgroundColor: '#0B0B0F', borderRadius: 12 },

  renomearLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnEditarNome: { padding: 6 },
  inputRenomear: { flex: 1, backgroundColor: '#0B0B0F', borderRadius: 10, borderWidth: 1, borderColor: '#2A2B34', color: '#F4F5F7', fontSize: 16, fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 8 },
  btnConfirmarRenome: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#D4FF3A', justifyContent: 'center', alignItems: 'center' },
  btnCancelarRenome: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#0B0B0F', borderWidth: 1, borderColor: '#2A2B34', justifyContent: 'center', alignItems: 'center' },

  linhaTotalDetalhe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTotalDetalhe: { color: '#00E676', fontSize: 26, fontWeight: '900' },
  btnVerRegistros: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D4FF3A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  btnVerRegistrosTexto: { color: '#0B0B0F', fontSize: 11, fontWeight: 'bold' },

  itemDetalhe: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0B0B0F', padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2A2B34' },
  itemDetalheNome: { color: '#F4F5F7', fontSize: 13, fontWeight: 'bold' },
  itemDetalheInfo: { color: '#8A8D98', fontSize: 11, marginTop: 2 },
  itemDetalheValor: { color: '#00E676', fontSize: 14, fontWeight: 'bold' },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catBtn: { width: '31%', backgroundColor: '#0B0B0F', borderRadius: 14, borderWidth: 1, borderColor: '#2A2B34', paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  catEmoji: { fontSize: 24, marginBottom: 6 },
  catNome: { color: '#8A8D98', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 4 },

  btnExcluir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FF3B5C15', borderWidth: 1, borderColor: '#FF3B5C30' },
  btnExcluirTexto: { color: '#FF3B5C', fontWeight: 'bold', fontSize: 13 },
});
