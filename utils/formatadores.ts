// utils/formatadores.ts

export const converterParaNumero = (valorString: string) => {
  if (!valorString) return 0;
  const numeroLimpo = valorString.replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(numeroLimpo);
  return isNaN(numero) ? 0 : numero;
};

// MODO OCULTO (olhinho da Home): quando ligado, todo valor em dinheiro vira "R$ ••••".
// É uma chave global simples; o Provider (hooks/usePrivacidade.tsx) liga/desliga
// e recarrega as telas pra refletir.
let valoresOcultos = false;
export const definirValoresOcultos = (v: boolean) => { valoresOcultos = v; };
export const estaOculto = () => valoresOcultos;
export const TEXTO_OCULTO = 'R$ ••••';

// Para os pontos da tela que montam "R$ ..." na mão
export const mascarar = (texto: string) => (valoresOcultos ? TEXTO_OCULTO : texto);

export const formatarMoeda = (valor: number) => {
  if (valoresOcultos) return TEXTO_OCULTO;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const formatarInputMoeda = (texto: string) => {
  let valorLimpo = texto.replace(/\D/g, ''); 
  if (!valorLimpo) return '';
  let valorNumero = (parseInt(valorLimpo, 10) / 100).toFixed(2);
  let valorFormatado = valorNumero.replace('.', ',');
  valorFormatado = valorFormatado.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  return valorFormatado;
};

export const formatarDataInput = (texto: string) => {
  let r = texto.replace(/\D/g, "");
  if (r.length > 8) r = r.slice(0, 8);
  if (r.length > 4) r = r.replace(/^(\d{2})(\d{2})(\d{4}).*/, "$1/$2/$3");
  else if (r.length > 2) r = r.replace(/^(\d{2})(\d{1,2}).*/, "$1/$2");
  return r;
};

export const formatarData = (isoString?: string) => {
  if (!isoString) return '--/--/----';
  try {
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR');
  } catch {
    return '--/--/----';
  }
};