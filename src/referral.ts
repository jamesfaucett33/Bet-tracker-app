import { Platform } from 'react-native';
import { LOSS_TITLE, LossKind } from './lossKind';
import { getCloudClient } from './sync';

/**
 * "Give 25, get 25" referrals. Links look like <app>?ref=CODE. The code a
 * visitor arrived with is remembered on the device and sent with sign-up;
 * the database (supabase/setup-referrals.sql) grants both people 25 bonus
 * uploads once the new account confirms its email.
 */
export const REFERRAL_BONUS = 25;
const KEY = 'betkeeper:ref';

const store = {
  get(): string | null {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  },
  set(v: string) {
    try {
      globalThis.localStorage?.setItem(KEY, v);
    } catch {
      // private mode
    }
  },
};

/** Remember ?ref=CODE from the link that opened the app (web), and tidy the URL. */
export function captureReferral() {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return;
  const params = new URLSearchParams(location.search);
  const code = (params.get('ref') ?? '').trim().toUpperCase();
  if (/^[A-Z0-9]{4,12}$/.test(code)) {
    store.set(code);
    params.delete('ref');
    const q = params.toString();
    history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
  }
}

/** Forget the invite code once it's been used for a sign-up. */
export function clearReferral() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // private mode
  }
}

/** The invite code this device arrived with, if any. */
export function pendingReferral(): string | null {
  return store.get();
}

/** The app's address (the BetKeyper domain once it's set up). */
export function appUrl(): string {
  if (Platform.OS === 'web' && typeof location !== 'undefined') {
    return `${location.origin}${location.pathname}`;
  }
  return 'https://jamesfaucett33.github.io/Bet-tracker-app/';
}

export function inviteLink(code: string | null): string {
  return code ? `${appUrl()}?ref=${code}` : appUrl();
}

/**
 * The message that goes with a share. kind: 'win' / 'beat' for a ticket card,
 * or omitted for a plain invite.
 */
export function inviteText(
  code: string | null,
  kind?: 'win' | 'beat' | 'push' | 'open' | 'live',
  loss?: LossKind,
): string {
  // House style: a short line about the bet, then the slogan and the offer.
  const lead =
    kind === 'win'
      ? 'Cashed this one. 💰'
      : kind === 'beat'
        ? LOSS_TITLE[loss ?? 'busted'].share
        : kind === 'live'
          ? 'Sweating this one live. 🔥'
          : kind === 'open'
            ? 'Locked in. 🎟️'
            : kind === 'push'
              ? 'Pushed this one. 🤝'
              : 'I track all my bets on BetKeyper.';
  const pitch = 'Every ticket. Every book. One place. Track yours free on BetKeyper.';
  return code
    ? `${lead} ${pitch} Join with my link and we both get ${REFERRAL_BONUS} free bet uploads: ${inviteLink(code)}`
    : `${lead} ${pitch} ${appUrl()}`;
}

export interface ReferralInfo {
  code: string | null;
  friends: number; // people who joined with this code
}

/** This account's invite code and how many friends joined with it. */
export async function fetchReferral(): Promise<ReferralInfo | null> {
  const sb = getCloudClient();
  if (!sb) return null;
  const { data: session } = await sb.auth.getSession();
  const me = session.session?.user?.id;
  if (!me) return null;
  const { data: row, error } = await sb.from('referral_codes').select('code').maybeSingle();
  if (error) return { code: null, friends: 0 }; // not set up yet
  const { count } = await sb
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', me);
  return { code: (row?.code as string | undefined) ?? null, friends: count ?? 0 };
}
