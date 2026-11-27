/**
 * Team color themes. Each team's two official colors (from ESPN) are turned
 * into a full, readable app palette: a dark background tinted with the
 * team's darker color, a bright accent from its most vivid color, and a
 * secondary highlight from the other. Money, wins and losses keep fixed
 * colors (green / red) so results read the same for every team.
 *
 * Colors only: no team logos (those are trademarked).
 */

export type League = 'NFL' | 'NBA' | 'MLB' | 'NHL';
export const LEAGUES: League[] = ['NFL', 'NBA', 'MLB', 'NHL'];

export interface TeamColors {
  /** Saved choice: "SEA" for NFL (kept from before), "NBA:BOS" for other leagues. */
  id: string;
  abbr: string; // "SEA"
  name: string; // "Seattle Seahawks"
  league: League;
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
].map(([id, name, primary, alternate]) => ({ id, abbr: id, name, league: 'NFL' as const, primary, alternate }));

function teamList(league: League, rows: string[][]): TeamColors[] {
  return rows.map(([abbr, name, primary, alternate]) => ({
    id: `${league}:${abbr}`,
    abbr,
    name,
    league,
    primary,
    alternate,
  }));
}

// Official colors from ESPN.
export const NBA_TEAMS: TeamColors[] = teamList('NBA', [
  ['ATL', 'Atlanta Hawks', 'c8102e', 'fdb927'],
  ['BOS', 'Boston Celtics', '008348', 'ffffff'],
  ['BKN', 'Brooklyn Nets', '000000', 'ffffff'],
  ['CHA', 'Charlotte Hornets', '008ca8', '1d1060'],
  ['CHI', 'Chicago Bulls', 'ce1141', '000000'],
  ['CLE', 'Cleveland Cavaliers', '860038', 'bc945c'],
  ['DAL', 'Dallas Mavericks', '0064b1', 'bbc4ca'],
  ['DEN', 'Denver Nuggets', '0e2240', 'fec524'],
  ['DET', 'Detroit Pistons', '1d428a', 'c8102e'],
  ['GS', 'Golden State Warriors', 'fdb927', '1d428a'],
  ['HOU', 'Houston Rockets', 'ce0e2d', '000000'],
  ['IND', 'Indiana Pacers', '0c2340', 'ffd520'],
  ['LAC', 'LA Clippers', '12173f', 'c8102e'],
  ['LAL', 'Los Angeles Lakers', '552583', 'fdb927'],
  ['MEM', 'Memphis Grizzlies', '5d76a9', '12173f'],
  ['MIA', 'Miami Heat', '98002e', '000000'],
  ['MIL', 'Milwaukee Bucks', '00471b', 'eee1c6'],
  ['MIN', 'Minnesota Timberwolves', '266092', '79bc43'],
  ['NO', 'New Orleans Pelicans', '0a2240', 'b4975a'],
  ['NY', 'New York Knicks', '1d428a', 'f58426'],
  ['OKC', 'Oklahoma City Thunder', '007ac1', 'ef3b24'],
  ['ORL', 'Orlando Magic', '0150b5', '9ca0a3'],
  ['PHI', 'Philadelphia 76ers', '1d428a', 'e01234'],
  ['PHX', 'Phoenix Suns', '29127a', 'e56020'],
  ['POR', 'Portland Trail Blazers', 'e03a3e', '000000'],
  ['SAC', 'Sacramento Kings', '5a2d81', '6a7a82'],
  ['SA', 'San Antonio Spurs', '000000', 'c4ced4'],
  ['TOR', 'Toronto Raptors', 'd91244', '000000'],
  ['UTAH', 'Utah Jazz', '4e008e', '79a3dc'],
  ['WSH', 'Washington Wizards', 'e31837', '002b5c'],
]);

