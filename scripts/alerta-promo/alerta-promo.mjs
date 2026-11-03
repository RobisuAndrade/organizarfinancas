// Vigia canais PÚBLICOS do Telegram e avisa no grupo quando aparece uma palavra cadastrada no app.
// Roda no GitHub Actions (.github/workflows/alerta-promo.yml), a cada ~5 minutos.
//
// Variáveis (Secrets do GitHub):
//   FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço do Firebase
//   TELEGRAM_BOT_TOKEN        token do bot (@BotFather)
//   TELEGRAM_CHAT_ID          id do grupo que recebe os avisos
import admin from 'firebase-admin';
import { analisarCanal, casaPalavra, montarMensagem } from './lib.mjs';

const DATABASE_URL = 'https://organizar-financas-default-rtdb.firebaseio.com';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CONTA = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!TOKEN || !CHAT_ID || !CONTA) {
  console.error('Faltam secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID e/ou FIREBASE_SERVICE_ACCOUNT.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(CONTA)), databaseURL: DATABASE_URL });
const db = admin.database();

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviarTelegram(texto) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const resp = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: texto, parse_mode: 'HTML' }),
    });
    if (resp.ok) return true;
    if (resp.status === 429) {
      const dados = await resp.json().catch(() => ({}));
      await dormir(((dados?.parameters?.retry_after ?? 3) + 1) * 1000);
      continue;
    }
    // nunca imprime o token: só o código e a descrição devolvidos pelo Telegram
    const dados = await resp.json().catch(() => ({}));
    console.error(`Telegram recusou (${resp.status}): ${dados?.description ?? 'sem detalhe'}`);
    return false;
  }
  return false;
}

async function baixarCanal(usuario) {
  const resp = await fetch(`https://t.me/s/${encodeURIComponent(usuario)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlertaPromo/1.0)', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

async function main() {
  const agora = Date.now();
  const raiz = (await db.ref('alertasPromo').get()).val() || {};
  const estado = raiz.estado || {};

  // palavras valendo agora (ativas e dentro do prazo)
  const palavras = Object.entries(raiz.palavras || {})
    .map(([id, p]) => ({ id, termo: String(p?.termo || ''), ativo: p?.ativo !== false, expiraEm: Number(p?.expiraEm) || 0 }))
    .filter((p) => p.termo && p.ativo && (p.expiraEm === 0 || p.expiraEm > agora));

  const canais = Object.values(raiz.canais || {})
    .filter((c) => c && typeof c.usuario === 'string' && c.ativo !== false)
    .map((c) => c.usuario);

  // pedido de teste feito pelo botão "Enviar teste" do app
  const pediuTeste = Number(estado.pedirTeste) || 0;
  if (pediuTeste > (Number(estado.testeAtendido) || 0)) {
    const ok = await enviarTelegram('✅ <b>Teste do alerta</b>\nSe você recebeu isto, o vigia está funcionando e o grupo está certo.');
    if (ok) await db.ref('alertasPromo/estado/testeAtendido').set(pediuTeste);
  }

  let algumCanalLido = false;
  const contagem = {}; // id da palavra -> avisos novos

  for (const usuario of canais) {
    let html;
    try {
      html = await baixarCanal(usuario);
    } catch (e) {
      console.error(`Canal @${usuario}: não consegui abrir (${e.message}).`);
      continue;
    }
    algumCanalLido = true;

    const posts = analisarCanal(html, usuario);
    if (posts.length === 0) {
      console.log(`Canal @${usuario}: nenhuma mensagem encontrada (canal privado ou sem prévia web?).`);
      continue;
    }

    const chave = usuario.toLowerCase();
    const refLido = db.ref(`alertasPromo/estado/lidos/${chave}`);
    const lidoAntes = (await refLido.get()).val();
    const maiorId = posts[posts.length - 1].id;

    // primeira vez neste canal: só marca o ponto de partida, sem avisar o histórico antigo
    if (typeof lidoAntes !== 'number') {
      await refLido.set(maiorId);
      console.log(`Canal @${usuario}: ponto de partida ${maiorId}.`);
      continue;
    }

    let processadoAte = lidoAntes;
    for (const post of posts) {
      if (post.id <= lidoAntes) continue;
      const achadas = palavras.filter((p) => casaPalavra(p.termo, post.texto));
      if (achadas.length > 0) {
        const ok = await enviarTelegram(montarMensagem(post, achadas.map((p) => p.termo)));
        if (!ok) break; // não avança além do aviso que falhou: tenta de novo na próxima rodada
        for (const p of achadas) contagem[p.id] = (contagem[p.id] || 0) + 1;
        await dormir(1100); // limite do Telegram: ~1 mensagem por segundo no mesmo grupo
      }
      processadoAte = post.id;
    }
    if (processadoAte !== lidoAntes) await refLido.set(processadoAte);
    console.log(`Canal @${usuario}: ${posts.length} mensagens lidas, ponto ${processadoAte}.`);
  }

  for (const [id, n] of Object.entries(contagem)) {
    await db.ref(`alertasPromo/palavras/${id}/avisos`).set(admin.database.ServerValue.increment(n));
  }

  // o app usa isto para mostrar "última checagem" (só conta se algum canal foi lido de verdade)
  if (algumCanalLido || canais.length === 0) {
    await db.ref('alertasPromo/estado/ultimaVerificacao').set(Date.now());
  }
  console.log(`Fim: ${palavras.length} palavra(s) ativa(s), ${canais.length} canal(is).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Erro:', e?.message || e);
    process.exit(1);
  });
