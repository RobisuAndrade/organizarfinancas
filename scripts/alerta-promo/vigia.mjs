// Núcleo do vigia de promoções. Usado de dois jeitos:
//   - alerta-promo.mjs  -> GitHub Actions, uma rodada a cada ~5 min
//   - pc-vigia.mjs      -> seu PC, uma rodada por minuto
//
// Quem vigia é escolhido no app (alertasPromo/config/executor = 'github' | 'pc'):
//   - 'github': só o GitHub vigia.
//   - 'pc': o PC vigia a cada minuto e o GitHub fica quieto. Se o PC parar de dar sinal
//           (desligou, dormiu, fechou a janela), o GitHub assume sozinho depois de ~3 min.
// Uma "trava" no Firebase garante que duas execuções nunca trabalhem ao mesmo tempo (sem aviso duplicado).
import { analisarCanal, casaPalavra, montarMensagem } from './lib.mjs';

export const DATABASE_URL = 'https://organizar-financas-default-rtdb.firebaseio.com';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const PC_VIVO_MS = 3 * 60 * 1000; // sem sinal do PC por mais que isso = PC fora do ar
const TRAVA_MS = 90 * 1000;
const HISTORICO_MAX = 60;
const LIMITE_AVISOS_POR_RODADA = 6; // proteção contra palavra comum demais (ex.: "cupom") lotar o grupo

export async function iniciarFirebase(contaJson) {
  const admin = (await import('firebase-admin')).default;
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(contaJson)), databaseURL: DATABASE_URL });
  }
  return { admin, db: admin.database() };
}

export async function enviarTelegram({ token, chatId }, texto) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' }),
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

