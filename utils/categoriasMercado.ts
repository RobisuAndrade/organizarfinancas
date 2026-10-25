// utils/categoriasMercado.ts

export const CATEGORIAS_MERCADO = [
  { nome: 'Carnes', emoji: '🥩', cor: '#FF3366' },
  { nome: 'Frutas e Verduras', emoji: '🥬', cor: '#00E676' },
  { nome: 'Mercearia', emoji: '🍚', cor: '#FFD700' },
  { nome: 'Frios e Laticínios', emoji: '🧀', cor: '#FFB84D' },
  { nome: 'Padaria', emoji: '🍞', cor: '#D2A679' },
  { nome: 'Bebidas', emoji: '🥤', cor: '#3b82f6' },
  { nome: 'Doces e Snacks', emoji: '🍫', cor: '#ec4899' },
  { nome: 'Congelados', emoji: '🧊', cor: '#5CE1E6' },
  { nome: 'Limpeza', emoji: '🧼', cor: '#32BCAD' },
  { nome: 'Higiene', emoji: '🧴', cor: '#B04FCF' },
  { nome: 'Pet', emoji: '🐾', cor: '#FF7A00' },
  { nome: 'Outros', emoji: '📦', cor: '#888888' },
];

export const infoCategoria = (nome: string) =>
  CATEGORIAS_MERCADO.find(c => c.nome === nome) || CATEGORIAS_MERCADO[CATEGORIAS_MERCADO.length - 1];

