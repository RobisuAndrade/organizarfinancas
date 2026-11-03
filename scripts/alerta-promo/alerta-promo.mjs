// Vigia de promoções rodando no GitHub Actions (.github/workflows/alerta-promo.yml): uma rodada por execução.
// A lógica fica em vigia.mjs (a mesma que o seu PC usa em pc-vigia.mjs).
//
// Variáveis (Secrets do GitHub):
//   FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço do Firebase
//   TELEGRAM_BOT_TOKEN        token do bot (@BotFather)
//   TELEGRAM_CHAT_ID          id do grupo que recebe os avisos
//
// MODO TESTE (rodar à mão no GitHub: Actions > Alerta de promoções > Run workflow):
//   TESTE_PALAVRA  procura no canal a mensagem mais recente com esta palavra e reenvia para o grupo.
//                  Não usa o Firebase e não mexe em nada salvo, só serve para ver se o Telegram funciona.
//   TESTE_CANAL    canal a consultar no teste (padrão: gatunopromos)
import { iniciarFirebase, modoTeste, rodar } from './vigia.mjs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CONTA = process.env.FIREBASE_SERVICE_ACCOUNT;
const TESTE_PALAVRA = (process.env.TESTE_PALAVRA || '').trim();
const TESTE_CANAL = (process.env.TESTE_CANAL || '').trim() || 'gatunopromos';

const faltando = [];
if (!TOKEN) faltando.push('TELEGRAM_BOT_TOKEN');
if (!CHAT_ID) faltando.push('TELEGRAM_CHAT_ID');
if (!TESTE_PALAVRA && !CONTA) faltando.push('FIREBASE_SERVICE_ACCOUNT');
if (faltando.length > 0) {
  // sai sem erro para não encher a caixa de e-mail enquanto os Secrets ainda não foram criados
  console.log(`Ainda faltam Secrets no GitHub: ${faltando.join(', ')}. Nada foi feito.`);
  process.exit(0);
}

const tg = { token: TOKEN, chatId: CHAT_ID };

try {
  if (TESTE_PALAVRA) {
    const ok = await modoTeste(tg, TESTE_PALAVRA, TESTE_CANAL);
    process.exit(ok ? 0 : 1);
  }
  const { admin, db } = await iniciarFirebase(CONTA);
  await rodar({ ...tg, admin, db }, 'github');
  process.exit(0);
} catch (e) {
  console.error('Erro:', e?.message || e);
  process.exit(1);
}
