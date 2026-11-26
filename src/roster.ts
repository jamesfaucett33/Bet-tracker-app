import type { ScannedBet } from './scan';
import { GameRef, Market } from './types';

/**
 * Checks player names read off a slip against the two teams' real rosters
 * (ESPN), fixing OCR slips like "yren Williams" -> "Kyren Williams" and
 * flagging names that match nobody so the slip can be retaken.
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
const PATHS: Record<string, string> = {
  NFL: 'football/nfl',
  NCAAF: 'football/college-football',
  NBA: 'basketball/nba',
  WNBA: 'basketball/wnba',
};

const teamIds = new Map<string, Promise<Map<string, string>>>();
const rosters = new Map<string, Promise<string[]>>();

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function getJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function leagueTeams(league: string): Promise<Map<string, string>> {
  let p = teamIds.get(league);
  if (!p) {
    p = getJSON(`${ESPN}/${PATHS[league]}/teams?limit=500`).then((d) => {
      const map = new Map<string, string>();
      for (const t of d.sports?.[0]?.leagues?.[0]?.teams ?? []) {
        map.set(norm(t.team.displayName), String(t.team.id));
        map.set(norm(t.team.shortDisplayName ?? ''), String(t.team.id));
      }
      return map;
    });
    p.catch(() => teamIds.delete(league));
    teamIds.set(league, p);
  }
  return p;
}

async function teamRoster(league: string, team: string): Promise<string[]> {
  const key = `${league}|${norm(team)}`;
  let p = rosters.get(key);
  if (!p) {
    p = (async () => {
      const ids = await leagueTeams(league);
      const n = norm(team);
      const id =
        ids.get(n) ??
        [...ids.entries()].find(([name]) => name && (n.endsWith(name) || name.endsWith(n)))?.[1];
      if (!id) return [];
      const d = await getJSON(`${ESPN}/${PATHS[league]}/teams/${id}/roster`);
      const list: any[] = d.athletes ?? [];
      // Football rosters are grouped by unit; basketball rosters are flat.
      const people = list.flatMap((x) => (Array.isArray(x.items) ? x.items : [x]));
      return people.map((a) => String(a.displayName ?? a.fullName ?? '')).filter(Boolean);
    })();
    p.catch(() => rosters.delete(key));
    rosters.set(key, p);
  }
  return p;
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

/** Best roster match for an OCR'd name, trying it without leading junk words too. */
export function matchPlayer(raw: string, roster: string[]): string | null {
  const words = norm(raw).split(' ').filter(Boolean);
  const candidates: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const rest = words.slice(i);
    if (rest.length >= 2 || i === 0) candidates.push(rest.join(' '));
  }
  let best: { name: string; score: number } | null = null;
  for (const person of roster) {
    const p = norm(person).replace(/ (jr|sr|ii|iii|iv)$/, '');
    for (const c of candidates) {
      let score = similarity(c, p);
      // Same last name and a first name that's mostly there ("yren" vs "kyren").
      const [cf, ...cl] = c.split(' ');
      const [pf, ...pl] = p.split(' ');
      if (cl.length && cl.join(' ') === pl.join(' ')) {
        score = Math.max(score, 0.6 + 0.4 * similarity(cf, pf));
      }
      if (!best || score > best.score) best = { name: person, score };
    }
  }
  if (best && best.score >= 0.8) return best.name;
  // A lone last name counts only when exactly one player has it.
  if (words.length === 1) {
    const same = roster.filter((p) => norm(p).split(' ').slice(-1)[0] === words[0]);
    if (same.length === 1) return same[0];
  }
  return null;
}

/**
 * Corrects player names against the rosters. Legs whose player can't be
 * matched lose their market, so the slip counts as unreadable. When rosters
 * can't be loaded (offline, unsupported league) the bet is returned as-is.
 */
/** Team legs must name one of the game's two teams; returns the full name or null. */
function matchTeam(raw: string, game: GameRef): string | null {
  const n = norm(raw);
  for (const team of [game.away, game.home]) {
    const t = norm(team);
    const nick = t.split(' ').slice(-1)[0];
    const extraWords = n.split(' ').length - t.split(' ').length;
    if (n === t || (n.includes(t) && extraWords <= 1)) return team;
    if (nick && new RegExp(`\\b${nick}\\b`).test(n) && extraWords <= 0) return team;
  }
  return null;
}

/** Drops team legs (moneyline/spread) that don't name a team in this game. */
function verifyTeams(sb: ScannedBet, game: GameRef | undefined): ScannedBet {
  if (!game) return sb;
  const legs = sb.legs.map((l) => {
    const m = l.market;
    if (!m || (m.kind !== 'moneyline' && m.kind !== 'spread')) return l;
    const team = matchTeam(m.team, game);
    if (!team) return { ...l, market: undefined };
    const pick =
      m.kind === 'moneyline' ? `${team} ML` : `${team} ${m.line > 0 ? '+' : ''}${m.line}`;
    return { ...l, pick, market: { ...m, team } };
  });
  return { ...sb, legs };
}

export async function verifyPlayers(
  sb: ScannedBet,
  game: GameRef | undefined,
): Promise<ScannedBet> {
  sb = verifyTeams(sb, game);
  const league = game?.league?.toUpperCase();
  if (!game || !league || !PATHS[league]) return sb;
  let roster: string[];
  try {
    const [a, h] = await Promise.all([
      teamRoster(league, game.away),
      teamRoster(league, game.home),
    ]);
    roster = [...a, ...h];
  } catch {
    return sb;
  }
  if (!roster.length) return sb;

  const fix = (market: Market | undefined, pick: string) => {
    if (!market || market.kind !== 'player') return { market, pick };
    const name = matchPlayer(market.player, roster);
    if (!name) return { market: undefined, pick };
    const fixedPick = pick.replace(
      /^.*?(?=\s\d|\s(?:Passing|Rushing|Receiving|Receptions|Field|Points|Rebounds|Assists|Touchdown))/i,
      name,
    );
    return {
      market: { ...market, player: name },
      pick: fixedPick.startsWith(name) ? fixedPick : pick,
    };
  };

  return {
    ...sb,
    legs: sb.legs.map((l) => {
      const r = fix(l.market, l.pick);
      return { ...l, market: r.market, pick: r.pick };
    }),
    market: sb.market ? fix(sb.market, sb.pick).market : sb.market,
  };
}
