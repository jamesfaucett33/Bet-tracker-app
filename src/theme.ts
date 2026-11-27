import { findTeam, teamPalette } from './teamThemes';

// BetKeeper palette: bright and fun. Deep navy with neon lime green and sky blue.
export const colors = {
  bg: '#061733', // deep navy
  surface: '#0D2650', // card blue
  surfaceAlt: '#173566',
  border: '#2F64A8', // bright blue outlines
  text: '#F4F8FF',
  textDim: '#A9BCD9',
  textFaint: '#7189AE',
  accent: '#7BEA2B', // neon lime, Color Rush style (brand, buttons, "to win")
  accentDim: '#4E9E14',
  brand: '#7BEA2B', // neon lime
  sky: '#3CC4FF', // sky blue highlights
  win: '#7BEA2B',
  money: '#7BEA2B', // "to win" amounts and winnings (always reads as money)
  loss: '#FF5468',
  push: '#B794FF', // a push is neutral: purple, never confused with anything else
  pending: '#3CC4FF', // open tickets: sky blue
  /** A leg in play (orange dots). */
  toPlay: '#FF9F1C',
};

// ---------- team colors ----------
// The palette is chosen once at startup: the BetKeeper default, or the team
// picked in Settings. Changing it saves the choice and reloads the app.

const TEAM_KEY = 'betkeeper:team';

function savedTeam(): string | null {
  try {
    return globalThis.localStorage?.getItem(TEAM_KEY) ?? null;
  } catch {
    return null;
  }
}

export const activeTeamId: string | null = (() => {
  const team = findTeam(savedTeam());
  if (team) Object.assign(colors, teamPalette(team));
  return team?.id ?? null;
})();

/** Switch to a team's colors (or null for the BetKeeper default) and reload. */
export function setTeamTheme(id: string | null) {
  try {
    if (id) globalThis.localStorage?.setItem(TEAM_KEY, id);
    else globalThis.localStorage?.removeItem(TEAM_KEY);
  } catch {
    // storage blocked: nothing to save
  }
  const loc = (globalThis as { location?: Location }).location;
  if (loc) loc.replace(`${loc.pathname}?v=${Date.now()}`);
}

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
