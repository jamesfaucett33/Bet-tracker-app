// Seahawks palette: College Navy, Action Green, Wolf Gray.
export const colors = {
  bg: '#001229',
  surface: '#002244', // College Navy
  surfaceAlt: '#0D3157',
  border: '#1D4470',
  text: '#F2F5F8',
  textDim: '#A5ACAF', // Wolf Gray
  textFaint: '#6E7F94',
  accent: '#69BE28', // Action Green
  accentDim: '#3F7A14',
  win: '#69BE28',
  loss: '#FF5A5F',
  push: '#F5B942',
  pending: '#4FB3FF',
  /** A leg still to play / in play (orange dots). */
  toPlay: '#FF9F1C',
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
