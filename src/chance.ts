import { findTeam, type LegProgress, type LiveGame } from './live';
import { impliedProbability } from './odds';
import { Market, PlayerStat } from './types';

/**
 * Rough live "chance to hit" for legs and tickets, from where each leg
 * stands, its pace so far and the time left. It's an estimate for fun, not
 * a betting model: same game parlay legs are treated as independent, and a
 * player's typical output is approximated by the line itself.
 */

/** Game length by league: number of periods and seconds per period. */
const SHAPES: Record<string, { periods: number; secs: number }> = {
  NFL: { periods: 4, secs: 15 * 60 },
  NCAAF: { periods: 4, secs: 15 * 60 },
  NBA: { periods: 4, secs: 12 * 60 },
  WNBA: { periods: 4, secs: 10 * 60 },
  NCAAB: { periods: 2, secs: 20 * 60 },
  NHL: { periods: 3, secs: 20 * 60 },
};

/** Fraction of regulation played (0 before kickoff, 1 at the end). */
export function elapsedFraction(game: LiveGame): number {
  if (game.state === 'pre') return 0;
  if (game.state === 'post') return 1;
  const shape = SHAPES[game.league];
  if (!shape) return 0.5;
  if (game.period > shape.periods) return 0.99; // overtime
  const done = (game.period - 1) * shape.secs + (shape.secs - game.clockSecs);
  return Math.min(0.995, Math.max(0, done / (shape.periods * shape.secs)));
}

// Standard normal CDF (Abramowitz-Stegun approximation).
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}


const COUNT_STATS: PlayerStat[] = [
  'receptions',
  'fgMade',
  'passTd',
  'anyTd',
  'threes',
  'rebounds',
  'assists',
  'passCompletions',
  'passAttempts',
  'rushAttempts',
  'interceptions',
  'steals',
  'blocks',
  'sacks',
  'tackles',
  'soloTackles',
];

/**
 * Yards and points pile up one play at a time: a number of catches / carries /
 * baskets (Poisson), each worth a random amount (gamma). Per play: the average
 * gain and how even the gains are (higher shape = more even). One catch can be
 * 3 yards or 60, which is what makes yardage props swing.
 */
const PER_PLAY: Partial<Record<PlayerStat, { avg: number; shape: number }>> = {
  recYds: { avg: 11.5, shape: 1.1 }, // per catch
  rushYds: { avg: 4.4, shape: 0.55 }, // per carry (lots of 1-3 yard runs, some breakaways)
  rushRecYds: { avg: 6.5, shape: 0.7 },
  passYds: { avg: 11, shape: 1.1 }, // per completion
  passRushYds: { avg: 9.5, shape: 1 },
  points: { avg: 2.2, shape: 6 }, // per made basket / free-throw trip
  pra: { avg: 1.4, shape: 3 },
};

// ---- distributions ----

function lnGamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularized upper incomplete gamma Q(a, x) = P(Gamma(a, 1) >= x). */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (a <= 0) return 0;
  const lnPre = -x + a * Math.log(x) - lnGamma(a);
  if (x < a + 1) {
    // series for P, then Q = 1 - P
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-12) break;
    }
    return Math.max(0, Math.min(1, 1 - Math.exp(lnPre) * sum));
  }
  // continued fraction for Q (Lentz)
  let b = x + 1 - a;
  let cc = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    cc = b + an / cc;
    if (Math.abs(cc) < 1e-300) cc = 1e-300;
    d = 1 / d;
    const del = d * cc;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.max(0, Math.min(1, Math.exp(lnPre) * h));
}

/** P(Poisson(mean) >= k). */
function poissonAtLeast(mean: number, k: number): number {
  if (k <= 0) return 1;
  if (mean <= 0) return 0;
  return 1 - gammaQ(k, mean); // P(X >= k) = P_regularized(k, mean) = 1 - Q(k, mean)
}

/** Poisson probability of exactly n. */
function poissonPmf(n: number, mean: number): number {
  return Math.exp(-mean + n * Math.log(mean) - lnGamma(n + 1));
}

/**
 * Chance a player gets at least `need` more of a stat, given a per-game rate
 * and the share of the game left. Counting stats (catches, TDs) are Poisson.
 * Yards and points add up play by play: P(sum of the remaining plays' gains
 * reaches the need), summed over how many plays they get.
 */
function atLeastMore(stat: PlayerStat, need: number, rate: number, remaining: number): number {
  if (need <= 0) return 1;
  if (remaining <= 0 || rate <= 0) return 0;
  if (COUNT_STATS.includes(stat)) return poissonAtLeast(rate * remaining, Math.ceil(need));
  const play = PER_PLAY[stat] ?? { avg: 8, shape: 1 };
  const plays = (rate / play.avg) * remaining; // expected plays left
  const scale = play.avg / play.shape;
  const target = Math.max(0, need - 0.5) / scale;
  const maxN = Math.ceil(plays + 10 * Math.sqrt(plays) + 25);
  let p = 0;
  for (let n = 1; n <= maxN; n++) {
    const w = poissonPmf(n, plays);
    if (w < 1e-12 && n > plays) break;
    p += w * gammaQ(n * play.shape, target);
  }
  return Math.max(0, Math.min(1, p));
}

/**
 * The player's expected full-game output before kickoff: set so the chance
 * of reaching the line matches the leg's odds (minus the book's cut), or a
 * 50/50 at the line when the leg has no odds of its own.
 */
