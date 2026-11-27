import { Bet } from './types';

/**
 * What kind of loss a ticket is:
 * - 'badBeat': so close. Every leg hit except one.
 * - 'badBet': nothing hit. 0 for everything.
 * - 'busted': anything in between (and straight bets that lost).
 */
export type LossKind = 'badBeat' | 'badBet' | 'busted';

export function lossKind(bet: Bet, legNow?: (string | undefined)[]): LossKind {
  const legs = bet.legs ?? [];
  if (legs.length < 2) return 'busted';
  const res = legs.map((l, i) => l.result ?? legNow?.[i]);
  const hits = res.filter((r) => r === 'hit').length;
  const misses = res.filter((r) => r === 'miss').length;
  if (misses === 1 && hits === legs.length - 1) return 'badBeat';
  if (hits === 0 && misses === legs.length) return 'badBet';
  return 'busted';
}

const JOKES: Record<LossKind, string[]> = {
  badBeat: [
    'One leg. ONE.',
    'So close you could taste it.',
    'The sportsbook says thanks for the donation.',
    "That's not a loss, that's a tragedy.",
    'Somebody check on this person.',
  ],
  badBet: [
    'Not a single leg. Honestly impressive.',
    'A coin flip would have done better.',
    "Bold strategy. Didn't work.",
    "Let's never speak of this again.",
    'The fade of the year starts here.',
  ],
  busted: ['Shake it off. Next slip.', 'Tomorrow is a new card.', "Can't win 'em all.", 'On to the next one.'],
};

export const LOSS_TITLE: Record<LossKind, { title: string; emoji: string; share: string }> = {
  badBeat: { title: 'BAD BEAT', emoji: '😩', share: 'Check out this bad beat 😩' },
  badBet: { title: 'BAD BET', emoji: '🤡', share: 'Check out this bad bet 🤡' },
  busted: { title: 'BUSTED', emoji: '💀', share: 'Took an L on this one 💀' },
};

/** A joke for this ticket, the same every time (card, pop-up and share match). */
export function lossJoke(kind: LossKind, bet: Bet): string {
  const list = JOKES[kind];
  let h = 0;
  for (const c of bet.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const legs = bet.legs ?? [];
  const joke = list[h % list.length];
  return kind === 'badBet' && legs.length > 1 && h % 3 === 0 ? `0 for ${legs.length}. ${joke}` : joke;
}
