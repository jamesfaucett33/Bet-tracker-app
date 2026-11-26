import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { betGame, betMarkets } from './markets';
import { useStore } from './store';
import { Bet, GameRef, Market, PlayerStat } from './types';

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
}

export interface LiveGame {
  eventId: string;
  state: 'pre' | 'in' | 'post';
  detail: string; // "5:29 - 2nd", "Final", "Thu 5:15 PM"
  home: TeamScore;
  away: TeamScore;
  /** normalized player name -> stat group -> label -> value */
  players: Map<string, Record<string, Record<string, string>>>;
  updatedAt: number;
}

export type LegState = 'pre' | 'live' | 'hit' | 'miss' | 'unknown';

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
  const candidates = [team.name, team.short, team.abbr].map(norm);
  return candidates.some((c) => c === n || n.includes(c) || c.includes(n));
}

function findTeam(game: LiveGame, name: string): { team: TeamScore; other: TeamScore } | null {
  if (teamMatches(game.home, name)) return { team: game.home, other: game.away };
  if (teamMatches(game.away, name)) return { team: game.away, other: game.home };
  return null;
}

// ---------- ESPN fetchers ----------

function toTeam(c: any): TeamScore {
  return {
    name: c.team?.displayName ?? '',
    short: c.team?.shortDisplayName ?? c.team?.name ?? '',
    abbr: c.team?.abbreviation ?? '',
    score: Number(c.score ?? 0) || 0,
  };
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
export async function findEventId(game: GameRef, betDate: string): Promise<string | null> {
  const path = LEAGUE_PATHS[game.league.toUpperCase()];
  if (!path) return null;
  for (const offset of [0, 1, 2, -1]) {
    const data = await getJSON(`${ESPN}/${path}/scoreboard?dates=${ymd(betDate, offset)}`);
    for (const ev of data.events ?? []) {
      const comps = ev.competitions?.[0]?.competitors ?? [];
      const teams = comps.map(toTeam);
      const hasAway = teams.some((t: TeamScore) => teamMatches(t, game.away));
      const hasHome = teams.some((t: TeamScore) => teamMatches(t, game.home));
      if (hasAway && hasHome) return String(ev.id);
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
        // Also index by "first-initial last" so "M. Stafford" style names match.
        const parts = key.split(' ');
        if (parts.length > 1) players.set(`${parts[0][0]} ${parts.slice(1).join(' ')}`, entry);
      }
    }
  }

  return {
    eventId,
    state: (status.state as LiveGame['state']) ?? 'pre',
    detail: status.shortDetail ?? status.detail ?? '',
    home,
    away,
    players,
    updatedAt: Date.now(),
  };
}

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
      return any('PTS');
    case 'rebounds':
      return any('REB');
    case 'assists':
      return any('AST');
    case 'threes':
      return any('3PT');
    case 'pra':
      return any('PTS') + any('REB') + any('AST');
  }
}

export function gradeMarket(market: Market | undefined, game: LiveGame | undefined): LegProgress {
  if (!market) return { current: null, target: null, state: 'unknown', text: '' };
  if (!game) {
    const target = market.kind === 'player' ? market.line : null;
    return { current: null, target, state: 'pre', text: 'Waiting for game' };
  }
  const final = game.state === 'post';
  const started = game.state !== 'pre';

  if (market.kind === 'player') {
    const stats = game.players.get(norm(market.player));
    const current = started ? statValue(stats, market.stat) : 0;
    const hit = current >= market.line;
    return {
      current,
      target: market.line,
      state: hit ? 'hit' : final ? 'miss' : started ? 'live' : 'pre',
      text: `${current} / ${market.line}`,
    };
  }

  if (market.kind === 'total') {
    const total = game.home.score + game.away.score;
    const over = total > market.line;
    const settledWin = market.side === 'over' ? over : total < market.line;
    const state: LegState =
      market.side === 'over' && over
        ? 'hit'
        : final
          ? settledWin
            ? 'hit'
            : 'miss'
          : started
            ? 'live'
            : 'pre';
    return { current: total, target: market.line, state, text: `${total} pts / ${market.line}` };
  }

  const found = findTeam(game, market.team);
  if (!found) return { current: null, target: null, state: 'unknown', text: 'Team not found' };
  const margin = found.team.score - found.other.score;
  const needed = market.kind === 'spread' ? -market.line : 0; // must win by more than this
  const covering = margin > needed;
  const lead = margin === 0 ? 'Tied' : margin > 0 ? `Up ${margin}` : `Down ${Math.abs(margin)}`;
  return {
    current: margin,
    target: needed,
    state: final ? (covering ? 'hit' : 'miss') : started ? 'live' : 'pre',
    text: final ? `Final: ${lead.toLowerCase()}` : started ? lead : 'Not started',
  };
}

/** True when the team in a team market is currently ahead/covering (for bar color). */
export function isCovering(p: LegProgress, market?: Market): boolean {
  if (!market || market.kind === 'player' || market.kind === 'total') return false;
  return p.current !== null && p.target !== null && p.current > p.target;
}

// ---------- provider ----------

interface LiveCtx {
  games: Map<string, LiveGame>; // key: bet id -> game
  refreshing: boolean;
  lastError: string | null;
  refresh: () => void;
}

const LiveContext = createContext<LiveCtx>({
  games: new Map(),
  refreshing: false,
  lastError: null,
  refresh: () => {},
});

const gameKey = (g: GameRef) => `${g.league}|${norm(g.away)}|${norm(g.home)}`;

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { bets, saveBet } = useStore();
  const [games, setGames] = useState<Map<string, LiveGame>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const eventIds = useRef(new Map<string, string | null>()); // gameKey -> eventId (null = not found)
  const betsRef = useRef(bets);
  betsRef.current = bets;

  // Bets worth tracking: pending, or settled today (so a just-finished game still shows).
  const tracked = useMemo(
    () =>
      bets.filter(
        (b) => b.status === 'pending' && betGame(b) && betMarkets(b).some((m) => m.market),
      ),
    [bets],
  );
  const trackedKey = tracked.map((b) => b.id).join(',');

  useEffect(() => {
    if (!tracked.length) {
      setGames(new Map());
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      setRefreshing(true);
      const byEvent = new Map<string, LiveGame>();
      const result = new Map<string, LiveGame>();
      let anyLive = false;
      try {
        for (const bet of tracked) {
          const g = betGame(bet)!;
          const k = gameKey(g);
          let eventId = g.eventId ?? eventIds.current.get(k);
          if (eventId === undefined) {
            eventId = await findEventId(g, bet.date);
            eventIds.current.set(k, eventId);
            // Remember the match on the bet so later lookups are one request.
            if (eventId && !bet.game?.eventId) {
              const latest = betsRef.current.find((b) => b.id === bet.id);
              if (latest) saveBet({ ...latest, game: { ...g, eventId } });
            }
          }
          if (!eventId) continue;
          let live = byEvent.get(eventId);
          if (!live) {
            live = await fetchLiveGame(g.league, eventId);
            byEvent.set(eventId, live);
          }
          if (live.state === 'in') anyLive = true;
          result.set(bet.id, live);
        }
        if (!cancelled) {
          setGames(result);
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
    () => ({ games, refreshing, lastError, refresh: () => setTick((t) => t + 1) }),
    [games, refreshing, lastError],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  return useContext(LiveContext);
}

export function useBetLive(bet: Bet) {
  const { games } = useLive();
  const game = games.get(bet.id);
  const legs = betMarkets(bet).map((m) => ({ ...m, progress: gradeMarket(m.market, game) }));
  return { game, legs };
}
