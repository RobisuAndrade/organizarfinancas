// Funções puras do vigia (sem rede), para poderem ser testadas.

const STOPWORDS = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'com', 'para', 'a', 'o', 'as', 'os', 'em']);

export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function pedacos(texto) {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Todas as palavras do termo precisam aparecer, no começo de alguma palavra da mensagem
// ("lava" casa com "lavadora"; "tv" não casa com "estive"). Ligações como "e", "de" são ignoradas.
export function casaPalavra(termo, texto) {
  let partes = pedacos(termo).filter((p) => !STOPWORDS.has(p));
  if (partes.length === 0) partes = pedacos(termo);
  if (partes.length === 0) return false;
  const alvo = ' ' + pedacos(texto).join(' ');
  return partes.every((p) => alvo.includes(' ' + p));
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodificar(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

function textoLimpo(html) {
  return decodificar(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Lê a página pública https://t.me/s/<canal> e devolve as mensagens em ordem (mais antiga primeiro).
export function analisarCanal(html, usuario) {
  const posts = [];
  const blocos = html.split(/<div class="tgme_widget_message_wrap/).slice(1);
  const alvoUsuario = usuario.toLowerCase();

  for (const bloco of blocos) {
    const m = bloco.match(/data-post="([^"\/]+)\/(\d+)"/);
    if (!m) continue;
    if (m[1].toLowerCase() !== alvoUsuario) continue; // ignora mensagens de outro canal na mesma página
    const id = parseInt(m[2], 10);

    // texto principal (legenda de foto também fica aqui). Ignora o bloco de "resposta" citada.
    const semResposta = bloco.replace(/<a class="tgme_widget_message_reply[\s\S]*?<\/a>/, '');
    const t = semResposta.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const html_texto = t ? t[1] : '';
    const texto = textoLimpo(html_texto);

    // links: do texto e dos botões ("Ver oferta")
    const links = [];
    const reLink = /<a [^>]*href="([^"]+)"/gi;
    const origem = html_texto + ' ' + (bloco.match(/tgme_widget_message_inline_keyboard[\s\S]*?<\/div>\s*<\/div>/)?.[0] || '');
    let l;
    while ((l = reLink.exec(origem)) !== null) {
      const url = decodificar(l[1]);
      if (/^https?:\/\//i.test(url) && !links.includes(url)) links.push(url);
    }

    const dataM = bloco.match(/<time[^>]*datetime="([^"]+)"/);
    posts.push({ id, usuario, texto, links, data: dataM ? dataM[1] : '' });
  }

  posts.sort((a, b) => a.id - b.id);
  return posts;
}

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function montarMensagem(post, termos) {
  let texto = post.texto || '(mensagem sem texto)';
  if (texto.length > 700) texto = texto.slice(0, 700).trimEnd() + '…';
  const linhas = [
    `🔔 <b>${escapar(termos.join(', '))}</b>`,
    `<i>@${escapar(post.usuario)}</i>`,
    '',
    escapar(texto),
  ];
  const links = post.links.filter((u) => !/^https?:\/\/(t\.me|telegram\.me)\//i.test(u)).slice(0, 3);
  if (links.length > 0) {
    linhas.push('');
    for (const u of links) linhas.push(`🔗 ${escapar(u)}`);
  }
  linhas.push('', `<a href="https://t.me/${post.usuario}/${post.id}">Abrir no Telegram</a>`);
  return linhas.join('\n');
}
