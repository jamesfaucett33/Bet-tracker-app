import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { betChance, legChance } from './chance';
import { betGame, betMarkets, legGame } from './markets';
import { americanToDecimal, decimalToAmerican, isValidAmerican } from './odds';
import { useStore } from './store';
import { Bet, GameRef, LegResult, Market, PlayerStat } from './types';

/**
 * Live game tracking from ESPN's public scoreboard/summary feeds (no key,
 * CORS-enabled). Pending bets are matched to a game, then polled while the
 * app is open so each leg can show a progress bar.
 *
 * ESPN's feed is unofficial: fine for personal use, but a version sold to
 * others should switch to a licensed stats provider (SportsDataIO,
 * Sportradar) behind the same LiveGame shape.
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
const LEAGUE_PATHS: Record<string, string> = {
  NFL: 'football/nfl',
  NCAAF: 'football/college-football',
  NBA: 'basketball/nba',
  WNBA: 'basketball/wnba',
  NCAAB: 'basketball/mens-college-basketball',
  MLB: 'baseball/mlb',
  NHL: 'hockey/nhl',
};
const POLL_LIVE_MS = 30_000;
const POLL_IDLE_MS = 5 * 60_000;

export interface TeamScore {
  name: string; // "Green Bay Packers"
  short: string; // "Packers"
  abbr: string; // "GB"
  score: number;
  logo?: string;
  color?: string; // team color, "#204e32"
  hasBall?: boolean;
}

export interface Play {
  text: string;
  clock: string;
  period: number;
  team?: string; // abbreviation of the team with the ball
  scoring?: boolean;
}

export interface LiveGame {
  eventId: string;
  state: 'pre' | 'in' | 'post';
  detail: string; // "5:29 - 2nd", "Final", "Thu 5:15 PM"
  home: TeamScore;
  away: TeamScore;
  /** normalized player name -> stat group -> label -> value */
  players: Map<string, Record<string, Record<string, string>>>;
  /** Display names as ESPN writes them, keyed like `players`. */
  playerNames: Map<string, string>;
  league: string;
  period: number;
  /** Seconds left in the current period. */
  clockSecs: number;
  /** Home team's live win probability (0-1), when ESPN provides it. */
  homeWinPct: number | null;
  /** Sportsbook line before the game (ESPN's pick center): home spread, e.g. -3 = home favored by 3. */
  homeSpread: number | null;
  /** Sportsbook over/under before the game. */
  marketTotal: number | null;
  /** Scheduled start, ms since epoch. */
  startTime?: number;
  /** "3rd & 6 at GB 40" */
  downDistance?: string;
  /** Most recent plays, newest first. */
  plays: Play[];
  scoringPlays: Play[];
  updatedAt: number;
}

export type LegState = 'pre' | 'live' | 'hit' | 'miss' | 'push' | 'unknown';

export interface LegProgress {
  current: number | null; // the stat so far (or score margin for team bets)
  target: number | null;
  state: LegState;
  text: string; // "136 / 250", "Up 3", "Final: won by 7"
}

// ---------- matching helpers ----------

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function teamMatches(team: TeamScore, name: string): boolean {
  const n = norm(name);
  if (!n) return false;
  // Abbreviations must be a whole word ("Minnesota Vikings" contains "ne" but
  // isn't NE). Names can be shortened from the start of a word ("Ohio St").
  const words = (x: string) => ` ${x} `;
  const startsWord = (hay: string, needle: string) => ` ${hay}`.includes(` ${needle}`);
  const abbr = norm(team.abbr);
  if (abbr && (abbr === n || words(n).includes(words(abbr)))) return true;
  return [team.name, team.short]
    .map(norm)
    .filter(Boolean)
    .some(
      (c) =>
        c === n ||
        words(n).includes(words(c)) ||
        words(c).includes(words(n)) ||
        (n.length >= 4 && startsWord(c, n)) ||
        (c.length >= 4 && startsWord(n, c)),
    );
}