// Tira acentos, deixa maiúsculo e remove símbolos
export const normalizar = (texto: string) =>
  (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Chave segura para usar no Firebase (sem . # $ [ ] /)
export const chaveProduto = (nome: string) => normalizar(nome).replace(/ /g, '_') || 'SEM_NOME';

// A ORDEM IMPORTA: regras mais específicas vêm primeiro
// Prefixo "=" significa palavra exata. Com espaço = frase. Sem nada = começa com.
const REGRAS: { categoria: string; palavras: string[] }[] = [
  { categoria: 'Limpeza', palavras: ['SABAO', 'DETERGENTE', 'AMACIANTE', 'DESINFETANTE', 'AGUA SANITARIA', 'CLORO', 'ESPONJA', 'MULTIUSO', 'ALVEJANTE', 'SACO DE LIXO', 'SACO LIXO', 'VASSOURA', 'PAPEL ALUMINIO', 'FILME PVC', 'GUARDANAPO', 'PAPEL TOALHA', 'INSETICIDA', 'LIMPA', 'VEJA', '=OMO', 'LUSTRA'] },
  { categoria: 'Higiene', palavras: ['SABONETE', 'SHAMPOO', 'CONDICIONADOR', 'CREME DENTAL', 'PASTA DE DENTE', 'ESCOVA DENTAL', 'DESODORANTE', 'PAPEL HIGIENICO', 'ABSORVENTE', 'FIO DENTAL', 'ENXAGUANTE', 'COTONETE', 'ALGODAO', 'HIDRATANTE', 'PROTETOR SOLAR', 'BARBEADOR', 'FRALDA', 'LENCO UMEDECIDO'] },
  { categoria: 'Pet', palavras: ['RACAO', '=PET', 'AREIA HIGIENICA', 'AREIA SANITARIA', 'SACHE GATO', 'SACHE CAO'] },
  { categoria: 'Bebidas', palavras: ['REFRIG', 'REFRI', '=COCA', 'GUARANA', 'FANTA', 'SPRITE', 'SUCO', 'AGUA', 'CERVEJA', 'VINHO', 'VODKA', 'WHISKY', 'ENERGETICO', '=CHA', 'ISOTONICO', 'REFRESCO', 'TONICA'] },
  { categoria: 'Congelados', palavras: ['SORVETE', 'PAO DE QUEIJO', 'LASANHA', 'PIZZA', 'HAMBURGUER', 'NUGGETS', 'EMPANADO', 'CONGELAD', 'BATATA PALITO', 'POLPA', 'GELO'] },
  { categoria: 'Mercearia', palavras: ['ARROZ', 'FEIJAO', 'MACARRAO', 'ESPAGUETE', 'MASSA', 'FARINHA', 'FUBA', 'ACUCAR', '=SAL', 'OLEO', 'AZEITE', 'VINAGRE', 'CAFE', 'MOLHO', 'EXTRATO', 'MAIONESE', 'KETCHUP', 'CATCHUP', 'MOSTARDA', 'TEMPERO', 'CALDO', 'LENTILHA', 'GRAO DE BICO', 'ERVILHA', 'MILHO', 'AVEIA', 'GRANOLA', 'CEREAL', 'ACHOCOLATADO', 'SARDINHA', 'ATUM', 'FERMENTO', 'POLVILHO', 'TAPIOCA', 'LEITE DE COCO', 'LEITE EM PO', 'MISTURA', 'PALMITO', 'AZEITONA', 'COLORAU', 'PIMENTA'] },
  { categoria: 'Doces e Snacks', palavras: ['CHOCOLATE', 'BISCOITO', 'BOLACHA', 'BALA', 'CHICLETE', 'SALGADINHO', 'CHIPS', 'PIRULITO', 'WAFER', 'DOCE', 'GELEIA', 'PACOCA', 'AMENDOIM', 'BOMBOM', 'PIPOCA', 'GOIABADA', 'TORTINHA'] },
  { categoria: 'Padaria', palavras: ['PAO', 'BOLO', 'BISNAGUINHA', 'TORRADA', 'BAGUETE', 'ROSCA', 'CROISSANT'] },
  { categoria: 'Frios e Laticínios', palavras: ['LEITE', 'QUEIJO', 'MUSSARELA', 'MUCARELA', 'REQUEIJAO', 'IOGURTE', 'MANTEIGA', 'MARGARINA', 'CREME DE LEITE', 'PRESUNTO', 'APRESUNTADO', 'MORTADELA', 'SALAME', 'PEITO DE PERU', 'OVO', 'COALHADA', 'NATA', 'RICOTA', 'PARMESAO'] },
  { categoria: 'Carnes', palavras: ['CARNE', 'BIFE', 'LAGARTO', 'ACEM', 'PATINHO', 'ALCATRA', 'PICANHA', 'MAMINHA', 'COXAO', 'FRALDINHA', 'COSTELA', 'CONTRA FILE', 'FILE', 'FRANGO', 'FGO', 'PEITO', 'COXA', 'SOBRECOXA', '=ASA', '=ASAS', 'LINGUICA', 'SALSICHA', 'BACON', 'PORCO', 'LOMBO', 'PERNIL', 'BISTECA', 'MOIDA', 'PEIXE', 'TILAPIA', 'SALMAO', 'CAMARAO', 'BACALHAU', 'FIGADO', 'CUPIM', 'COSTELINHA', 'PATO'] },
  { categoria: 'Frutas e Verduras', palavras: ['TOMATE', 'CEBOLA', 'ALHO', 'BATATA', 'CENOURA', 'ALFACE', 'COUVE', 'REPOLHO', 'BROCOLIS', 'ABOBRINHA', 'ABOBORA', 'PEPINO', 'PIMENTAO', 'BETERRABA', 'CHUCHU', 'MANDIOCA', 'MACAXEIRA', 'INHAME', 'BANANA', '=MACA', '=MACAS', 'LARANJA', 'LIMAO', 'MAMAO', 'MELAO', 'MELANCIA', 'UVA', 'MORANGO', 'ABACAXI', 'ABACATE', 'MANGA', '=PERA', '=PERAS', 'GOIABA', 'KIWI', 'COENTRO', '=SALSA', 'CEBOLINHA', 'HORTELA', 'MANJERICAO', 'RUCULA', 'AGRIAO', 'ESPINAFRE', 'VAGEM', 'QUIABO', 'BERINJELA', 'GENGIBRE', 'COCO', 'LEGUME', 'VERDURA', 'FRUTA', 'HORTIFRUTI'] },
];

const bate = (texto: string, tokens: string[], k: string) => {
  if (k.startsWith('=')) return tokens.includes(k.slice(1));
  if (k.includes(' ')) return texto.includes(k);
  return tokens.some(t => t.startsWith(k));
};

export const categorizarProduto = (nome: string, aprendidas: Record<string, string> = {}) => {
  // 1) O que você já ensinou ao app tem prioridade
  const aprendida = aprendidas[chaveProduto(nome)];
  if (aprendida) return aprendida;

  // 2) Palavras-chave
  const texto = normalizar(nome);
  const tokens = texto.split(' ');
  for (const regra of REGRAS) {
    if (regra.palavras.some(k => bate(texto, tokens, k))) return regra.categoria;
  }
  return 'Outros';
};