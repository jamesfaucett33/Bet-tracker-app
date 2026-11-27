import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { useStore } from './store';
import { Bet } from './types';

/**
 * Cloud sync with Supabase: sign in with email + password and every bet is
 * saved to your account, so the same bets show up in every browser, the
 * Home Screen app and new phones. Each bet is one row ({ id, data, updated_at,
 * deleted }) protected by row-level security (only its owner can read it).
 *
 * Merging is per bet: the most recent edit wins; deletions are kept as
 * "deleted" rows so they spread to other devices too.
 */

// Public project settings (safe to ship in the app; access is enforced by
// row-level security on the server).
export const SUPABASE_URL = 'https://zielynjbewfhoerigbzm.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_0QBt8O7HJwK4IaMurrxX3w_t9ISCUhE';

export const cloudConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

let client: SupabaseClient | null = null;
/** Extra details collected when someone creates an account. */
export interface SignUpProfile {
  full_name: string;
  phone?: string;
  marketing_email: boolean;
  marketing_sms: boolean;
}

export function getCloudClient(): SupabaseClient | null {
  return getClient();
}

function getClient(): SupabaseClient | null {
  if (!cloudConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}

interface Row {
  id: string;
  data: Bet;
  updated_at: string;
  deleted: boolean;
}

type SyncState = 'off' | 'idle' | 'syncing' | 'error';

interface SyncCtx {
  configured: boolean;
  email: string | null;
  state: SyncState;
  lastSync: number | null;
  error: string | null;
  count: number;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, profile?: SignUpProfile) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Set when this device was signed out because the password changed elsewhere. */
  signedOutNote: string | null;
  /** Sets a new password for the signed-in account; returns an error message or null. */
  changePassword: (password: string) => Promise<string | null>;
  syncNow: () => void;
}

const SyncContext = createContext<SyncCtx | null>(null);