export function findTeam(
  game: LiveGame,
  name: string,
): { team: TeamScore; other: TeamScore } | null {
  if (teamMatches(game.home, name)) return { team: game.home, other: game.away };
  if (teamMatches(game.away, name)) return { team: game.away, other: game.home };
  return null;
}

// ---------- ESPN fetchers ----------

function toTeam(c: any): TeamScore {
  const logo = c.team?.logos?.[0]?.href ?? c.team?.logo;
  return {
    name: c.team?.displayName ?? '',
    short: c.team?.shortDisplayName ?? c.team?.name ?? '',
    abbr: c.team?.abbreviation ?? '',
    score: Number(c.score ?? 0) || 0,
    logo: logo || undefined,
    color: c.team?.color ? `#${c.team.color}` : undefined,
    hasBall: c.possession === true,
  };
}

function toPlay(p: any, scoring = false): Play {
  return {
    text: String(p.text ?? p.shortText ?? '').trim(),
    clock: p.clock?.displayValue ?? '',
    period: Number(p.period?.number ?? 0),
    team: p.team?.abbreviation,
    scoring: scoring || !!p.scoringPlay,
  };
}

function clockToSecs(display: string | undefined): number {
  const m = /^(\d+):(\d{2})/.exec(display ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

function ymd(iso: string, addDays: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + addDays);
  return `${dt.getFullYear()}${`${dt.getMonth() + 1}`.padStart(2, '0')}${`${dt.getDate()}`.padStart(2, '0')}`;
}

async function getJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Finds the ESPN event id for a game, looking on the bet date and the next two days. */
const scoreboards = new Map<string, { at: number; data: any }>();

async function scoreboard(path: string, date: string): Promise<any> {
  // College scoreboards only list ranked teams unless asked for every game.
  const all = path.includes('college-football')
    ? '&groups=80&limit=300'
    : path.includes('college-basketball')
      ? '&groups=50&limit=400'
      : '';
  const url = `${ESPN}/${path}/scoreboard?dates=${date}${all}`;
  const hit = scoreboards.get(url);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.data;
  const data = await getJSON(url);
  scoreboards.set(url, { at: Date.now(), data });
  return data;
}

/**
 * Finds the ESPN event for a game from the bet date through the following
 * week (parlays often span several days). Both teams must match when both are
 * known; with only one team, its next game is used.
 */
export async function findEventId(game: GameRef, betDate: string): Promise<string | null> {
  const path = LEAGUE_PATHS[game.league.toUpperCase()];
  if (!path || (!game.away && !game.home)) return null;
  for (const offset of [0, 1, 2, 3, 4, 5, 6, -1]) {
    const data = await scoreboard(path, ymd(betDate, offset));
    for (const ev of data.events ?? []) {
      const teams = (ev.competitions?.[0]?.competitors ?? []).map(toTeam);
      const ok = (name: string) => !name || teams.some((t: TeamScore) => teamMatches(t, name));
      if (ok(game.away) && ok(game.home)) return String(ev.id);
    }
  }
  return null;
}

export async function fetchLiveGame(league: string, eventId: string): Promise<LiveGame> {
  const path = LEAGUE_PATHS[league.toUpperCase()];
  const data = await getJSON(`${ESPN}/${path}/summary?event=${eventId}`);
  const comp = data.header?.competitions?.[0];
  const status = comp?.status?.type ?? {};
  const comps = comp?.competitors ?? [];
  const home = toTeam(comps.find((c: any) => c.homeAway === 'home') ?? {});
  const away = toTeam(comps.find((c: any) => c.homeAway === 'away') ?? {});

  const players: LiveGame['players'] = new Map();
  const playerNames = new Map<string, string>();
  for (const team of data.boxscore?.players ?? []) {
    for (const group of team.statistics ?? []) {
      const groupName = String(group.name ?? 'stats');
      const labels: string[] = group.labels ?? group.names ?? [];
      for (const a of group.athletes ?? []) {
        const key = norm(a.athlete?.displayName ?? '');
        if (!key) continue;
        const entry = players.get(key) ?? {};
        const row: Record<string, string> = {};
        labels.forEach((label, i) => (row[label.toUpperCase()] = String(a.stats?.[i] ?? '')));
        entry[groupName] = row;
        players.set(key, entry);
        playerNames.set(key, a.athlete?.displayName ?? key);
        // Also index by "first-initial last" so "M. Stafford" style names match.
        const parts = key.split(' ');
        if (parts.length > 1) players.set(`${parts[0][0]} ${parts.slice(1).join(' ')}`, entry);
      }
    }
  }

  // Recent plays: football has drives; other sports list plays directly.
  const drivePlays: any[] = data.drives?.current?.plays ?? [];
  const flatPlays: any[] = data.plays ?? [];
  const recent = (drivePlays.length ? drivePlays : flatPlays)
    .filter((p) => p?.text)
    .slice(-8)
    .reverse()
    .map((p) => toPlay(p));
  const lastPlay = drivePlays[drivePlays.length - 1];
  const line = (data.pickcenter ?? []).find((p: any) => Number.isFinite(Number(p?.spread)));
  const ou = (data.pickcenter ?? []).find((p: any) => Number.isFinite(Number(p?.overUnder)));
  const wp: any[] = data.winprobability ?? [];
  const homeWinPct = wp.length ? Number(wp[wp.length - 1].homeWinPercentage) : NaN;

  // Possession isn't always on the header competitors; fall back to the drive.
  const driveTeam = data.drives?.current?.team?.abbreviation;
  if (state(status) === 'in' && !home.hasBall && !away.hasBall && driveTeam) {
    if (driveTeam === home.abbr) home.hasBall = true;
    else if (driveTeam === away.abbr) away.hasBall = true;
  }
  if (state(status) !== 'in') home.hasBall = away.hasBall = false;

  return {
    eventId,
    state: state(status),
    detail: status.shortDetail ?? status.detail ?? '',
    home,
    away,
    players,
    playerNames,
    league: league.toUpperCase(),
    period: Number(comp?.status?.period ?? 0),
    clockSecs: clockToSecs(comp?.status?.displayClock),
    homeWinPct: Number.isFinite(homeWinPct) ? homeWinPct : null,
    startTime: comp?.date ? Date.parse(comp.date) || undefined : undefined,
    homeSpread: line ? Number(line.spread) : null,
    marketTotal: ou ? Number(ou.overUnder) : null,
    downDistance: state(status) === 'in' ? lastPlay?.end?.downDistanceText || undefined : undefined,
    plays: recent,
    scoringPlays: (data.scoringPlays ?? []).map((p: any) => toPlay(p, true)).reverse(),
    updatedAt: Date.now(),
  };
}

/**
 * Game state. Only a completed game is final: ESPN also marks postponed and
 * cancelled games "post", and those must never settle a ticket.
 */
const state = (status: any): LiveGame['state'] => {
  const s = (status?.state as LiveGame['state']) ?? 'pre';
  if (s === 'post' && status?.completed === false) return 'pre';
  return s;
};

// ---------- grading ----------

const num = (v: string | undefined) => {
  if (!v) return 0;
  const first = v.split(/[/-]/)[0]; // "9/14" or "3-7" -> made count
  const n = Number(first);
  return Number.isFinite(n) ? n : 0;
};

function statValue(stats: Record<string, Record<string, string>> | undefined, stat: PlayerStat) {
  if (!stats) return 0;
  const g = (group: string, label: string) => num(stats[group]?.[label]);
  // Basketball box scores use a single group; find it whatever its name.
  const any = (label: string) => {
    for (const row of Object.values(stats)) if (row[label] !== undefined) return num(row[label]);
    return 0;
  };
  // Hockey box scores split skaters into forwards / defense / goalies.
  const hockey = !!(stats.forwards || stats.defenses || stats.skaters || stats.goalies);
  switch (stat) {
    case 'passYds':
      return g('passing', 'YDS');
    case 'rushYds':
      return g('rushing', 'YDS');
    case 'recYds':
      return g('receiving', 'YDS');
    case 'receptions':
      return g('receiving', 'REC');
    case 'passRushYds':
      return g('passing', 'YDS') + g('rushing', 'YDS');
    case 'rushRecYds':
      return g('rushing', 'YDS') + g('receiving', 'YDS');
    case 'passTd':
      return g('passing', 'TD');
    case 'anyTd':
      return g('rushing', 'TD') + g('receiving', 'TD');
    case 'fgMade':
      return g('kicking', 'FG');
    case 'points':
      return hockey ? any('G') + any('A') : any('PTS');
    case 'rebounds':
      return any('REB');
    case 'assists':
      return hockey ? any('A') : any('AST');
    case 'threes':
      return any('3PT');
    case 'pra':
      return any('PTS') + any('REB') + any('AST');
    case 'passCompletions':
      return g('passing', 'C/ATT'); // "13/22" -> 13
    case 'passAttempts':
      return num(stats.passing?.['C/ATT']?.split('/')[1]);
    case 'rushAttempts':
      return g('rushing', 'CAR');
    case 'interceptions':
      return g('passing', 'INT');
    case 'steals':
      return any('STL');
    case 'blocks':
      return any('BLK');
    case 'sacks': {
      // A defender's sacks (half sacks count, e.g. "1.5"); for a quarterback
      // with no defensive line, the sacks he took ("3-23" -> 3).
      const def = stats.defensive?.SACKS;
      return def !== undefined ? Number(def) || 0 : g('passing', 'SACKS');
    }
    case 'tackles':
      return g('defensive', 'TOT');
    case 'soloTackles':
      return g('defensive', 'SOLO');
    case 'kickingPoints':
      return g('kicking', 'PTS');
    case 'ptsReb':
      return any('PTS') + any('REB');
    case 'ptsAst':
      return any('PTS') + any('AST');
    case 'rebAst':
      return any('REB') + any('AST');
    case 'stealsBlocks':
      return any('STL') + any('BLK');
    case 'turnovers':
      return any('TO');
    case 'goals':
      return any('G');
    case 'shotsOnGoal':
      return any('S'); // NHL "S" = shots on goal ("SOG" there means shootout goals)
    case 'saves':
      return g('goalies', 'SV');
    case 'blockedShots':
      return any('BS');
  }
}

/**
 * The box-score key for a player as written on a ticket: full name, "J. Smith",
 * or just a last name ("Gibbs", "St. Brown") when only one player matches.
 */
export function findPlayerKey(game: LiveGame, name: string): string | undefined {
  const k = norm(name);
  if (!k) return undefined;
  if (game.players.has(k) && game.playerNames.has(k)) return k;
  const words = k.split(' ');
  if (words.length > 1) {
    const initial = `${words[0][0]} ${words.slice(1).join(' ')}`;
    if (game.players.has(initial)) {
      const full = [...game.playerNames.keys()].find((key) => game.players.get(key) === game.players.get(initial));
      if (full) return full;
    }
  }
  const names = [...game.playerNames.keys()];
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const tail = words.slice(-n).join(' ');
    const hits = names.filter((key) => key === tail || key.endsWith(` ${tail}`));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) break;
  }
  return undefined;
}

