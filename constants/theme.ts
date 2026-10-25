/**
 * Paleta oficial do app (rebrand). Todo componente novo deve importar as
 * cores daqui em vez de usar hex direto no StyleSheet — assim, se a gente
 * quiser ajustar o tom de algo, muda em um lugar só.
 */

import { Platform } from 'react-native';

export const Colors = {
  // Fundos
  background: '#0B0B0F', // Graphite — fundo geral das telas
  surface: '#1C1D25',    // Cards, modais, caixas de conteúdo
  surface2: '#262731',   // Barra de navegação, botões secundários
  surface3: '#2A2B34',   // Bordas, divisores, trilhos (ex: barra de progresso)

  // Acento
  lime: '#D4FF3A',       // Ação principal (CTA, destaques, ativo)
  lavender: '#B8A6FF',   // Acento secundário

  // Texto
  text: '#F4F5F7',       // Texto primário
  muted: '#8A8D98',      // Texto secundário / inativo

  // Semânticas (mantidas por função, não fazem parte do rebrand)
  success: '#00E676',    // Entradas / valores positivos
  danger: '#FF3B5C',     // Saídas / alertas / variante "perigo"

  border: '#2A2B34',
} as const;

// Mantido por compatibilidade com telas que ainda usam light/dark do template Expo
export const ColorsLegacy = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: Colors.text,
    background: Colors.background,
    tint: Colors.lime,
    icon: Colors.muted,
    tabIconDefault: Colors.muted,
    tabIconSelected: Colors.lime,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