export async function baixarCanal(usuario) {
  const resp = await fetch(`https://t.me/s/${encodeURIComponent(usuario)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlertaPromo/1.0)', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

// Teste: pega a mensagem mais recente do canal que tenha a palavra e manda para o grupo.
export async function modoTeste(tg, palavra, canal) {
  const usuario = canal.replace(/^@/, '');
  console.log(`Modo teste: procurando "${palavra}" em @${usuario}.`);
  const html = await baixarCanal(usuario);
  const posts = analisarCanal(html, usuario);
  console.log(`${posts.length} mensagem(ns) lida(s) da página do canal.`);
  if (posts.length === 0) {
    console.error('Nenhuma mensagem encontrada: o canal pode ser privado ou sem prévia na web.');
    return false;
  }
  const achada = [...posts].reverse().find((p) => casaPalavra(palavra, p.texto));
  if (!achada) {
    return enviarTelegram(
      tg,
      `✅ <b>Teste do alerta</b>\nO Telegram está funcionando e li ${posts.length} mensagens de @${usuario}, mas nenhuma tem "${palavra.replace(/[<>&]/g, '')}". Tente outra palavra.`
    );
  }
  const ok = await enviarTelegram(tg, montarMensagem(achada, [palavra]));
  console.log(ok ? `Enviado: mensagem ${achada.id}.` : 'Falha ao enviar para o Telegram.');
  return ok;
}

async function adquirirTrava(db, dono) {
  const resultado = await db.ref('alertasPromo/estado/trava').transaction((atual) => {
    const agora = Date.now();
    if (atual && atual.ate > agora && atual.dono !== dono) return undefined; // outro está trabalhando
    return { dono, ate: agora + TRAVA_MS };
  });
  return !!resultado.committed;
}

// estende a trava enquanto a rodada ainda está enviando (uma rodada longa não pode perder a trava)
async function renovarTrava(db, dono) {
  await db.ref('alertasPromo/estado/trava').transaction((atual) => (atual && atual.dono === dono ? { dono, ate: Date.now() + TRAVA_MS } : atual));
}

// palavras que valem AGORA, lidas de novo do Firebase (apagou, pausou ou venceu = para na hora)
async function palavrasValendo(db) {
  const agora = Date.now();
  const bruto = (await db.ref('alertasPromo/palavras').get()).val() || {};
  return Object.entries(bruto)
    .map(([id, p]) => ({ id, termo: String(p?.termo || ''), ativo: p?.ativo !== false, expiraEm: Number(p?.expiraEm) || 0 }))
    .filter((p) => p.termo && p.ativo && (p.expiraEm === 0 || p.expiraEm > agora));
}

async function liberarTrava(db, dono) {
  await db.ref('alertasPromo/estado/trava').transaction((atual) => (atual && atual.dono === dono ? null : atual));
}

// Uma rodada de vigilância. origem = 'github' | 'pc'
export async function rodar(cfg, origem) {
  const { db } = cfg;
  const inicio = Date.now();

  // sinal de vida do PC (o app mostra "PC conectado")
  if (origem === 'pc') await db.ref('alertasPromo/estado/pcBatimento').set(inicio);

  const raiz = (await db.ref('alertasPromo').get()).val() || {};
  const estado = raiz.estado || {};
  const executor = raiz.config && raiz.config.executor === 'pc' ? 'pc' : 'github';
  const pcVivo = inicio - (Number(estado.pcBatimento) || 0) < PC_VIVO_MS;

  if (origem === 'pc' && executor !== 'pc') return { pulou: 'o GitHub é quem vigia agora' };
  if (origem === 'github' && executor === 'pc' && pcVivo) {
    console.log('O PC está vigiando; o GitHub fica quieto nesta rodada.');
    return { pulou: 'o PC está vigiando' };
  }
  if (!(await adquirirTrava(db, origem))) {
    console.log('Outra execução está em andamento; pulando.');
    return { pulou: 'trava' };
  }
  try {
    return await trabalhar(cfg, origem, raiz, estado);
  } finally {
    await liberarTrava(db, origem).catch(() => {});
  }
}

async function trabalhar(cfg, origem, raiz, estado) {
  const { db, admin } = cfg;
  const agora = Date.now();

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
    const ok = await enviarTelegram(cfg, '✅ <b>Teste do alerta</b>\nSe você recebeu isto, o vigia está funcionando e o grupo está certo.');
    if (ok) await db.ref('alertasPromo/estado/testeAtendido').set(pediuTeste);
  }

  let algumCanalLido = false;
  let falhas = 0;
  let enviados = 0;
  let pulados = 0; // promoções com palavra que NÃO foram enviadas por causa do limite da rodada
  const contagem = {}; // id da palavra -> avisos novos

  for (const usuario of canais) {
    let html;
    try {
      html = await baixarCanal(usuario);
    } catch (e) {
      falhas++;
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
      let achadas = palavras.filter((p) => casaPalavra(p.termo, post.texto));
      if (achadas.length > 0) {
        // confere de novo no Firebase: se a palavra foi apagada/pausada no app, para na hora
        const vigentes = await palavrasValendo(db);
        achadas = vigentes.filter((p) => casaPalavra(p.termo, post.texto));
      }
      if (achadas.length > 0) {
        if (enviados >= LIMITE_AVISOS_POR_RODADA) {
          pulados++; // limite atingido: não manda, mas dá a mensagem por lida
        } else {
          await renovarTrava(db, origem);
          const ok = await enviarTelegram(cfg, montarMensagem(post, achadas.map((p) => p.termo)));
          if (!ok) {
            falhas++;
            break; // não avança além do aviso que falhou: tenta de novo na próxima rodada
          }
          enviados++;
          for (const p of achadas) contagem[p.id] = (contagem[p.id] || 0) + 1;
          await refLido.set(post.id); // grava o ponto a cada aviso: se a rodada cair, não repete
          await dormir(1100); // limite do Telegram: ~1 mensagem por segundo no mesmo grupo
        }
      }
      processadoAte = post.id;
    }
    if (processadoAte !== lidoAntes) await refLido.set(processadoAte);
    console.log(`Canal @${usuario}: ${posts.length} mensagens lidas, ponto ${processadoAte}.`);
  }

  if (pulados > 0) {
    await enviarTelegram(
      cfg,
      `⚠️ <b>Muitas promoções de uma vez</b>\nMais ${pulados} promoç${pulados > 1 ? 'ões' : 'ão'} com suas palavras ${pulados > 1 ? 'não foram enviadas' : 'não foi enviada'} para não lotar o grupo (limite de ${LIMITE_AVISOS_POR_RODADA} por rodada). Se alguma palavra é comum demais, como "cupom", apague-a ou deixe-a mais específica.`
    );
  }

  for (const [id, n] of Object.entries(contagem)) {
    await db.ref(`alertasPromo/palavras/${id}/avisos`).set(admin.database.ServerValue.increment(n));
  }

  // o app usa isto para mostrar "última checagem" (só conta se algum canal foi lido de verdade)
  const leuAlgo = algumCanalLido || canais.length === 0;
  const fim = Date.now();
  if (leuAlgo) {
    await db.ref('alertasPromo/estado').update({ ultimaVerificacao: fim, ultimaOrigem: origem });
  }

  // histórico das execuções (o app mostra as mais recentes)
  await db.ref(`alertasPromo/historico/t${fim}`).set({ quando: fim, origem, canais: canais.length, palavras: palavras.length, avisos: enviados, ok: leuAlgo && falhas === 0 });
  const todas = (await db.ref('alertasPromo/historico').get()).val() || {};
  const chaves = Object.keys(todas).sort();
  if (chaves.length > HISTORICO_MAX + 10) {
    const apagar = {};
    for (const k of chaves.slice(0, chaves.length - HISTORICO_MAX)) apagar[k] = null;
    await db.ref('alertasPromo/historico').update(apagar);
  }

  console.log(`Fim (${origem}): ${palavras.length} palavra(s) ativa(s), ${canais.length} canal(is), ${enviados} aviso(s).`);
  return { avisos: enviados };
}