export function gradeMarket(market: Market | undefined, game: LiveGame | undefined): LegProgress {
  if (!market) return { current: null, target: null, state: 'unknown', text: '' };
  if (!game) {
    const target = market.kind === 'player' ? market.line : null;
    return { current: null, target, state: 'pre', text: 'Game not found yet' };
  }
  const final = game.state === 'post';
  const started = game.state !== 'pre';

  if (market.kind === 'player') {
    const key = findPlayerKey(game, market.player);
    if (final && !key) {
      // Not in the final box score: probably didn't play (books void these legs).
      return { current: null, target: market.line, state: 'unknown', text: 'No stats' };
    }
    const stats = key ? game.players.get(key) : undefined;
    const current = started ? statValue(stats, market.stat) : 0;
    const push = final && market.pushAt !== undefined && current === market.pushAt;
    if (market.under) {
      // An under is lost the moment the player passes the line; won at the final.
      const over = current >= market.line;
      return {
        current,
        target: market.line,
        state: over ? 'miss' : push ? 'push' : final ? 'hit' : started ? 'live' : 'pre',
        text: `${current} (under ${market.pushAt ?? market.line - 0.5})`,
      };
    }
    const hit = current >= market.line;
    return {
      current,
      target: market.line,
      state: hit ? 'hit' : push ? 'push' : final ? 'miss' : started ? 'live' : 'pre',
      text: `${current} / ${market.line}`,
    };
  }

  if (market.kind === 'total') {
    let total = game.home.score + game.away.score;
    if (market.team) {
      const side = findTeam(game, market.team);
      if (!side) return { current: null, target: null, state: 'unknown', text: 'Team not found' };
      total = side.team.score;
    }
    const over = total > market.line;
    const under = total < market.line;
    const state: LegState =
      market.side === 'over' && over
        ? 'hit' // can't go back down
        : market.side === 'under' && over
          ? 'miss' // already past the number
          : final
            ? total === market.line
              ? 'push'
              : (market.side === 'over' ? over : under)
                ? 'hit'
                : 'miss'
            : started
              ? 'live'
              : 'pre';
    return {
      current: total,
      target: market.line,
      state,
      text: `${total} pts / ${market.side === 'over' ? 'o' : 'u'}${market.line}`,
    };
  }

  const found = findTeam(game, market.team);
  if (!found) return { current: null, target: null, state: 'unknown', text: 'Team not found' };
  const margin = found.team.score - found.other.score;
  const needed = market.kind === 'spread' ? -market.line : 0; // must win by more than this
  const covering = margin > needed;
  const lead = margin === 0 ? 'Tied' : margin > 0 ? `Up ${margin}` : `Down ${Math.abs(margin)}`;
  // Landing exactly on the number is a push (that leg is voided), not a loss.
  const push = margin === needed;
  return {
    current: margin,
    target: needed,
    state: final ? (push ? 'push' : covering ? 'hit' : 'miss') : started ? 'live' : 'pre',
    text: final ? `Final: ${lead.toLowerCase()}` : started ? lead : 'Not started',
  };
}

