import { todayISO } from './format';
import { betProfit } from './odds';
import { summarize, Summary } from './stats';
import { Bet, Trip } from './types';

/** Bets placed during a trip (by the day they were placed). */
export function tripBets(trip: Trip, bets: Bet[]): Bet[] {
  return bets
    .filter((b) => b.date >= trip.start && b.date <= trip.end)
    .sort((a, b) => (b.date === a.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1));
}

export interface TripStats extends Summary {
  wagered: number;
  biggest: Bet | null;
}

export function tripStats(trip: Trip, bets: Bet[]): TripStats {
  const list = tripBets(trip, bets);
  const s = summarize(list);
  const won = list.filter((b) => b.status === 'won');
  const biggest = won.length
    ? won.reduce((m, b) => (betProfit(b) > betProfit(m) ? b : m), won[0])
    : null;
  return { ...s, wagered: list.reduce((n, b) => n + b.stake, 0), biggest };
}

/** The trip happening today, if any. */
export function activeTrip(trips: Trip[] | undefined): Trip | null {
  const t = todayISO();
  return (trips ?? []).find((x) => x.start <= t && t <= x.end) ?? null;
}