const ts = (b: Bet) => b.updatedAt ?? 0;
const syncedKey = (userId: string) => `bettracker:synced:${userId}`;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { loaded, bets, applyRemote } = useStore();
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<SyncState>('off');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  // id -> updatedAt last confirmed in the cloud (so we only push changes).
  const synced = useRef<Record<string, number>>({});
  const betsRef = useRef(bets);
  betsRef.current = bets;
  const busy = useRef(false);
  const pullDone = useRef(false);
  /** Why this device was signed out, shown on the sign-in form. */
  const [signedOutNote, setSignedOutNote] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;

  // ---- auth ----
  useEffect(() => {
    const sb = getClient();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const saveSynced = useCallback(async () => {
    if (userId) await AsyncStorage.setItem(syncedKey(userId), JSON.stringify(synced.current));
  }, [userId]);

  // ---- push local changes ----
  const push = useCallback(async () => {
    const sb = getClient();
    if (!sb || !userId || !pullDone.current) return;
    const current = betsRef.current;
    const currentIds = new Set(current.map((b) => b.id));
    const upserts = current.filter(
      (b) => synced.current[b.id] === undefined || ts(b) > synced.current[b.id],
    );
    const deletes = Object.keys(synced.current).filter((id) => !currentIds.has(id));
    if (!upserts.length && !deletes.length) return;
    const now = Date.now();
    const rows = [
      ...upserts.map((b) => ({
        id: b.id,
        user_id: userId,
        data: b,
        updated_at: new Date(ts(b) || now).toISOString(),
        deleted: false,
      })),
      ...deletes.map((id) => ({
        id,
        user_id: userId,
        data: {},
        updated_at: new Date(now).toISOString(),
        deleted: true,
      })),
    ];
    const { error: err } = await sb.from('bets').upsert(rows, { onConflict: 'user_id,id' });
    if (err) throw new Error(err.message);
    upserts.forEach((b) => (synced.current[b.id] = ts(b)));
    deletes.forEach((id) => delete synced.current[id]);
    await saveSynced();
  }, [userId, saveSynced]);

  // ---- full sync: pull, merge (newest edit wins), push ----
  const runSync = useCallback(async () => {
    const sb = getClient();
    if (!sb || !userId || busy.current) return;
    busy.current = true;
    setState('syncing');
    try {
      // Was this device signed out elsewhere (e.g. the password was changed on
      // another device)? Only a definite "no" from the server counts; being
      // offline never signs you out.
      const { error: who } = await sb.auth.getUser();
      const status = (who as { status?: number } | null)?.status ?? 0;
      if (who && (status === 401 || status === 403)) {
        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
        pullDone.current = false;
        synced.current = {};
        setLastSync(null);
        setSignedOutNote(
          'You were signed out because your password was changed. Sign in with the new password.',
        );
        return;
      }
      if (!pullDone.current) {
        const raw = await AsyncStorage.getItem(syncedKey(userId));
        synced.current = raw ? JSON.parse(raw) : {};
      }
      const { data, error: err } = await sb.from('bets').select('id,data,updated_at,deleted');
      if (err) throw new Error(err.message);
      const rows = (data ?? []) as Row[];
      const local = new Map(betsRef.current.map((b) => [b.id, b]));
      const upserts: Bet[] = [];
      const deletedIds: string[] = [];
      for (const r of rows) {
        const remoteTs = Date.parse(r.updated_at) || 0;
        const l = local.get(r.id);
        if (r.deleted) {
          if (l && ts(l) <= remoteTs) deletedIds.push(r.id);
          delete synced.current[r.id];
          continue;
        }
        const wasDeletedHere =
          !l && synced.current[r.id] !== undefined && remoteTs <= synced.current[r.id];
        if (wasDeletedHere) continue; // push() sends the deletion
        if (!l || remoteTs > ts(l)) upserts.push({ ...r.data, updatedAt: remoteTs });
        if (!l || remoteTs >= ts(l)) synced.current[r.id] = remoteTs;
      }
      applyRemote(upserts, deletedIds);
      // Let the merged bets land before pushing what's newer locally.
      betsRef.current = mergePreview(betsRef.current, upserts, deletedIds);
      pullDone.current = true;
      await push();
      await saveSynced();
      setCount(betsRef.current.length);
      setLastSync(Date.now());
      setError(null);
      setState('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
      setState('error');
    } finally {
      busy.current = false;
    }
  }, [userId, applyRemote, push, saveSynced]);

  // Sync on sign-in / app start, when the app comes back, and every minute.
  useEffect(() => {
    if (!userId || !loaded) {
      pullDone.current = false;
      setState(cloudConfigured() ? 'idle' : 'off');
      return;
    }
    runSync();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && runSync());
    const timer = setInterval(runSync, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [userId, loaded, runSync]);

  // Push local edits shortly after they happen.
  useEffect(() => {
    if (!userId || !pullDone.current) return;
    const t = setTimeout(() => {
      if (busy.current) return;
      busy.current = true;
      setState('syncing');
      push()
        .then(() => {
          setCount(betsRef.current.length);
          setLastSync(Date.now());
          setError(null);
          setState('idle');
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : 'Sync failed');
          setState('error');
        })
        .finally(() => (busy.current = false));
    }, 1200);
    return () => clearTimeout(t);
  }, [bets, userId, push]);

  // ---- account actions ----
  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getClient();
    if (!sb) return 'Cloud sync is not set up yet.';
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (!err) setSignedOutNote(null);
    return err ? friendlyAuthError(err.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, profile?: SignUpProfile) => {
    const sb = getClient();
    if (!sb) return 'Cloud sync is not set up yet.';
    const redirect =
      Platform.OS === 'web'
        ? `${globalThis.location.origin}${globalThis.location.pathname}`
        : undefined;
    const { data, error: err } = await sb.auth.signUp({
      email: email.trim(),
      password,
      // Name, phone and marketing choices are saved on the account
      // (Authentication -> Users -> user metadata).
      options: {
        emailRedirectTo: redirect,
        data: profile ? { ...profile, consent_at: new Date().toISOString() } : undefined,
      },
    });
    if (err) return friendlyAuthError(err.message);
    if (!data.session) return 'CHECK_EMAIL'; // email confirmation is required before signing in
    return null;
  }, []);

  const changePassword = useCallback(async (password: string) => {
    const sb = getClient();
    if (!sb) return 'Cloud sync is not set up yet.';
    const { error: err } = await sb.auth.updateUser({ password });
    if (err) return friendlyAuthError(err.message);
    // Sign every other phone / browser out of this account; this one stays in.
    await sb.auth.signOut({ scope: 'others' }).catch(() => {});
    return null;
  }, []);

  const signOut = useCallback(async () => {
    const sb = getClient();
    if (sb) await sb.auth.signOut();
    pullDone.current = false;
    synced.current = {};
    setLastSync(null);
  }, []);

  const value = useMemo<SyncCtx>(
    () => ({
      configured: cloudConfigured(),
      email: session?.user?.email ?? null,
      state,
      lastSync,
      error,
      count,
      signIn,
      signUp,
      changePassword,
      signOut,
      signedOutNote,
      syncNow: () => {
        runSync();
      },
    }),
    [session, state, lastSync, error, count, signIn, signUp, changePassword, signOut, runSync, signedOutNote],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function mergePreview(bets: Bet[], upserts: Bet[], deletedIds: string[]): Bet[] {
  const byId = new Map(bets.map((b) => [b.id, b]));
  deletedIds.forEach((id) => byId.delete(id));
  upserts.forEach((b) => byId.set(b.id, b));
  return [...byId.values()];
}

function friendlyAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(msg))
    return 'Confirm your email first — tap the link in the email we sent, then sign in.';
  if (/already registered/i.test(msg))
    return 'That email already has an account — sign in instead.';
  if (/password/i.test(msg) && /6/.test(msg)) return 'Use a password with at least 6 characters.';
  return msg;
}

export function useSync(): SyncCtx {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}