/** True when the team in a team market is currently ahead/covering (for bar color). */
export function isCovering(p: LegProgress, market?: Market): boolean {
  if (!market || market.kind === 'player' || market.kind === 'total') return false;
  return p.current !== null && p.target !== null && p.current > p.target;
}

// ---------- auto-settle ----------

export type SettleDecision =
  | { status: 'won' | 'lost' | 'push'; toWin?: number }
  | { review: string }
  | null;

/**
 * Decides a pending ticket from final stats, leg by leg (each leg may be on a
 * different game): a leg that clearly missed in a final game loses the ticket
 * right away; once every leg's game is final and every leg hit, it's won. A
 * missed player prop where the player has no stats at all is left for review
 * (books usually void legs for players who didn't play), as is any leg the app
 * can't grade.
 */
export function autoSettle(bet: Bet, legGames: (LiveGame | undefined)[]): SettleDecision {
  if (bet.status !== 'pending' || !legGames.some(Boolean)) return null;
  const legs = betMarkets(bet);
  let missed = false;
  let allFinal = true;
  let ungradeable = false;
  let noStats: string | null = null;
  const pushed: number[] = [];
  legs.forEach((l, i) => {
    const game = legGames[i];
    if (!l.market) {
      ungradeable = true;
      if (!game || game.state !== 'post') allFinal = false;
      return;
    }
    if (!game) {
      allFinal = false;
      return;
    }
    const p = gradeMarket(l.market, game);
    // A leg can be lost before its game ends (an under passed, for example).
    if (p.state === 'miss' && game.state !== 'post' && !(l.market.kind === 'player' && !l.market.under)) {
      missed = true;
      return;
    }
    if (game.state !== 'post') {
      allFinal = false;
      return;
    }
    const noPlayer = l.market.kind === 'player' && !findPlayerKey(game, l.market.player);
    if (noPlayer) {
      // Player has no line in the box score: probably didn't play (books void those legs).
      noStats = (l.market as { player: string }).player;
    } else if (p.state === 'unknown') ungradeable = true;
    else if (p.state === 'miss') missed = true;
    else if (p.state === 'push') pushed.push(i);
  });
  if (missed) return { status: 'lost' }; // one leg lost: the parlay is dead
  if (!allFinal) return null;
  if (noStats) {
    return {
      review: `Final — ${noStats} has no recorded stats (may not have played, and books usually void that leg). Check your ticket, then mark it.`,
    };
  }
  if (ungradeable)
    return { review: "Final — some legs can't be graded automatically. Mark it Won or Lost." };
  if (pushed.length === legs.length) return { status: 'push' };
  if (pushed.length) {
    // Books drop a pushed leg and pay the rest at the remaining legs' odds.
    const rest = (bet.legs ?? []).filter((_, i) => !pushed.includes(i)).map((l) => l.odds);
    if (bet.legs?.length && rest.every((o) => o !== null && isValidAmerican(o))) {
      const dec = rest.reduce<number>((acc, o) => acc * americanToDecimal(o as number), 1);
      return { status: 'won', toWin: Math.round(bet.stake * (dec - 1) * 100) / 100 };
    }
    return {
      review: `Final — every leg hit except ${pushed.length} that pushed. Books drop a pushed leg and pay the rest at lower odds: mark it Won and enter the paid amount.`,
    };
  }
  return { status: 'won' };
}

