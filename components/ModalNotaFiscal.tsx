import { Feather } from '@expo/vector-icons';
import { get, push, ref, set } from 'firebase/database';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { db } from '../firebaseConfig';
import AvoidTeclado from './AvoidTeclado';
import { DialogoNoModal, useDialogo } from '../hooks/useDialogo';
import { categorizarProduto, infoCategoria } from '../utils/categoriasMercado';
import LeitorNota from './LeitorNota';

interface ProdutoNota {
  nome: string;
  qtd: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  categoria?: string;
}

interface DadosNota {
  mercado: string;
  mercadoOriginal?: string;
  cnpj?: string;
  data: string;
  total: number;
  produtos: ProdutoNota[];
  esperado?: number; // quantidade de itens que a própria nota diz ter (se a página informar)
}

// Apaga o armazenamento local da página (o modo anônimo já limpa cookies, cache e histórico)
const LIMPAR_ARMAZENAMENTO = 'try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} true;';

// Identificação de um Chrome comum de celular (o navegador embutido do app costuma ser barrado mais vezes)
const USER_AGENT_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

export default function ModalNotaFiscal({ visivel, fechar }: { visivel: boolean; fechar: () => void }) {
  const [etapa, setEtapa] = useState<'camera' | 'extraindo' | 'nomeando' | 'resultado'>('camera');
  const [urlNota, setUrlNota] = useState('');
  const [dadosNota, setDadosNota] = useState<DadosNota | null>(null);
  const [nomeDigitado, setNomeDigitado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const webviewRef = useRef<WebView>(null);
  const jaProcessou = useRef(false);
  // Muda toda vez que a janela é fechada/reiniciada — respostas atrasadas de uma leitura antiga são ignoradas
  const sessao = useRef(0);
  const { avisar, confirmar } = useDialogo();
  // Tentar de novo: muda a "key" do WebView para recarregar a nota do zero
  const [tentativa, setTentativa] = useState(0);
  const [problemaPagina, setProblemaPagina] = useState<'bloqueio' | 'rede' | null>(null);
  const [progresso, setProgresso] = useState<{ lidos: number; esperado: number } | null>(null);
  // Versão site: mensagem de erro mostrada dentro da própria tela (com botão de tentar de novo)
  const [erroWeb, setErroWeb] = useState<string | null>(null);

  // Quantas vezes já tentamos sozinhos depois de a Sefaz recusar o acesso
  const autoTentativas = useRef(0);

  // "Navegador limpo": apaga cache e cookies e abre a nota de novo do zero
  // (o WebView é recriado em modo anônimo, então nada fica guardado entre as tentativas)
  const recarregarLimpo = () => {
    jaProcessou.current = false;
    setProblemaPagina(null);
    setProgresso(null);
    try {
      (webviewRef.current as any)?.clearCache?.(true);
    } catch (e) {}
    setTentativa(t => t + 1);
  };
  const tentarDeNovo = recarregarLimpo;

  // Salva (ou atualiza) o apelido desse CNPJ e segue para a tela de resultado
  const salvarApelidoEContinuar = async (cnpjLimpo: string, nomeEscolhido: string, base: DadosNota) => {
    try {
      await set(ref(db, `mercado/apelidosCnpj/${cnpjLimpo}`), {
        nome: nomeEscolhido,
        razaoSocial: base.mercadoOriginal || base.mercado,
      });
    } catch (e) {
      // Mesmo se falhar ao salvar o apelido, não trava o fluxo de registrar a compra
    }
    setDadosNota({ ...base, mercado: nomeEscolhido });
    setEtapa('resultado');
  };

  // Pergunta se quer dar um nome mais simples pro mercado (só na 1ª vez que aparece esse CNPJ)
  const perguntarNomeMercado = async (cnpjLimpo: string, base: DadosNota) => {
    const sessaoAtual = sessao.current;
    const quer = await confirmar({
      titulo: 'Mercado novo',
      mensagem: `A nota veio registrada como "${base.mercado}". Quer colocar um nome mais simples pra esse mercado (ex: CESTO)?`,
      textoConfirmar: 'Sim, dar um nome',
      textoCancelar: 'Manter esse',
      icone: 'shopping-bag',
    });
    if (sessaoAtual !== sessao.current) return; // a janela foi fechada enquanto a pergunta estava aberta
    if (quer) {
      setNomeDigitado('');
      setEtapa('nomeando');
    } else {
      salvarApelidoEContinuar(cnpjLimpo, base.mercado, base);
    }
  };

  // Aplica as categorias (usando o que o app já aprendeu com você) e resolve o nome do mercado pelo CNPJ
  const prepararDados = async (dados: DadosNota) => {
    let aprendidas: Record<string, string> = {};
    try {
      const snap = await get(ref(db, 'mercado/categoriasAprendidas'));
      aprendidas = snap.val() || {};
    } catch (e) {}

    const comCategorias: DadosNota = {
      ...dados,
      mercadoOriginal: dados.mercado,
      produtos: dados.produtos.map(p => ({ ...p, categoria: categorizarProduto(p.nome, aprendidas) })),
    };

    const cnpjLimpo = (dados.cnpj || '').replace(/\D/g, '');

    if (cnpjLimpo) {
      try {
        const snapApelido = await get(ref(db, `mercado/apelidosCnpj/${cnpjLimpo}`));
        const apelido = snapApelido.val();
        if (apelido?.nome) {
          // Já sabemos como chamar esse mercado — não precisa perguntar de novo
          setDadosNota({ ...comCategorias, cnpj: cnpjLimpo, mercado: apelido.nome });
          setEtapa('resultado');
          return;
        }
      } catch (e) {}

      // CNPJ novo: pergunta se quer dar um nome mais simples
      setDadosNota({ ...comCategorias, cnpj: cnpjLimpo });
      perguntarNomeMercado(cnpjLimpo, { ...comCategorias, cnpj: cnpjLimpo });
      return;
    }

    // Sem CNPJ identificado na nota — segue direto com o nome que veio
    setDadosNota(comCategorias);
    setEtapa('resultado');
  };

  const confirmarNomeDigitado = () => {
    if (!dadosNota?.cnpj) return;
    const nome = nomeDigitado.trim() || dadosNota.mercadoOriginal || dadosNota.mercado;
    salvarApelidoEContinuar(dadosNota.cnpj, nome, dadosNota);
  };

  // Versão SITE (navegador): quem lê a página da Sefaz é o servidor do site (/api/nota)
  const lerNotaPeloServidor = async (url: string) => {
    const sessaoAtual = sessao.current;
    setErroWeb(null);
    setEtapa('extraindo');
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 40000);
    try {
      // cache: 'no-store' + carimbo de hora: cada tentativa é uma busca nova, nada fica guardado
      const resp = await fetch(`/api/nota?url=${encodeURIComponent(url)}&_t=${Date.now()}`, {
        cache: 'no-store',
        signal: controle.signal,
      });
      let json: any = null;
      try {
        json = await resp.json();
      } catch (e) {}
      if (sessaoAtual !== sessao.current) return;
      if (!resp.ok || !json || json.erro || !json.dados) {
        throw new Error(json?.mensagem || 'Leitura pelo navegador indisponível aqui. Use o site publicado ou o app instalado.');
      }
      jaProcessou.current = true;
      prepararDados(json.dados);
    } catch (e: any) {
      if (sessaoAtual !== sessao.current) return;
      setErroWeb(e?.name === 'AbortError' ? 'A Sefaz demorou demais para responder. Tente de novo.' : e?.message || 'Tente de novo em instantes.');
    } finally {
      clearTimeout(timer);
    }
  };

  const aoLerQrCode = (url: string) => {
    autoTentativas.current = 0;
    setUrlNota(url);
    jaProcessou.current = false;
    if (Platform.OS === 'web') {
      lerNotaPeloServidor(url);
    } else {
      setEtapa('extraindo');
    }
  };

  // Script que roda dentro da página da Sefaz. Em vez de ler a primeira vez que vê algum produto,
  // ele ESPERA a lista terminar de carregar (celulares/internet lentos mostram os itens aos poucos).
  const montarScript = (forcar: boolean) => `
    (function() {
      if (${forcar}) window.__forcarLeitura = true;
      if (window.__leituraNotaAtiva) return;
      window.__leituraNotaAtiva = true;

      var inicio = Date.now();
      var ultimaQtd = -1;
      var estavelDesde = Date.now();
      var enviado = false;

      function enviar(obj) { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }

      function itensEsperados() {
        var t = (document.body && document.body.innerText) || '';
        var m = t.match(/Qtd\\.?\\s*total\\s*de\\s*itens:?\\s*(\\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      }

      function extrair(esperado) {
        const linhas = document.querySelectorAll('tr[id^="Item"]');
        const mercadoEl = document.querySelector('.txtTopo') || document.querySelector('#u20');
        const mercado = mercadoEl ? mercadoEl.innerText.trim() : 'Mercado Desconhecido';

        // CNPJ do emitente em qualquer lugar do texto da página
        const textoCompleto = document.body.innerText || '';
        const matchCnpj = textoCompleto.match(/CNPJ:?\\s*([0-9]{2}\\.?[0-9]{3}\\.?[0-9]{3}\\/?[0-9]{4}-?[0-9]{2})/);
        const cnpj = matchCnpj ? matchCnpj[1].replace(/\\D/g, '') : '';

        // Data de EMISSÃO que vem na nota da Sefaz (se não achar, usa o dia de hoje)
        const matchData = textoCompleto.match(/Emiss[ãa]o:?\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i);
        const dataEmissao = matchData ? matchData[1] : new Date().toLocaleDateString('pt-BR');

        const limparNumero = (txt) => parseFloat(txt.replace(/\\./g, '').replace(',', '.')) || 0;

        const produtos = [];
        linhas.forEach(linha => {
          const nome = linha.querySelector('.txtTit')?.innerText?.trim() || 'Produto';
          const qtdTxt = linha.querySelector('.Rqtd')?.innerText?.replace('Qtde.:', '').trim() || '1';
          const unTxt = linha.querySelector('.RUN')?.innerText?.replace('UN:', '').trim() || 'UN';
          const vlUnitTxt = linha.querySelector('.RvlUnit')?.innerText?.replace('Vl. Unit.:', '').trim() || '0';
          const vlTotalTxt = linha.querySelector('.valor')?.innerText?.trim() || '0';
          produtos.push({
            nome,
            qtd: limparNumero(qtdTxt),
            unidade: unTxt,
            valorUnitario: limparNumero(vlUnitTxt),
            valorTotal: limparNumero(vlTotalTxt)
          });
        });

        const totalEl = document.querySelector('.txtMax');
        const total = totalEl ? limparNumero(totalEl.innerText) : 0;

        enviado = true;
        enviar({ sucesso: true, dados: { mercado, cnpj, data: dataEmissao, total, produtos, esperado } });
      }

      function ciclo() {
        if (enviado) return;
        var texto = (document.body && document.body.innerText) || '';

        // Firewall da Sefaz recusou o acesso? Avisa o app (botão Tentar de novo)
        if (/requested URL was rejected/i.test(texto)) {
          enviar({ rejeitado: true });
          window.__leituraNotaAtiva = false;
          return;
        }

        var qtd = document.querySelectorAll('tr[id^="Item"]').length;
        var esperado = itensEsperados();
        if (qtd !== ultimaQtd) { ultimaQtd = qtd; estavelDesde = Date.now(); }
        var estavel = Date.now() - estavelDesde;

        enviar({ progresso: { lidos: qtd, esperado: esperado } });

        // Pronto quando: chegou a quantidade que a nota informa, ou a lista parou de crescer por alguns segundos
        var completo = qtd > 0 && (esperado > 0 ? (qtd >= esperado && estavel >= 1500) : estavel >= 6000);
        var estourouTempo = Date.now() - inicio > 150000; // até 2min30 de espera
        if (qtd > 0 && (window.__forcarLeitura || completo || estourouTempo)) {
          extrair(esperado);
          return;
        }
        setTimeout(ciclo, 1000);
      }

      ciclo();
    })();
    true;
  `;
  const scriptExtratorSefaz = montarScript(false);

  const receberDadosDaTela = (event: any) => {
    if (jaProcessou.current) return; // evita processar a mesma nota duas vezes
    try {
      const resposta = JSON.parse(event.nativeEvent.data);
      if (resposta.rejeitado) {
        setProblemaPagina('bloqueio');
        // Tenta sozinho até 2 vezes, esperando um pouco mais a cada vez (não "martelar" o firewall)
        if (autoTentativas.current < 2) {
          autoTentativas.current += 1;
          const sessaoAtual = sessao.current;
          setTimeout(() => {
            if (sessaoAtual === sessao.current) recarregarLimpo();
          }, autoTentativas.current * 5000);
        }
        return;
      }
      if (resposta.progresso) {
        setProgresso(resposta.progresso);
        return;
      }
      if (resposta.sucesso && resposta.dados.produtos.length > 0) {
        jaProcessou.current = true;
        prepararDados(resposta.dados);
      }
    } catch (e) {
      console.error('Erro ao converter dados da tela:', e);
    }
  };

  // Volta para a leitura da Sefaz (usado quando a nota veio incompleta)
  const lerNotaDeNovo = () => {
    jaProcessou.current = false;
    setDadosNota(null);
    setProblemaPagina(null);
    setProgresso(null);
    setTentativa(t => t + 1);
    setEtapa('extraindo');
  };

  const salvarNoHistorico = async () => {
    if (!dadosNota) return;
    if (dadosNota.esperado && dadosNota.produtos.length < dadosNota.esperado) {
      const seguir = await confirmar({
        titulo: 'Nota incompleta',
        mensagem: `A nota tem ${dadosNota.esperado} itens, mas só li ${dadosNota.produtos.length}. Registrar assim mesmo?`,
        textoConfirmar: 'Registrar assim',
        textoCancelar: 'Voltar',
      });
      if (!seguir) return;
    }
    setSalvando(true);
    try {
      // Bloqueia nota repetida (mesmo QR Code)
      const snap = await get(ref(db, 'mercado/notas'));
      const existentes = snap.val() || {};
      const repetida = Object.values(existentes).some((n: any) => n.url && n.url === urlNota);
      if (repetida) {
        avisar('Nota repetida', 'Essa nota fiscal já foi registrada antes.', 'aviso');
        return;
      }

      await set(push(ref(db, 'mercado/notas')), {
        mercado: dadosNota.mercado,
        mercadoOriginal: dadosNota.mercadoOriginal || dadosNota.mercado,
        cnpj: dadosNota.cnpj || '',
        data: dadosNota.data,
        total: dadosNota.total,
        url: urlNota,
        criadoEm: new Date().toISOString(),
        itens: dadosNota.produtos,
      });

      avisar('Pronto!', 'Compra registrada em Mercado.', 'sucesso');
      resetarEFechar();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      avisar('Erro', 'Não foi possível salvar a nota.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const resetarEFechar = () => {
    sessao.current += 1;
    autoTentativas.current = 0;
    setErroWeb(null);
    setProblemaPagina(null);
    setProgresso(null);
    setEtapa('camera');
    setUrlNota('');
    setDadosNota(null);
    setNomeDigitado('');
    jaProcessou.current = false;
    fechar();
  };

  return (
    <>
    {/* Etapa da câmera: janela própria que aparece com fade, só o quadrado no meio (sem subir de baixo) */}
    <Modal visible={visivel && etapa === 'camera'} animationType="fade" transparent statusBarTranslucent onRequestClose={resetarEFechar}>
      <View style={styles.fundoScanner}>
        <LeitorNota aoLerCodigo={aoLerQrCode} aoCancelar={resetarEFechar} />
        <DialogoNoModal />
      </View>
    </Modal>

    <Modal visible={visivel && etapa !== 'camera'} animationType="slide" transparent>
      <View style={styles.overlay}>
        <AvoidTeclado style={{ justifyContent: 'flex-end' }}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.titulo}>
              {etapa === 'camera' && 'Escanear QR Code'}
              {etapa === 'extraindo' && 'Lendo Sefaz...'}
              {etapa === 'nomeando' && 'Nome do Mercado'}
              {etapa === 'resultado' && 'Itens da Nota'}
            </Text>
            <TouchableOpacity onPress={resetarEFechar} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#F4F5F7" />
            </TouchableOpacity>
          </View>

          {etapa === 'extraindo' && Platform.OS === 'web' && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
              {erroWeb ? (
                <>
                  <Feather name="alert-triangle" size={40} color="#FF3B5C" />
                  <Text style={[styles.avisoTexto, { marginTop: 16 }]}>{erroWeb}</Text>
                  <TouchableOpacity style={[styles.botaoSalvar, { alignSelf: 'stretch' }]} onPress={() => lerNotaPeloServidor(urlNota)}>
                    <Feather name="refresh-cw" size={18} color="#0B0B0F" style={{ marginRight: 10 }} />
                    <Text style={[styles.textoBotao, { color: '#0B0B0F' }]}>Tentar de novo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.botaoForcarLeitura, { alignSelf: 'stretch', marginTop: 10 }]}
                    onPress={() => {
                      setErroWeb(null);
                      setEtapa('camera');
                    }}
                  >
                    <Text style={styles.textoBotao}>Escanear outra nota</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ActivityIndicator color="#D4FF3A" size="large" />
                  <Text style={[styles.avisoTexto, { marginTop: 20 }]}>
                    Buscando os produtos na Sefaz... pode levar alguns segundos.
                  </Text>
                </>
              )}
            </View>
          )}

          {etapa === 'extraindo' && Platform.OS !== 'web' && (
            <View style={{ flex: 1 }}>
              <Text style={styles.avisoTexto}>
                Extraindo produtos automaticamente da Receita... Se aparecer um Captcha abaixo, resolva-o na tela.
              </Text>
              {!problemaPagina && (
                <Text style={styles.progressoTexto}>
                  {progresso && progresso.lidos > 0
                    ? `Lendo itens: ${progresso.lidos}${progresso.esperado ? ` de ${progresso.esperado}` : ''}... aguarde terminar`
                    : 'Carregando a nota... pode levar alguns segundos'}
                </Text>
              )}
              {!!problemaPagina && (
                <View style={styles.faixaProblema}>
                  <Feather name="alert-triangle" size={16} color="#FF3B5C" style={{ marginRight: 8 }} />
                  <Text style={styles.faixaProblemaTexto}>
                    {problemaPagina === 'bloqueio'
                      ? 'A Sefaz recusou o acesso. Estou limpando o navegador e tentando de novo sozinho. Se não der, toque em Tentar de novo.'
                      : 'Não consegui carregar a página. Verifique a internet e toque em Tentar de novo.'}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, borderRadius: 15, overflow: 'hidden' }}>
                <WebView
                  key={tentativa}
                  ref={webviewRef}
                  source={{ uri: urlNota }}
                  injectedJavaScript={scriptExtratorSefaz}
                  injectedJavaScriptBeforeContentLoaded={LIMPAR_ARMAZENAMENTO}
                  onMessage={receberDadosDaTela}
                  onError={() => setProblemaPagina('rede')}
                  incognito
                  cacheEnabled={false}
                  sharedCookiesEnabled={false}
                  thirdPartyCookiesEnabled={false}
                  userAgent={USER_AGENT_CHROME}
                />
              </View>
              <View style={styles.linhaBotoesLeitura}>
                <TouchableOpacity
                  style={[styles.botaoForcarLeitura, styles.botaoTentarDeNovo, problemaPagina ? styles.botaoTentarDestaque : null]}
                  onPress={tentarDeNovo}
                >
                  <Feather name="refresh-cw" size={16} color={problemaPagina ? '#0B0B0F' : '#F4F5F7'} style={{ marginRight: 8 }} />
                  <Text style={[styles.textoBotao, problemaPagina ? { color: '#0B0B0F' } : null]}>Tentar de novo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botaoForcarLeitura, { flex: 1 }]}
                  onPress={() => webviewRef.current?.injectJavaScript(montarScript(true))}
                >
                  <Text style={styles.textoBotao}>Extrair Agora</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {etapa === 'nomeando' && dadosNota && (
            <View style={{ flex: 1 }}>
              <View style={styles.cardMercado}>
                <Text style={styles.dataNota}>Nome registrado na nota:</Text>
                <Text style={styles.nomeMercado}>{dadosNota.mercadoOriginal || dadosNota.mercado}</Text>
              </View>

              <Text style={styles.avisoTexto}>
                Como vocês costumam chamar esse mercado? Esse nome vale pra essa e pras próximas notas desse mesmo CNPJ.
              </Text>

              <TextInput
                style={styles.inputNome}
                placeholder="Ex: CESTO"
                placeholderTextColor="#8A8D98"
                value={nomeDigitado}
                onChangeText={setNomeDigitado}
                autoFocus
              />

              <View style={{ flex: 1 }} />

              <TouchableOpacity style={styles.botaoSalvar} onPress={confirmarNomeDigitado} disabled={!nomeDigitado.trim()}>
                <Feather name="check" size={20} color="#0B0B0F" style={{ marginRight: 10 }} />
                <Text style={[styles.textoBotao, { color: '#0B0B0F' }]}>Salvar Nome</Text>
              </TouchableOpacity>
            </View>
          )}

          {etapa === 'resultado' && dadosNota && (
            <View style={{ flex: 1 }}>
              <View style={styles.cardMercado}>
                <Text style={styles.nomeMercado}>{dadosNota.mercado}</Text>
                {!!dadosNota.mercadoOriginal && dadosNota.mercadoOriginal !== dadosNota.mercado && (
                  <Text style={styles.razaoSocialTexto} numberOfLines={1}>{dadosNota.mercadoOriginal}</Text>
                )}
                <Text style={styles.dataNota}>Data: {dadosNota.data}</Text>
                <Text style={styles.totalNota}>Total: R$ {dadosNota.total.toFixed(2)}</Text>
              </View>

              {!!dadosNota.esperado && dadosNota.produtos.length < dadosNota.esperado && (
                <View style={styles.faixaProblema}>
                  <Feather name="alert-triangle" size={16} color="#FF3B5C" style={{ marginRight: 8 }} />
                  <Text style={styles.faixaProblemaTexto}>
                    A nota tem {dadosNota.esperado} itens, mas só li {dadosNota.produtos.length}.
                  </Text>
                  <TouchableOpacity onPress={lerNotaDeNovo} style={styles.botaoLerDeNovo}>
                    <Text style={styles.botaoLerDeNovoTexto}>Ler de novo</Text>
                  </TouchableOpacity>
                </View>
              )}

              <FlatList
                data={dadosNota.produtos}
                keyExtractor={(_, index) => index.toString()}
                style={{ flex: 1 }}
                renderItem={({ item }) => {
                  const cat = infoCategoria(item.categoria || 'Outros');
                  return (
                    <View style={styles.itemProduto}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nomeProduto}>{item.nome}</Text>
                        <Text style={styles.detalheProduto}>
                          {item.qtd} {item.unidade} x R$ {item.valorUnitario.toFixed(2)}
                        </Text>
                        <View style={[styles.tagCategoria, { borderColor: cat.cor, backgroundColor: `${cat.cor}20` }]}>
                          <Text style={[styles.tagCategoriaTexto, { color: cat.cor }]}>{cat.emoji} {cat.nome}</Text>
                        </View>
                      </View>
                      <Text style={styles.valorTotalProduto}>R$ {item.valorTotal.toFixed(2)}</Text>
                    </View>
                  );
                }}
              />

              <Text style={styles.dicaTexto}>Você pode ajustar as categorias depois, na tela Mercado.</Text>

              <TouchableOpacity style={styles.botaoSalvar} onPress={salvarNoHistorico} disabled={salvando}>
                {salvando ? (
                  <ActivityIndicator color="#0B0B0F" />
                ) : (
                  <>
                    <Feather name="save" size={20} color="#0B0B0F" style={{ marginRight: 10 }} />
                    <Text style={[styles.textoBotao, { color: '#0B0B0F' }]}>Registrar Compra</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
        </AvoidTeclado>
      </View>
      <DialogoNoModal />
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fundoScanner: { flex: 1, backgroundColor: 'rgba(11,11,15,0.97)' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  container: { flex: 1, backgroundColor: '#1C1D25', marginTop: 50, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 20, borderWidth: 1, borderColor: '#2A2B34' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  titulo: { color: '#F4F5F7', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  closeBtn: { backgroundColor: '#0B0B0F', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34' },
  avisoTexto: { color: '#F4F5F7', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  cardMercado: { backgroundColor: '#0B0B0F', padding: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#2A2B34' },
  nomeMercado: { color: '#D4FF3A', fontSize: 16, fontWeight: 'bold' },
  razaoSocialTexto: { color: '#8A8D98', fontSize: 11, marginTop: 2 },
  dataNota: { color: '#8A8D98', fontSize: 12, marginTop: 4 },
  totalNota: { color: '#F4F5F7', fontSize: 22, fontWeight: '900', marginTop: 8 },
  inputNome: { backgroundColor: '#0B0B0F', borderRadius: 16, borderWidth: 1, borderColor: '#2A2B34', paddingHorizontal: 16, paddingVertical: 14, color: '#F4F5F7', fontSize: 16, fontWeight: 'bold' },
  itemProduto: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2A2B34', padding: 12, borderRadius: 15, marginBottom: 8 },
  nomeProduto: { color: '#F4F5F7', fontSize: 14, fontWeight: 'bold' },
  detalheProduto: { color: '#8A8D98', fontSize: 12, marginTop: 2 },
  tagCategoria: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  tagCategoriaTexto: { fontSize: 10, fontWeight: '900' },
  valorTotalProduto: { color: '#00E676', fontSize: 15, fontWeight: 'bold', marginLeft: 10 },
  dicaTexto: { color: '#8A8D98', fontSize: 11, textAlign: 'center', marginTop: 8 },
  botaoSalvar: { flexDirection: 'row', backgroundColor: '#D4FF3A', padding: 18, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  botaoForcarLeitura: { backgroundColor: '#262731', padding: 15, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  linhaBotoesLeitura: { flexDirection: 'row', gap: 10, marginTop: 10 },
  botaoTentarDeNovo: { flex: 1.3, flexDirection: 'row' },
  botaoTentarDestaque: { backgroundColor: '#D4FF3A' },
  progressoTexto: { color: '#D4FF3A', fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  botaoLerDeNovo: { backgroundColor: '#D4FF3A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginLeft: 8 },
  botaoLerDeNovoTexto: { color: '#0B0B0F', fontWeight: '900', fontSize: 12 },
  faixaProblema: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B5C22', borderWidth: 1, borderColor: '#FF3B5C55', borderRadius: 14, padding: 12, marginBottom: 10 },
  faixaProblemaTexto: { flex: 1, color: '#F4F5F7', fontSize: 12 },
  textoBotao: { color: '#F4F5F7', fontSize: 15, fontWeight: 'bold' },
});
