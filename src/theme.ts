export const colors = {
  bg: '#0B0F14',
  surface: '#141A22',
  surfaceAlt: '#1C2430',
  border: '#263040',
  text: '#E8EDF3',
  textDim: '#8B98A9',
  textFaint: '#5D6979',
  accent: '#2ECC71',
  accentDim: '#1E8C4E',
  win: '#2ECC71',
  loss: '#FF5A5F',
  push: '#F5B942',
  pending: '#4DA3FF',
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export function profitColor(n: number): string {
  if (n > 0.004) return colors.win;
  if (n < -0.004) return colors.loss;
  return colors.textDim;
}

export const statusColor = {
  pending: colors.pending,
  won: colors.win,
  lost: colors.loss,
  push: colors.push,
} as const;