/**
 * How each leg finished, for legs whose game is final. Used to keep a record
 * of every leg after the ticket is decided (a busted parlay still shows which
 * legs hit). 'void' = a player with no recorded stats.
 */
export function gradeLegs(
  bet: Bet,
  legGames: (LiveGame | undefined)[],
): (LegResult | undefined)[] {
  return betMarkets(bet).map((l, i) => {
    const game = legGames[i];
    if (!game || game.state !== 'post' || !l.market) return undefined;
    const p = gradeMarket(l.market, game);
    if (l.market.kind === 'player' && !findPlayerKey(game, l.market.player)) return 'void';
    if (p.state === 'hit') return 'hit';
    if (p.state === 'push') return 'push';
    if (p.state !== 'miss') return undefined;
    return 'miss';
  });
}

/** Settled tickets whose legs are still being checked for the record. */
const LEG_CHECK_DAYS = 14;
function needsLegCheck(b: Bet): boolean {
  if (b.status === 'pending' || !b.legs?.length) return false;
  if (b.legs.every((l) => l.result)) return false;
  const age = (Date.now() - new Date(b.date + 'T12:00:00').getTime()) / 86400000;
  return age <= LEG_CHECK_DAYS;
}

// ---------- which game each leg is on ----------

/**
 * The game for every leg of a bet. Single-game tickets share the bet's game;
 * multi-game parlays use each leg's own game (stored from a scan, or read from
 * the leg text, e.g. "Denver Broncos ML at Pittsburgh Steelers").
 */