export const MLB_TEAMS: TeamColors[] = teamList('MLB', [
  ['ARI', 'Arizona Diamondbacks', 'aa182c', '000000'],
  ['ATH', 'Athletics', '003831', 'efb21e'],
  ['ATL', 'Atlanta Braves', '0c2340', 'ba0c2f'],
  ['BAL', 'Baltimore Orioles', 'df4601', '000000'],
  ['BOS', 'Boston Red Sox', '0d2b56', 'bd3039'],
  ['CHC', 'Chicago Cubs', '0e3386', 'cc3433'],
  ['CHW', 'Chicago White Sox', '000000', 'c4ced4'],
  ['CIN', 'Cincinnati Reds', 'c6011f', 'ffffff'],
  ['CLE', 'Cleveland Guardians', '002b5c', 'e31937'],
  ['COL', 'Colorado Rockies', '33006f', '000000'],
  ['DET', 'Detroit Tigers', '0a2240', 'ff4713'],
  ['HOU', 'Houston Astros', '002d62', 'eb6e1f'],
  ['KC', 'Kansas City Royals', '004687', '7ab2dd'],
  ['LAA', 'Los Angeles Angels', 'ba0021', 'c4ced4'],
  ['LAD', 'Los Angeles Dodgers', '005a9c', 'ffffff'],
  ['MIA', 'Miami Marlins', '00a3e0', '000000'],
  ['MIL', 'Milwaukee Brewers', '13294b', 'ffc72c'],
  ['MIN', 'Minnesota Twins', '031f40', 'e20e32'],
  ['NYM', 'New York Mets', '002d72', 'ff5910'],
  ['NYY', 'New York Yankees', '132448', 'c4ced4'],
  ['PHI', 'Philadelphia Phillies', 'e81828', '003278'],
  ['PIT', 'Pittsburgh Pirates', '000000', 'fdb827'],
  ['SD', 'San Diego Padres', '2f241d', 'ffc425'],
  ['SF', 'San Francisco Giants', '000000', 'fd5a1e'],
  ['SEA', 'Seattle Mariners', '005c5c', '0c2c56'],
  ['STL', 'St. Louis Cardinals', 'be0a14', '001541'],
  ['TB', 'Tampa Bay Rays', '092c5c', '8fbce6'],
  ['TEX', 'Texas Rangers', '003278', 'c0111f'],
  ['TOR', 'Toronto Blue Jays', '134a8e', '6cace5'],
  ['WSH', 'Washington Nationals', 'ab0003', '11225b'],
]);

export const NHL_TEAMS: TeamColors[] = teamList('NHL', [
  ['ANA', 'Anaheim Ducks', 'fc4c02', '000000'],
  ['BOS', 'Boston Bruins', '231f20', 'fdb71a'],
  ['BUF', 'Buffalo Sabres', '00468b', 'fdb71a'],
  ['CGY', 'Calgary Flames', 'dd1a32', '000000'],
  ['CAR', 'Carolina Hurricanes', 'e30426', '000000'],
  ['CHI', 'Chicago Blackhawks', 'e31937', '000000'],
  ['COL', 'Colorado Avalanche', '860038', '005ea3'],
  ['CBJ', 'Columbus Blue Jackets', '002d62', 'e31937'],
  ['DAL', 'Dallas Stars', '20864c', '000000'],
  ['DET', 'Detroit Red Wings', 'e30526', 'ffffff'],
  ['EDM', 'Edmonton Oilers', '00205b', 'ff4c00'],
  ['FLA', 'Florida Panthers', 'e51937', '002d62'],
  ['LA', 'Los Angeles Kings', '121212', 'a2aaad'],
  ['MIN', 'Minnesota Wild', '124734', 'ae122a'],
  ['MTL', 'Montreal Canadiens', 'c41230', '013a81'],
  ['NSH', 'Nashville Predators', 'fdba31', '002d62'],
  ['NJ', 'New Jersey Devils', 'e30b2b', '000000'],
  ['NYI', 'New York Islanders', '00529b', 'f47d31'],
  ['NYR', 'New York Rangers', '0056ae', 'e51937'],
  ['OTT', 'Ottawa Senators', 'dd1a32', 'b79257'],
  ['PHI', 'Philadelphia Flyers', 'fe5823', '000000'],
  ['PIT', 'Pittsburgh Penguins', '000000', 'fdb71a'],
  ['SJ', 'San Jose Sharks', '00788a', '070707'],
  ['SEA', 'Seattle Kraken', '000d33', 'a3dce4'],
  ['STL', 'St. Louis Blues', '0070b9', 'fdb71a'],
  ['TB', 'Tampa Bay Lightning', '003e7e', 'ffffff'],
  ['TOR', 'Toronto Maple Leafs', '003e7e', 'ffffff'],
  ['UTAH', 'Utah Mammoth', '000000', '7ab2e1'],
  ['VAN', 'Vancouver Canucks', '003e7e', '008752'],
  ['VGK', 'Vegas Golden Knights', '344043', 'b4975a'],
  ['WSH', 'Washington Capitals', 'd71830', '0b1f41'],
  ['WPG', 'Winnipeg Jets', '002d62', 'c41230'],
]);

export const TEAMS_BY_LEAGUE: Record<League, TeamColors[]> = {
  NFL: NFL_TEAMS,
  NBA: NBA_TEAMS,
  MLB: MLB_TEAMS,
  NHL: NHL_TEAMS,
};
const ALL_TEAMS = LEAGUES.flatMap((l) => TEAMS_BY_LEAGUE[l]);

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
  return id ? ALL_TEAMS.find((t) => t.id === id) : undefined;
}
