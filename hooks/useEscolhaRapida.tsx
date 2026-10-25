import { createContext, useContext } from 'react';
import { Colors } from '../constants/theme';

// Telas que foram agrupadas num mesmo card/aba porque tratam do mesmo
// assunto. Quando o usuário toca nesse card (seja na Home, seja na barra
// debaixo), abrimos essa pílula perguntando qual das duas ele quer.
export type TipoEscolhaRapida = 'comprasMercado' | 'salariosMetas';

export type OpcaoEscolha = {
  titulo: string;
  subtitulo: string;
  icone: string;
  rota: string;
  cor: string;
};

export const ESCOLHAS: Record<TipoEscolhaRapida, { titulo: string; rotas: string[]; opcoes: OpcaoEscolha[] }> = {
  comprasMercado: {
    titulo: 'Compras & Mercado',
    rotas: ['compras', 'mercado'],
    opcoes: [
      { titulo: 'Lista de Compras', subtitulo: 'O que falta comprar', icone: 'shopping-bag', rota: '/compras', cor: Colors.lime },
      { titulo: 'Notas & Mercado', subtitulo: 'Histórico de preços', icone: 'shopping-cart', rota: '/mercado', cor: Colors.lavender },
    ],
  },
  salariosMetas: {
    titulo: 'Salários & Metas',
    rotas: ['renda', 'metas'],
    opcoes: [
      { titulo: 'Salários & Renda', subtitulo: 'Entradas do mês', icone: 'dollar-sign', rota: '/renda', cor: Colors.lime },
      { titulo: 'Nossas Metas', subtitulo: 'Poupança do casal', icone: 'target', rota: '/metas', cor: Colors.lavender },
    ],
  },
};

type EscolhaRapidaContextType = {
  abrir: (tipo: TipoEscolhaRapida) => void;
  abrirLista: () => void;
};

// Contexto compartilhado entre a Home (cards do bento) e a barra debaixo
// (abas agrupadas), pra os dois abrirem exatamente a mesma pílula de
// escolha, renderizada uma única vez lá no _layout. "abrirLista" permite
// que a Home abra a Lista de Compras (modal do botão flutuante) direto.
export const EscolhaRapidaContext = createContext<EscolhaRapidaContextType>({
  abrir: () => {},
  abrirLista: () => {},
});

export const useEscolhaRapida = () => useContext(EscolhaRapidaContext);