export function betLegRefs(bet: Bet): (GameRef | undefined)[] {
  const markets = betMarkets(bet);
  const whole = betGame(bet);
  return markets.map((m, i) => {
    const stored = bet.legs?.[i]?.game;
    if (stored) return stored;
    const fromLeg = legGame(m.label, m.market, bet.sport);
    if (fromLeg && fromLeg.away && fromLeg.home) return fromLeg; // leg names its own game
    return whole ?? fromLeg;
  });
}

// ---------- provider ----------

interface LiveCtx {
  /** bet id -> the game to headline (a live one first) */
  games: Map<string, LiveGame>;
  /** bet id -> each leg's game, in leg order */
  legGames: Map<string, (LiveGame | undefined)[]>;
  refreshing: boolean;
  lastError: string | null;
  refresh: () => void;
}

const LiveContext = createContext<LiveCtx>({
  games: new Map(),
  legGames: new Map(),
  refreshing: false,
  lastError: null,
  refresh: () => {},
});

const gameKey = (g: GameRef, date: string) => `${g.league}|${norm(g.away)}|${norm(g.home)}|${date}`;

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { bets, saveBet } = useStore();
  const [games, setGames] = useState<Map<string, LiveGame>>(new Map());
  const [legGamesMap, setLegGames] = useState<Map<string, (LiveGame | undefined)[]>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const eventIds = useRef(new Map<string, string | null>()); // gameKey -> eventId (null = not found)
  const notFoundAt = useRef(new Map<string, number>());
  const betsRef = useRef(bets);
  betsRef.current = bets;

  const tracked = useMemo(
    () =>
      bets.filter(
        (b) =>
          (b.status === 'pending' || needsLegCheck(b)) &&
          betLegRefs(b).some(Boolean) &&
          betMarkets(b).some((m) => m.market),
      ),
    [bets],
  );
  const trackedKey = tracked.map((b) => `${b.id}:${b.updatedAt ?? 0}`).join(',');

  useEffect(() => {
    if (!tracked.length) {
      setGames(new Map());
      setLegGames(new Map());
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      setRefreshing(true);
      const byEvent = new Map<string, LiveGame>();
      const headline = new Map<string, LiveGame>();
      const perLeg = new Map<string, (LiveGame | undefined)[]>();
      let anyLive = false;
      try {
        for (const bet of tracked) {
          const refs = betLegRefs(bet);
          const legGames: (LiveGame | undefined)[] = [];
          const found: (string | null)[] = [];
          for (const ref of refs) {
            if (!ref) {
              legGames.push(undefined);
              found.push(null);
              continue;
            }
            const k = gameKey(ref, bet.date);
            let eventId = ref.eventId ?? eventIds.current.get(k);
            const missedAt = notFoundAt.current.get(k) ?? 0;
            if (eventId === undefined || (eventId === null && Date.now() - missedAt > 10 * 60_000)) {
              // Not found yet: look again every 10 minutes (ESPN lists games late sometimes).
              eventId = await findEventId(ref, bet.date);
              eventIds.current.set(k, eventId);
              if (eventId === null) notFoundAt.current.set(k, Date.now());
            }
            found.push(eventId ?? null);
            if (!eventId) {
              legGames.push(undefined);
              continue;
            }
            let live = byEvent.get(eventId);
            if (!live) {
              live = await fetchLiveGame(ref.league, eventId);
              byEvent.set(eventId, live);
            }
            if (live.state === 'in') anyLive = true;
            legGames.push(live);
          }
          const latest = betsRef.current.find((b) => b.id === bet.id);
          if (!latest) continue;
          // Record how each finished leg went, even on a dead ticket, so the
          // ticket keeps a full leg-by-leg record.
          const results = gradeLegs(latest, legGames);
          if (latest.status !== 'pending') {
            perLeg.set(bet.id, legGames); // its cards still show which legs are left to play
            // Dead or cashed tickets stay off the Live tab; only their legs
            // keep being checked until every game is final.
            if (latest.legs?.length) {
              const legs = latest.legs.map((l, i) =>
                results[i] && l.result !== results[i] ? { ...l, result: results[i] } : l,
              );
              if (legs.some((l, i) => l !== latest.legs![i])) saveBet({ ...latest, legs });
            }
            continue;
          }
          perLeg.set(bet.id, legGames);
          const top = legGames.find((g) => g?.state === 'in') ?? legGames.find(Boolean);
          if (top) headline.set(bet.id, top);

          // Remember matched games on the bet so later lookups are quick, and
          // settle it once the final stats decide it.
          let updated: Bet | null = null;
          if (latest.legs?.length) {
            const legs = latest.legs.map((l, i) => {
              let leg = l;
              if (found[i] && refs[i] && !l.game?.eventId)
                leg = { ...leg, game: { ...refs[i]!, eventId: found[i]! } };
              if (results[i] && l.result !== results[i]) leg = { ...leg, result: results[i] };
              return leg;
            });
            if (legs.some((l, i) => l !== latest.legs![i])) updated = { ...latest, legs };
          } else if (found[0] && refs[0] && !latest.game?.eventId) {
            updated = { ...latest, game: { ...refs[0], eventId: found[0] } };
          }
          const decision = autoSettle(latest, legGames);
          if (decision && 'status' in decision) {
            updated = {
              ...(updated ?? latest),
              status: decision.status,
              settledBy: 'auto',
              ...(decision.toWin
                ? {
                    toWin: decision.toWin,
                    // Paid at the remaining legs' odds; keep the odds in step with the money.
                    odds: decimalToAmerican(1 + decision.toWin / latest.stake) || latest.odds,
                  }
                : {}),
            };
          }
          if (updated) saveBet(updated);
        }
        if (!cancelled) {
          setGames(headline);
          setLegGames(perLeg);
          setLastError(null);
        }
      } catch (e) {
        if (!cancelled) setLastError(e instanceof Error ? e.message : 'Live update failed');
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          timer = setTimeout(run, anyLive ? POLL_LIVE_MS : POLL_IDLE_MS);
        }
      }
    };

    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        clearTimeout(timer);
        run();
      } else clearTimeout(timer);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedKey, tick]);

  const value = useMemo(
    () => ({
      games,
      legGames: legGamesMap,
      refreshing,
      lastError,
      refresh: () => setTick((t) => t + 1),
    }),
    [games, legGamesMap, refreshing, lastError],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  return useContext(LiveContext);
}

