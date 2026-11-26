import { betProfit, betToWin } from './odds';
import { settledDay, settledOrder } from './recap';
import { Bet } from './types';

export interface Summary {
  count: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  settledStake: number;
  profit: number;
  winRate: number; // wins / (wins + losses)
  roi: number; // profit / settled stake
  pendingStake: number;
  pendingToWin: number;
}

export function summarize(bets: Bet[]): Summary {
  const s: Summary = {
    count: bets.length,
    wins: 0,
    losses: 0,
    pushes: 0,
    pending: 0,
    settledStake: 0,
    profit: 0,
    winRate: NaN,
    roi: NaN,
    pendingStake: 0,
    pendingToWin: 0,
  };
  for (const b of bets) {
    if (b.status === 'pending') {
      s.pending++;
      s.pendingStake += b.stake;
      s.pendingToWin += betToWin(b);
      continue;
    }
    if (b.status === 'won') s.wins++;
    else if (b.status === 'lost') s.losses++;
    else s.pushes++;
    s.settledStake += b.stake;
    s.profit += betProfit(b);
  }
  if (s.wins + s.losses > 0) s.winRate = s.wins / (s.wins + s.losses);
  if (s.settledStake > 0) s.roi = s.profit / s.settledStake;
  return s;
}

export interface GroupRow {
  key: string;
  summary: Summary;
}

export function groupBy(bets: Bet[], keyFn: (b: Bet) => string): GroupRow[] {
  const groups = new Map<string, Bet[]>();
  for (const b of bets) {
    const k = keyFn(b) || 'Unknown';
    const arr = groups.get(k);
    if (arr) arr.push(b);
    else groups.set(k, [b]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, summary: summarize(list) }))
    .sort((a, b) => b.summary.count - a.summary.count);
}

/** Cumulative profit after each settled bet, oldest first. */
export function profitSeries(bets: Bet[]): number[] {
  const settled = bets.filter((b) => b.status !== 'pending').sort(settledOrder);
  let running = 0;
  return settled.map((b) => (running += betProfit(b)));
}

export type Period = 'all' | '7d' | '30d' | 'ytd';

export function filterByPeriod(bets: Bet[], period: Period): Bet[] {
  if (period === 'all') return bets;
  const now = new Date();
  let start: Date;
  if (period === 'ytd') start = new Date(now.getFullYear(), 0, 1);
  else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - (period === '7d' ? 6 : 29));
  }
  const m = `${start.getMonth() + 1}`.padStart(2, '0');
  const d = `${start.getDate()}`.padStart(2, '0');
  const startISO = `${start.getFullYear()}-${m}-${d}`;
  // Settled tickets count on the day they were decided, open ones on their bet date.
  return bets.filter((b) => settledDay(b) >= startISO);
}
