import { findTeam, type LegProgress, type LiveGame } from './live';
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

/** P(Poisson(mean) >= k). */
function poissonAtLeast(mean: number, k: number): number {
  if (k <= 0) return 1;
  if (mean <= 0) return 0;
  let term = Math.exp(-mean);
  let cdf = term;
  for (let i = 1; i < k; i++) {
    term *= mean / i;
    cdf += term;
  }
  return Math.max(0, Math.min(1, 1 - cdf));
}

const COUNT_STATS: PlayerStat[] = [
  'receptions',
  'fgMade',
  'passTd',
  'anyTd',
  'threes',
  'rebounds',
  'assists',
];
// How "lumpy" each stat is: variance per unit of expected output.
const SPREAD: Partial<Record<PlayerStat, number>> = {
  passYds: 12,
  passRushYds: 12,
  rushYds: 9,
  recYds: 11,
  rushRecYds: 10,
  points: 2.5,
  pra: 2.5,
};

/** Margin standard deviation over a full game, by league (points). */
const MARGIN_SD: Record<string, number> = {
  NFL: 13.5,
  NCAAF: 16,
  NBA: 12,
  WNBA: 11,
  NCAAB: 11,
  NHL: 1.6,
};

function playerChance(current: number, line: number, stat: PlayerStat, elapsed: number): number {
  const need = line - current;
  if (need <= 0) return 1;
  const remaining = 1 - elapsed;
  if (remaining <= 0) return 0;
  // Expected output for the rest of the game: blend the pace so far with the
  // line (a stand-in for the player's usual output), trusting pace more as
  // the game goes on.
  const pace = elapsed > 0.05 ? current / elapsed : line;
  const perGame = elapsed * pace + (1 - elapsed) * line;
  const mean = perGame * remaining;
  if (COUNT_STATS.includes(stat)) return poissonAtLeast(mean, Math.ceil(need));
  const sd = Math.max(1, Math.sqrt(Math.max(mean, 0.5) * (SPREAD[stat] ?? 8)));
  return 1 - phi((need - 0.5 - mean) / sd);
}

/** Chance (0-1) that one leg hits, or null when it can't be estimated. */
export function legChance(
  market: Market | undefined,
  progress: LegProgress,
  game: LiveGame | undefined,
): number | null {
  if (!market || !game || progress.state === 'unknown') return null;
  if (progress.state === 'hit') return 1;
  if (progress.state === 'miss') return 0;
  const elapsed = elapsedFraction(game);
  const remaining = 1 - elapsed;
  const sdGame = MARGIN_SD[game.league] ?? 12;

  switch (market.kind) {
    case 'player':
      return playerChance(progress.current ?? 0, market.line, market.stat, elapsed);
    case 'moneyline': {
      // ESPN's live win probability is the best estimate available.
      const side = findTeam(game, market.team);
      if (side && game.homeWinPct !== null && game.state === 'in') {
        return side.team === game.home ? game.homeWinPct : 1 - game.homeWinPct;
      }
      const margin = progress.current ?? 0;
      return 1 - phi((0.5 - margin) / Math.max(0.5, sdGame * Math.sqrt(remaining)));
    }
    case 'spread': {
      const margin = progress.current ?? 0; // team score minus opponent
      return 1 - phi((-market.line - margin) / Math.max(0.5, sdGame * Math.sqrt(remaining)));
    }
    case 'total': {
      const total = progress.current ?? 0;
      const pace = elapsed > 0.05 ? total / elapsed : market.line;
      const expectedFinal = total + (elapsed * pace + (1 - elapsed) * market.line) * remaining;
      const sd = Math.max(0.5, sdGame * Math.sqrt(remaining));
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
  if (c >= 0.995) return '99%';
  if (c > 0 && c < 0.01) return '<1%';
  return `${Math.round(c * 100)}%`;
}