/** Short score line for one game, e.g. "DEN 17–14 PIT · 5:12 - 3rd". */
export function gameLine(g: LiveGame): string {
  const score = `${g.away.abbr} ${g.away.score}–${g.home.score} ${g.home.abbr}`;
  if (g.state === 'post') return `${score} · Final`;
  if (g.state === 'pre') return `${g.away.abbr} @ ${g.home.abbr} · ${g.detail}`;
  return `${score} · ${g.detail}`;
}

/** Live progress for every leg of a bet, each against its own game. */
export function useBetLive(bet: Bet) {
  const { games, legGames } = useLive();
  const game = games.get(bet.id);
  const perLeg = legGames.get(bet.id) ?? [];
  const legs = betMarkets(bet).map((m, i) => {
    const g = perLeg[i] ?? (perLeg.length ? undefined : game);
    const progress = gradeMarket(m.market, g);
    const odds = bet.legs?.length ? bet.legs[i]?.odds : bet.odds;
    return { ...m, game: g, progress, chance: legChance(m.market, progress, g, odds) };
  });
  const eventIds = new Set(legs.map((l) => l.game?.eventId).filter(Boolean));
  return {
    game,
    legs,
    legGames: legs.map((l) => l.game),
    multiGame: eventIds.size > 1,
    chance: game ? betChance(legs.map((l) => l.chance)) : null,
  };
}

