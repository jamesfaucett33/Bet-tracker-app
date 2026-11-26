import { americanToDecimal, betProfit, betToWin, isValidAmerican } from './odds';
import { Bet } from './types';

/** Dashboard recap: everything here is about decided tickets, by the day they were decided. */

function localISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The day a ticket was decided (falls back to the day it was placed). */
export function settledDay(b: Bet): string {
  return b.settledAt ? localISO(new Date(b.settledAt)) : b.date;
}

export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localISO(d);
}

/** Oldest decided first: by decided day, then exact time when known, then entry order. */
export const settledOrder = (a: Bet, b: Bet) =>
  (settledDay(a) < settledDay(b) ? -1 : settledDay(a) > settledDay(b) ? 1 : 0) ||
  (a.settledAt ?? 0) - (b.settledAt ?? 0) ||
  a.createdAt - b.createdAt;

/** Settled tickets, oldest decided first. */
export function settled(bets: Bet[]): Bet[] {
  return bets.filter((b) => b.status !== 'pending').sort(settledOrder);
}

export interface Tally {
  profit: number;
  wins: number;
  losses: number;
  pushes: number;
  count: number;
}

export function tally(bets: Bet[], fromISO?: string): Tally {
  const t: Tally = { profit: 0, wins: 0, losses: 0, pushes: 0, count: 0 };
  for (const b of bets) {
    if (b.status === 'pending') continue;
    if (fromISO && settledDay(b) < fromISO) continue;
    t.count++;
    t.profit += betProfit(b);
    if (b.status === 'won') t.wins++;
    else if (b.status === 'lost') t.losses++;
    else t.pushes++;
  }
  return t;
}

/** Current run of wins or losses (pushes don't break or extend it), and the best win run. */
export function streaks(bets: Bet[]): { current: { kind: 'W' | 'L'; n: number } | null; bestWin: number } {
  const list = settled(bets).filter((b) => b.status !== 'push');
  let bestWin = 0;
  let run = 0;
  for (const b of list) {
    run = b.status === 'won' ? run + 1 : 0;
    bestWin = Math.max(bestWin, run);
  }
  const last = list[list.length - 1];
  if (!last) return { current: null, bestWin };
  let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i].status === last.status; i--) n++;
  return { current: { kind: last.status === 'won' ? 'W' : 'L', n }, bestWin };
}

export function recentWins(bets: Bet[], n = 5): Bet[] {
  return settled(bets)
    .filter((b) => b.status === 'won')
    .reverse()
    .slice(0, n);
}

export interface CloseCall {
  bet: Bet;
  missed: string; // the leg that busted it
  wouldHavePaid: number;
  hits: number;
  legs: number;
}

/** Parlays that lost by exactly one leg (every other leg hit), most painful first. */
export function closeCalls(bets: Bet[], fromISO: string, n = 4): CloseCall[] {
  const out: CloseCall[] = [];
  for (const b of bets) {
    if (b.status !== 'lost' || !b.legs || b.legs.length < 2) continue;
    if (settledDay(b) < fromISO) continue;
    const misses = b.legs.filter((l) => l.result === 'miss');
    const hits = b.legs.filter((l) => l.result === 'hit').length;
    const neutral = b.legs.filter((l) => l.result === 'push' || l.result === 'void');
    // Lost by exactly one leg; pushed / voided legs would have dropped off the ticket.
    if (misses.length !== 1 || hits + neutral.length !== b.legs.length - 1) continue;
    const kept = b.legs.filter((l) => !neutral.includes(l));
    const legOdds = kept.map((l) => l.odds);
    const paid =
      neutral.length && legOdds.every((o) => o !== null && isValidAmerican(o))
        ? b.stake * legOdds.reduce<number>((acc, o) => acc * americanToDecimal(o as number), 1)
        : b.stake + betToWin(b);
    out.push({ bet: b, missed: misses[0].pick, wouldHavePaid: paid, hits, legs: b.legs.length });
  }
  return out.sort((a, b) => b.wouldHavePaid - a.wouldHavePaid).slice(0, n);
}

/** Biggest losses decided since a day, worst first. */
export function worstBeats(bets: Bet[], fromISO: string, n = 3): Bet[] {
  return bets
    .filter((b) => b.status === 'lost' && settledDay(b) >= fromISO)
    .sort((a, b) => b.stake - a.stake || betToWin(b) - betToWin(a))
    .slice(0, n);
}

/** Best single hits: biggest profit, and longest odds cashed. */
export function bestHits(bets: Bet[], fromISO?: string): { biggest: Bet | null; longest: Bet | null } {
  const won = bets.filter((b) => b.status === 'won' && (!fromISO || settledDay(b) >= fromISO));
  const biggest = won.reduce<Bet | null>((m, b) => (!m || betProfit(b) > betProfit(m) ? b : m), null);
  const longest = won.reduce<Bet | null>((m, b) => (!m || b.odds > m.odds ? b : m), null);
  return { biggest, longest };
}

/** A one-line vibe check for the week. */
export function headline(week: Tally, today: Tally, money: (n: number) => string): { emoji: string; text: string } {
  if (today.count && today.profit > 0)
    return { emoji: '🔥', text: `Cooking today: ${money(today.profit)} and counting` };
  if (!week.count) return { emoji: '🎟️', text: 'Fresh week, clean slate. Let’s get some tickets in.' };
  if (week.profit > 0 && week.wins >= 3)
    return { emoji: '🚀', text: `Heater! Up ${money(week.profit)} over the last 7 days` };
  if (week.profit > 0) return { emoji: '😎', text: `In the green: up ${money(week.profit)} this week` };
  if (week.profit === 0) return { emoji: '😐', text: 'Dead even this week. Next ticket breaks the tie.' };
  if (week.losses >= 3 && week.wins === 0)
    return { emoji: '🧊', text: 'Ice cold week. The bounce-back is coming.' };
  return { emoji: '💪', text: `Down ${money(-week.profit)} this week. Plenty of games left.` };
}
