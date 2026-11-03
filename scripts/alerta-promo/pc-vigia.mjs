// Vigia de promoções rodando no SEU PC: confere os canais a cada minuto.
// Só trabalha quando, no app (ALERTA > Quem vigia), estiver marcado "Meu PC".
// Com o PC desligado, dormindo ou esta janela fechada, o GitHub assume sozinho depois de ~3 minutos.
//
// Configuração: copie ".env.exemplo" para ".env" (nesta mesma pasta) e preencha. O ".env" não vai para o GitHub.
// Para iniciar: dê dois cliques em "iniciar-vigia-pc.bat".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciarFirebase, rodar } from './vigia.mjs';

const pasta = path.dirname(fileURLToPath(import.meta.url));

// leitor simples de .env (CHAVE=valor, sem dependências)
function carregarEnv() {
  const arquivo = path.join(pasta, '.env');
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || linha.trim().startsWith('#')) continue;
    let valor = m[2];
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) valor = valor.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}
carregarEnv();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ARQUIVO_CHAVE = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
const INTERVALO_MS = 60 * 1000;

const faltando = [];
if (!TOKEN) faltando.push('TELEGRAM_BOT_TOKEN');
if (!CHAT_ID) faltando.push('TELEGRAM_CHAT_ID');
if (!ARQUIVO_CHAVE) faltando.push('FIREBASE_SERVICE_ACCOUNT_FILE');
if (faltando.length > 0) {
  console.error(`Falta preencher no arquivo .env: ${faltando.join(', ')}.`);
  console.error('Copie ".env.exemplo" para ".env" e preencha.');
  process.exit(2);
}
if (!fs.existsSync(ARQUIVO_CHAVE)) {
  console.error(`Não achei o arquivo da chave do Firebase em: ${ARQUIVO_CHAVE}`);
  process.exit(2);
}

const hora = () => new Date().toLocaleTimeString('pt-BR');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const { admin, db } = await iniciarFirebase(fs.readFileSync(ARQUIVO_CHAVE, 'utf8'));
console.log(`[${hora()}] Vigia do PC ligado. Confere a cada ${INTERVALO_MS / 1000}s. Feche esta janela para parar.`);

for (;;) {
  try {
    const r = await rodar({ token: TOKEN, chatId: CHAT_ID, admin, db }, 'pc');
    if (r && r.pulou) console.log(`[${hora()}] Em espera: ${r.pulou}.`);
  } catch (e) {
    console.error(`[${hora()}] Erro nesta rodada: ${e?.message || e}`);
  }
  await dormir(INTERVALO_MS);
}