/**
 * Where a ticket belongs:
 * - 'upcoming' until any of its games starts,
 * - 'live' (current) once a game has started and the ticket is still open,
 *   including a parlay waiting on its next game,
 * - 'settle' when every game is over but the app couldn't decide it,
 * - 'past' once it's won, lost or pushed.
 */
export type BetPhase = 'upcoming' | 'live' | 'settle' | 'past';
export function betPhase(bet: Bet, legGames?: (LiveGame | undefined)[]): BetPhase {
  if (bet.status !== 'pending') return 'past';
  const found = (legGames ?? []).filter(Boolean) as LiveGame[];
  if (found.some((g) => g.state === 'in')) return 'live';
  const daysOld = (Date.now() - new Date(`${bet.date}T12:00:00`).getTime()) / 86400000;
  // Every game the app could find is over (any others were never found):
  // it can't settle itself, so it needs your call.
  if (found.length && found.every((g) => g.state === 'post')) return 'settle';
  if (found.some((g) => g.state === 'post')) return 'live';
  // No game found at all, well after the bet date: it isn't coming.
  if (!found.length && daysOld > 7) return 'settle';
  return 'upcoming';
}

/** Phase for every bet, from the live data the provider already has. */
export function useBetPhases(): (bet: Bet) => BetPhase {
  const { games, legGames } = useLive();
  return (bet: Bet) => {
    const perLeg = legGames.get(bet.id);
    const g = games.get(bet.id);
    return betPhase(bet, perLeg?.length ? perLeg : g ? [g] : undefined);
  };
}
