/**
 * Team color themes. Each team's two official colors (from ESPN) are turned
 * into a full, readable app palette: a dark background tinted with the
 * team's darker color, a bright accent from its most vivid color, and a
 * secondary highlight from the other. Money, wins and losses keep fixed
 * colors (green / red) so results read the same for every team.
 *
 * Colors only: no team logos (those are trademarked).
 */

export interface TeamColors {
  id: string; // "SEA"
  name: string; // "Seattle Seahawks"
  league: 'NFL';
  primary: string; // hex without '#'
  alternate: string;
}

export const NFL_TEAMS: TeamColors[] = [
  ['ARI', 'Arizona Cardinals', 'a40227', 'ffffff'],
  ['ATL', 'Atlanta Falcons', 'a71930', '000000'],
  ['BAL', 'Baltimore Ravens', '29126f', '000000'],
  ['BUF', 'Buffalo Bills', '00338d', 'd50a0a'],
  ['CAR', 'Carolina Panthers', '0085ca', '000000'],
  ['CHI', 'Chicago Bears', '0b1c3a', 'e64100'],
  ['CIN', 'Cincinnati Bengals', 'fb4f14', '000000'],
  ['CLE', 'Cleveland Browns', '472a08', 'ff3c00'],
  ['DAL', 'Dallas Cowboys', '002a5c', 'b0b7bc'],
  ['DEN', 'Denver Broncos', '0a2343', 'fc4c02'],
  ['DET', 'Detroit Lions', '0076b6', 'bbbbbb'],
  ['GB', 'Green Bay Packers', '204e32', 'ffb612'],
  ['HOU', 'Houston Texans', '021018', 'eb0028'],
  ['IND', 'Indianapolis Colts', '003b75', 'ffffff'],
  ['JAX', 'Jacksonville Jaguars', '007487', 'd7a22a'],
  ['KC', 'Kansas City Chiefs', 'e31837', 'ffb612'],
  ['LV', 'Las Vegas Raiders', '000000', 'a5acaf'],
  ['LAC', 'Los Angeles Chargers', '0080c6', 'ffc20e'],
  ['LAR', 'Los Angeles Rams', '003594', 'ffd100'],
  ['MIA', 'Miami Dolphins', '008e97', 'fc4c02'],
  ['MIN', 'Minnesota Vikings', '4f2683', 'ffc62f'],
  ['NE', 'New England Patriots', '002a5c', 'c60c30'],
  ['NO', 'New Orleans Saints', 'd3bc8d', '000000'],
  ['NYG', 'New York Giants', '003c7f', 'c9243f'],
  ['NYJ', 'New York Jets', '115740', 'ffffff'],
  ['PHI', 'Philadelphia Eagles', '06424d', 'a5acaf'],
  ['PIT', 'Pittsburgh Steelers', '000000', 'ffb612'],
  ['SF', 'San Francisco 49ers', 'aa0000', 'b3995d'],
  ['SEA', 'Seattle Seahawks', '002a5c', '69be28'],
  ['TB', 'Tampa Bay Buccaneers', 'bd1c36', '3e3a35'],
  ['TEN', 'Tennessee Titans', '4495d2', '001532'],
  ['WSH', 'Washington Commanders', '5a1414', 'ffb612'],
].map(([id, name, primary, alternate]) => ({ id, name, league: 'NFL' as const, primary, alternate }));

// ---------- color math ----------

interface HSL {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

function hexToHsl(hex: string): HSL {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }: HSL): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`.toUpperCase();
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Black, white and grays carry no hue. */
const isNeutral = (c: HSL) => c.s < 0.15 || c.l < 0.05 || c.l > 0.94;

/** Lighten (keeping hue) until the color stands out on the background. */
function readableOn(c: HSL, bg: string, min: number, lo = 0.5, hi = 0.72): string {
  let l = clamp(c.l, lo, hi);
  let hex = hslToHex({ ...c, l });
  while (contrast(hex, bg) < min && l < 0.9) {
    l += 0.03;
    hex = hslToHex({ ...c, l });
  }
  return hex;
}

/** A full palette for a team, in the same shape as the app's colors. */
export function teamPalette(t: TeamColors) {
  const p = hexToHsl(t.primary);
  const a = hexToHsl(t.alternate);
  const hued = [p, a].filter((c) => !isNeutral(c));

  // Background family: the team's darker hued color (or a neutral charcoal).
  const base = [...hued].sort((x, y) => x.l - y.l)[0];
  const tone = (l: number, sMax = 0.65) =>
    base ? hslToHex({ h: base.h, s: clamp(base.s, 0.3, sMax), l }) : hslToHex({ h: 220, s: 0.08, l });
  const bg = tone(0.085);

  // Accent: the most vivid team color, made bright enough to read on the background.
  const vivid = (c: HSL) => c.s * (1 - Math.abs(c.l - 0.5) * 1.4);
  const accentSrc = [...hued].sort((x, y) => vivid(y) - vivid(x))[0];
  const accent = accentSrc
    ? readableOn(accentSrc, bg, 4.5)
    : '#C9CED6'; // both colors neutral (e.g. black and silver)

  // Secondary highlight: the other team color, lighter; or a light tint of the accent.
  const other = [p, a].find((c) => c !== accentSrc);
  const second =
    other && !isNeutral(other)
      ? readableOn(other, bg, 4.5, 0.6, 0.78)
      : other && other.l > 0.6
        ? '#E6EAF0' // white / silver team color
        : accentSrc
          ? hslToHex({ ...accentSrc, s: clamp(accentSrc.s, 0.4, 0.8), l: 0.8 })
          : '#E6EAF0';

  const textTint = base ? { h: base.h, s: 0.2 } : { h: 220, s: 0.08 };
  return {
    bg,
    surface: tone(0.15, 0.6),
    surfaceAlt: tone(0.21, 0.55),
    border: tone(0.33, 0.5),
    text: '#F5F7FA',
    textDim: hslToHex({ ...textTint, l: 0.76 }),
    textFaint: hslToHex({ ...textTint, l: 0.56 }),
    accent,
    accentDim: hslToHex({ ...hexToHsl(accent), l: clamp(hexToHsl(accent).l - 0.2, 0.2, 0.6) }),
    brand: accent,
    sky: second,
    pending: second,
    // Results read the same for every team.
    win: '#3DDC84',
    money: '#3DDC84',
    loss: '#FF5468',
    push: '#B794FF',
    toPlay: '#FF9F1C',
  };
}

export function findTeam(id: string | null | undefined): TeamColors | undefined {
  return id ? NFL_TEAMS.find((t) => t.id === id) : undefined;
}
