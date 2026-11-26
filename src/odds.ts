import { Bet } from './types';

/** American odds -> decimal odds. Returns NaN for invalid input. */
export function americanToDecimal(odds: number): number {
  if (!isValidAmerican(odds)) return NaN;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

/** Decimal odds -> American odds (rounded to a whole number). */
export function decimalToAmerican(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1) return NaN;
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

export function isValidAmerican(odds: number): boolean {
  return Number.isFinite(odds) && Math.abs(odds) >= 100;
}

/** Combined American odds for a parlay built from American-odds legs. */
export function parlayOdds(legs: number[]): number {
  if (legs.length === 0 || !legs.every(isValidAmerican)) return NaN;
  const dec = legs.reduce((acc, o) => acc * americanToDecimal(o), 1);
  return decimalToAmerican(dec);
}

/** Profit if the bet wins (not including the returned stake). */
export function potentialProfit(stake: number, odds: number): number {
  const dec = americanToDecimal(odds);
  if (!Number.isFinite(dec) || !Number.isFinite(stake)) return 0;
  return stake * (dec - 1);
}

/** Realized profit/loss of a bet. Pending and pushed bets count as 0. */
export function betProfit(bet: Bet): number {
  switch (bet.status) {
    case 'won':
      return potentialProfit(bet.stake, bet.odds);
    case 'lost':
      return -bet.stake;
    default:
      return 0;
  }
}

/** Implied win probability (0-1) from American odds. */
export function impliedProbability(odds: number): number {
  const dec = americanToDecimal(odds);
  return Number.isFinite(dec) ? 1 / dec : NaN;
}

export function formatOdds(odds: number): string {
  if (!Number.isFinite(odds)) return '—';
  return odds > 0 ? `+${odds}` : `${odds}`;
}
