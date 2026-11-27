import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { getCloudClient } from './sync';

/**
 * What each person wants to hear about. Used now for the in-app pop-ups, and
 * saved to their account (public.notification_prefs) so the phone
 * notification sender can respect it once the App Store app is live.
 */
export interface NotifyPrefs {
  cashed: boolean;
  busted: boolean;
  legs: boolean;
  oneAway: boolean;
  kickoff: boolean;
  recap: boolean;
  offers: boolean;
}

export const NOTIFY_OPTIONS: { key: keyof NotifyPrefs; emoji: string; label: string; sub: string; phoneOnly?: boolean }[] = [
  { key: 'cashed', emoji: '💰', label: 'A ticket cashes', sub: 'The CASHED! moment' },
  { key: 'busted', emoji: '💀', label: 'A ticket busts', sub: 'And which leg killed it' },
  { key: 'legs', emoji: '✅', label: 'Legs hit or miss', sub: '"Kelce hit! 2 of 3 legs in"' },
  { key: 'oneAway', emoji: '🔥', label: 'One leg away', sub: 'When a ticket is down to its last leg' },
  { key: 'kickoff', emoji: '🏈', label: 'Your games are starting', sub: 'A heads-up before kickoff', phoneOnly: true },
  { key: 'recap', emoji: '📊', label: 'Daily recap', sub: 'Your day: won, lost, net', phoneOnly: true },
  { key: 'offers', emoji: '🎁', label: 'Offers & news', sub: 'Promos and new features', phoneOnly: true },
];

const DEFAULTS: NotifyPrefs = {
  cashed: true,
  busted: true,
  legs: true,
  oneAway: true,
  kickoff: true,
  recap: false,
  offers: false,
};
const KEY = 'betkeeper:notify';

function load(): NotifyPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let prefs = load();
const listeners = new Set<() => void>();

export function notifyPrefs(): NotifyPrefs {
  return prefs;
}

export function useNotifyPrefs(): NotifyPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
  );
}

export function setNotifyPref(key: keyof NotifyPrefs, on: boolean) {
  prefs = { ...prefs, [key]: on };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // private mode
  }
  listeners.forEach((l) => l());
  void savePrefsToAccount();
}

/** Saves the choices to the signed-in account (quietly skips if not set up yet). */
export async function savePrefsToAccount() {
  try {
    const sb = getCloudClient();
    const { data } = (await sb?.auth.getSession()) ?? { data: null };
    const uid = data?.session?.user?.id;
    if (!sb || !uid) return;
    await sb
      .from('notification_prefs')
      .upsert({ user_id: uid, prefs, updated_at: new Date().toISOString() });
  } catch {
    // table not created yet
  }
}

// ---------- phone notifications (App Store / Play Store app) ----------

export type PushResult = 'on' | 'denied' | 'unsupported' | 'error';

/** Phone notifications work in the store app, not the website. */
export function pushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Asks permission and registers this phone with the account, so the sender
 * (see docs/NOTIFICATIONS.md) can reach it.
 */
export async function enablePush(): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported';
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const Device = require('expo-device') as typeof import('expo-device');
    const Constants = require('expo-constants').default;
    /* eslint-enable @typescript-eslint/no-require-imports */
    if (!Device.isDevice) return 'unsupported';
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    const sb = getCloudClient();
    const { data } = (await sb?.auth.getSession()) ?? { data: null };
    const uid = data?.session?.user?.id;
    if (sb && uid) {
      await sb.from('push_tokens').upsert({
        token,
        user_id: uid,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      });
      await savePrefsToAccount();
    }
    return 'on';
  } catch {
    return 'error';
  }
}