function priorRate(stat: PlayerStat, line: number, odds?: number | null, under = false): number {
  const implied = odds != null ? impliedProbability(odds) : NaN;
  let p = Number.isFinite(implied) ? Math.min(0.97, Math.max(0.03, implied * 0.955)) : 0.5;
  if (under) p = 1 - p; // the odds are for the under; we need the chance of the over
  let lo = line * 0.05;
  let hi = line * 6 + 5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (atLeastMore(stat, line, mid, 1) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function playerChance(
  current: number,
  line: number,
  stat: PlayerStat,
  elapsed: number,
  odds?: number | null,
  under = false,
): number {
  const need = line - current;
  if (need <= 0) return 1;
  const remaining = 1 - elapsed;
  if (remaining <= 0) return 0;
  // Update the pre-game expectation with what's happened so far. The prior
  // counts as one full game of evidence, so a slow first quarter lowers the
  // outlook a little and a slow first half lowers it more, without writing
  // the player off.
  const prior = priorRate(stat, line, odds, under);
  const PRIOR_GAMES = 1;
  const rate = (PRIOR_GAMES * prior + current) / (PRIOR_GAMES + elapsed);
  return atLeastMore(stat, need, rate, remaining);
}

/** Margin standard deviation over a full game, by league (points). */
const MARGIN_SD: Record<string, number> = {
  NFL: 13.5,
  NCAAF: 16,
  NBA: 12,
  WNBA: 11,
  NCAAB: 11,
  NHL: 1.6,
};


/** Chance (0-1) that one leg hits, or null when it can't be estimated. */
export function legChance(
  market: Market | undefined,
  progress: LegProgress,
  game: LiveGame | undefined,
  /** The leg's own odds, when known: the best guess before the game starts. */
  odds?: number | null,
): number | null {
  if (!market || progress.state === 'unknown') return null;
  if (progress.state === 'push') return 1; // a pushed leg is dropped from the ticket
  if (!game || game.state === 'pre') {
    const implied = odds != null ? impliedProbability(odds) : NaN;
    if (Number.isFinite(implied)) return implied;
    if (!game) return null;
  }
  if (progress.state === 'hit') {
    // Not official until the game is final; yardage can still drop on a loss.
    if (game.state === 'post') return 1;
    if (market.kind === 'player' && !COUNT_STATS.includes(market.stat)) {
      // Yardage can drop on a loss, but only by a few yards: the further past
      // the line, the safer. 1 yard over ~99%, 20+ over ~99.9%+.
      const cushion = Math.max(0, (progress.current ?? market.line) - market.line);
      return 1 - 0.01 * Math.exp(-cushion / 6);
    }
    return 0.9995; // counting stats (catches, field goals, TDs) don't go down
  }
  if (progress.state === 'miss') return 0;
  const elapsed = elapsedFraction(game);
  const remaining = 1 - elapsed;
  const sdGame = MARGIN_SD[game.league] ?? 12;
  // What the sportsbooks expected before kickoff: the team's expected winning
  // margin (from the spread) over a full game. Without it, a pick'em.
  const expectedMargin = (team: string) => {
    if (game.homeSpread === null) return 0;
    const side = findTeam(game, team);
    if (!side) return 0;
    return side.team === game.home ? -game.homeSpread : game.homeSpread;
  };

  switch (market.kind) {
    case 'player': {
      const over = playerChance(
        progress.current ?? 0,
        market.line,
        market.stat,
        elapsed,
        odds,
        !!market.under,
      );
      return market.under ? 1 - over : over;
    }
    case 'moneyline': {
      // ESPN's live win probability is the best estimate available.
      const side = findTeam(game, market.team);
      if (side && game.homeWinPct !== null && game.state === 'in') {
        return side.team === game.home ? game.homeWinPct : 1 - game.homeWinPct;
      }
      const margin = (progress.current ?? 0) + expectedMargin(market.team) * remaining;
      return 1 - phi((0.5 - margin) / Math.max(0.5, sdGame * Math.sqrt(remaining)));
    }
    case 'spread': {
      // Margin so far plus what the line says is still to come.
      const margin = (progress.current ?? 0) + expectedMargin(market.team) * remaining;
      return 1 - phi((-market.line - margin) / Math.max(0.5, sdGame * Math.sqrt(remaining)));
    }
    case 'total': {
      const total = progress.current ?? 0;
      // Scoring pace, starting from the book's total (not the bet's own line,
      // which may be teased or alternate).
      // A team total starts from half the book's total, shifted by the spread.
      const base = market.team
        ? game.marketTotal !== null
          ? (game.marketTotal + expectedMargin(market.team)) / 2
          : market.line
        : (game.marketTotal ?? market.line);
      const pace = elapsed > 0.05 ? total / elapsed : base;
      const expectedFinal = total + (elapsed * pace + (1 - elapsed) * base) * remaining;
      const sd = Math.max(0.5, sdGame * (market.team ? 0.75 : 1) * Math.sqrt(remaining));
      const over = 1 - phi((market.line - expectedFinal) / sd);
      return market.side === 'over' ? over : 1 - over;
    }
  }
}

/** Ticket chance: every leg has to hit (legs treated as independent). */
export function betChance(chances: (number | null)[]): number | null {
  if (!chances.length || chances.some((c) => c === null)) return null;
  return chances.reduce<number>((acc, c) => acc * (c as number), 1);
}

export function formatChance(c: number): string {
  if (c >= 0.999) return '99.9%';
  if (c >= 0.99) return `${(Math.floor(c * 1000) / 10).toFixed(1)}%`;
  if (c > 0 && c < 0.01) return '<1%';
  return `${Math.round(c * 100)}%`;
}
