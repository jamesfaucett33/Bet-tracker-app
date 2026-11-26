import { Bet } from './types';

/**
 * Double-scan protection. Two bets are the same ticket when:
 * - both show a ticket number and the numbers match, or
 * - at least one has no readable ticket number and everything else matches:
 *   book, date, wager, odds and the picks/legs (in any order).
 * Two different printed ticket numbers are never treated as the same ticket,
 * so placing the same bet twice on two real tickets still works.
 */

/** Ticket number from a bet's notes, digits only ("Ticket 087001-2591-..." -> "0870012591..."). */
export function ticketDigits(bet: Pick<Bet, 'notes'>): string | null {
  const m = /ticket\s*#?\s*([\d-]{10,})/i.exec(bet.notes ?? '');
  return m ? m[1].replace(/-/g, '') : null;
}

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9.+-]/g, '');

function fingerprint(b: Pick<Bet, 'book' | 'date' | 'stake' | 'odds' | 'pick' | 'legs'>): string {
  const picks = b.legs?.length
    ? b.legs.map((l) => clean(l.pick)).sort().join('|')
    : clean(b.pick);
  return [clean(b.book), b.date, Math.round(b.stake * 100), b.odds, picks].join('#');
}

export function sameTicket(a: Bet, b: Bet): boolean {
  const ta = ticketDigits(a);
  const tb = ticketDigits(b);
  if (ta && tb) return ta === tb;
  return fingerprint(a) === fingerprint(b);
}

/** The logged bet this one duplicates, if any (ignoring the bet being edited). */
export function findDuplicate(candidate: Bet, existing: Bet[], editingId?: string): Bet | null {
  return existing.find((b) => b.id !== editingId && b.id !== candidate.id && sameTicket(candidate, b)) ?? null;
}

export function duplicateMessage(d: Bet): string {
  const ticket = ticketDigits(d);
  return `This ticket is already in your bets${ticket ? ` (ticket ${ticket})` : ''}: "${d.pick}". It can't be saved twice.`;
}
