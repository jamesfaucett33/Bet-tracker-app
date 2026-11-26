import { Bet, GameRef, Market, PLAYER_STATS, PlayerStat } from './types';

/**
 * Turns free-text legs ("Matthew Stafford 250+ pass + rush yds", "Packers ML")
 * into structured markets that live stats can grade. Scanned slips usually
 * arrive already structured; this covers bets typed by hand.
 */

// Order matters: combined stats must be matched before their parts.
const STAT_PATTERNS: [RegExp, PlayerStat][] = [
  [/pass(ing)?\s*(\+|and|&)\s*rush(ing)?\s*(yds|yards)/i, 'passRushYds'],
  [/rush(ing)?\s*(\+|and|&)\s*rec(eiving)?\s*(yds|yards)/i, 'rushRecYds'],
  [/pts\s*\+\s*reb\s*\+\s*ast|points\s*\+\s*rebounds\s*\+\s*assists|\bpra\b/i, 'pra'],
  [/pass(ing)?\s*(yds|yards)/i, 'passYds'],
  [/rush(ing)?\s*(yds|yards)/i, 'rushYds'],
  [/rec(eiving)?\s*(yds|yards)/i, 'recYds'],
  [/receptions|\bcatches\b/i, 'receptions'],
  [/pass(ing)?\s*(tds?|touchdowns?)/i, 'passTd'],
  [/(anytime\s*)?(td|touchdown)s?(\s*scorer)?/i, 'anyTd'],
  [/field\s*goals?(\s*made)?|\bfgs?\b/i, 'fgMade'],
  [/three|3[\s-]*(pt|pointer)s?|3pm/i, 'threes'],
  [/rebounds?|\breb\b/i, 'rebounds'],
  [/assists?|\bast\b/i, 'assists'],
  [/points?|\bpts\b/i, 'points'],
];

export function parseMarket(text: string): Market | undefined {
  const t = text.trim();
  if (!t) return undefined;

  // "Green Bay Packers ML" / "Packers Money Line" / "Packers moneyline"
  const ml = /^(.*?)\s*(?:-|–)?\s*\b(ml|money\s*line|moneyline)\b/i.exec(t);
  if (ml && ml[1].trim()) return { kind: 'moneyline', team: ml[1].trim() };

  // "Over 47.5" / "o47.5" / "Under 220" (game totals)
  const tot = /\b(over|under|o|u)\s*(\d+(?:\.\d+)?)\b/i.exec(t);
  if (tot && !/yds|yards|rec|pts|reb|ast/i.test(t)) {
    const side = tot[1].toLowerCase().startsWith('o') ? 'over' : 'under';
    return { kind: 'total', side, line: Number(tot[2]) };
  }

  // Player props: a number with "+" (or "over N") and a recognizable stat.
  const lineMatch = /(\d+(?:\.\d+)?)\s*\+|over\s*(\d+(?:\.\d+)?)/i.exec(t);
  const stat = STAT_PATTERNS.find(([re]) => re.test(t))?.[1];
  if (lineMatch && stat) {
    const raw = lineMatch[1] ?? lineMatch[2];
    // "over 249.5" means 250+; "250+" means 250+.
    const line = lineMatch[1] ? Number(raw) : Math.floor(Number(raw)) + 1;
    const player = t
      .replace(lineMatch[0], ' ')
      .replace(STAT_PATTERNS.find(([, s]) => s === stat)![0], ' ')
      .replace(/\s[-–·]\s|\s+/g, ' ')
      .replace(/\b(alt(ernate)?|player|to record|or more)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (player) return { kind: 'player', player, stat, line };
  }
  if (stat === 'anyTd' && /anytime/i.test(t)) {
    const player = t.replace(/anytime\s*(td|touchdown)s?(\s*scorer)?/i, '').trim();
    if (player) return { kind: 'player', player, stat: 'anyTd', line: 1 };
  }

  // "Chiefs -3.5" / "Rams +7"
  const spread = /^(.*?[a-z].*?)\s+([+-]\d+(?:\.\d+)?)\b/i.exec(t);
  if (spread) return { kind: 'spread', team: spread[1].trim(), line: Number(spread[2]) };

  return undefined;
}

/** Finds "Away @ Home" / "Away at Home" / "Away vs Home" in text. */
export function parseGame(text: string, league: string): GameRef | undefined {
  const m = /([A-Za-z0-9.' ]+?)\s+(?:@|at|vs\.?|v)\s+([A-Za-z0-9.' ]+)/i.exec(
    text.replace(/^.*?:/, ''),
  );
  if (!m) return undefined;
  const away = m[1].trim();
  const home = m[2].trim();
  if (!away || !home) return undefined;
  return { league, away, home };
}

export function describeMarket(m: Market): string {
  switch (m.kind) {
    case 'player':
      return `${m.player} ${m.line}+ ${PLAYER_STATS[m.stat].toLowerCase()}`;
    case 'moneyline':
      return `${m.team} ML`;
    case 'spread':
      return `${m.team} ${m.line > 0 ? '+' : ''}${m.line}`;
    case 'total':
      return `${m.side === 'over' ? 'Over' : 'Under'} ${m.line}`;
  }
}

/** The markets a bet is graded on (its legs, or the bet itself). */
export function betMarkets(bet: Bet): { label: string; market?: Market }[] {
  if (bet.legs?.length) {
    return bet.legs.map((l) => ({ label: l.pick, market: l.market ?? parseMarket(l.pick) }));
  }
  return [{ label: bet.pick, market: bet.market ?? parseMarket(bet.pick) }];
}

/**
 * The game one leg is on, from the leg itself: stored, or read from text like
 * "Denver Broncos ML at Pittsburgh Steelers" / "Chiefs +2.5 vs Bills". With
 * only a team (no opponent) the team alone is matched.
 */
export function legGame(
  label: string,
  market: Market | undefined,
  league: string,
  stored?: GameRef,
): GameRef | undefined {
  if (stored) return stored;
  const team =
    market && (market.kind === 'moneyline' || market.kind === 'spread') ? market.team : '';
  const opp = /\b(?:at|@|vs\.?|v\.?)\s+([A-Za-z0-9.' ]+?)\s*$/i.exec(label.trim());
  if (team || opp) {
    const other = opp ? opp[1].trim() : '';
    if (team || other) return { league, away: team, home: other };
  }
  return undefined;
}

/** The game a bet is on: stored, or recovered from its description. */
export function betGame(bet: Bet): GameRef | undefined {
  return bet.game ?? parseGame(bet.pick, bet.sport);
}
