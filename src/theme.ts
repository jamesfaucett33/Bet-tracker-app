// BetKeeper palette: Vegas black and gold, with casino-felt green for hits
// and chip red for misses.
export const colors = {
  bg: '#0B0B0D', // onyx
  surface: '#17171B', // charcoal cards
  surfaceAlt: '#24242A',
  border: '#33323A',
  text: '#F5F2EA',
  textDim: '#B8B1A2',
  textFaint: '#7C766A',
  accent: '#D4AF37', // Vegas gold (brand, buttons, "to win")
  accentDim: '#8C7424',
  gold: '#D4AF37',
  goldLight: '#F2C14E',
  champagne: '#E9D8A6',
  win: '#2EBD6B', // felt green
  loss: '#E5484D', // chip red
  push: '#8AB4F8', // a push is neutral: cool blue, never confused with gold
  pending: '#E9D8A6', // open tickets: champagne
  /** A leg in play (orange dots). */
  toPlay: '#FF7A1A',
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
