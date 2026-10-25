// Função do servidor (Vercel) que lê a página da nota na Sefaz para a versão SITE do app.
// No navegador o app não consegue abrir a página da Sefaz sozinho (bloqueio de segurança entre sites),
// então quem busca é este servidor. No celular (app instalado) isso NÃO é usado.
//
// Uso: GET /api/nota?url=<endereço do QR Code, codificado>

const NAVEGADOR = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

const ENTIDADES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

function limparTexto(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTIDADES[m] || ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numero(txt) {
  const n = parseFloat(String(txt || '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// Pega o conteúdo do primeiro elemento que tenha a classe indicada
function porClasse(html, classe) {
  const re = new RegExp('<(span|div|td|h\\d|b|strong)[^>]*class="[^"]*\\b' + classe + '\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>', 'i');
  const m = html.match(re);
  return m ? limparTexto(m[2]) : '';
}

function lerNota(html) {
  const blocos = html.split(/<tr[^>]*id="Item/i).slice(1);
  const produtos = blocos.map((bloco) => {
    const parte = bloco.split(/<\/tr>/i)[0];
    return {
      nome: porClasse(parte, 'txtTit') || 'Produto',
      qtd: numero(porClasse(parte, 'Rqtd').replace(/Qtde\.?:?/i, '')) || 1,
      unidade: porClasse(parte, 'RUN').replace(/UN:?/i, '').trim() || 'UN',
      valorUnitario: numero(porClasse(parte, 'RvlUnit').replace(/Vl\.?\s*Unit\.?:?/i, '')),
      valorTotal: numero(porClasse(parte, 'valor')),
    };
  });

  const texto = limparTexto(html);
  const mercado = porClasse(html, 'txtTopo') || porClasse(html, 'u20') || 'Mercado Desconhecido';
  const cnpjMatch = texto.match(/CNPJ:?\s*([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2})/);
  const dataMatch = texto.match(/Emiss[ãa]o:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const esperadoMatch = texto.match(/Qtd\.?\s*total\s*de\s*itens:?\s*(\d+)/i);

  return {
    mercado,
    cnpj: cnpjMatch ? cnpjMatch[1].replace(/\D/g, '') : '',
    data: dataMatch ? dataMatch[1] : new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    total: numero(porClasse(html, 'txtMax')),
    produtos,
    esperado: esperadoMatch ? parseInt(esperadoMatch[1], 10) : 0,
  };
}

function decodificar(buffer, contentType) {
  const charset = (/charset=([^;]+)/i.exec(contentType || '') || [])[1];
  const nome = (charset || 'utf-8').trim().toLowerCase();
  try {
    return new TextDecoder(nome).decode(buffer);
  } catch (e) {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const url = String((req.query && req.query.url) || '');
  let destino;
  try {
    destino = new URL(url);
  } catch (e) {
    return res.status(400).json({ erro: 'url_invalida', mensagem: 'Esse QR Code não parece ser de uma nota fiscal.' });
  }

  // Só aceita endereços https de sites do governo (evita uso do servidor para outras coisas)
  if (destino.protocol !== 'https:' || !/\.gov\.br$/i.test(destino.hostname)) {
    return res.status(400).json({ erro: 'url_invalida', mensagem: 'Esse QR Code não é de um site de nota fiscal (.gov.br).' });
  }

  try {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 25000);
    const resposta = await fetch(destino.toString(), { headers: NAVEGADOR, redirect: 'follow', signal: controle.signal });
    clearTimeout(timer);

    const buffer = await resposta.arrayBuffer();
    const html = decodificar(buffer, resposta.headers.get('content-type'));

    if (/requested URL was rejected/i.test(html) || resposta.status === 403) {
      return res.status(502).json({
        erro: 'bloqueio',
        mensagem: 'A Sefaz recusou o acesso vindo do site. Tente de novo em alguns minutos ou use o app instalado no celular.',
      });
    }

    const dados = lerNota(html);
    if (!dados.produtos.length) {
      return res.status(422).json({
        erro: 'sem_itens',
        mensagem:
          'A Sefaz não mostrou os produtos para o site (pode ter pedido uma verificação "não sou robô"). Use o app instalado no celular para ler essa nota.',
      });
    }

    return res.status(200).json({ dados });
  } catch (e) {
    return res.status(504).json({
      erro: 'falha',
      mensagem: 'Não consegui falar com a Sefaz agora. Tente de novo em instantes.',
    });
  }
};
