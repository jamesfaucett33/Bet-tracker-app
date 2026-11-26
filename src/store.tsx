import { potentialProfit } from './odds';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Bet, BetStatus, DEFAULT_SETTINGS, Settings } from './types';

const STORAGE_KEY = 'bettracker:v1';

/**
 * A ticket's winning amount is fixed: older tickets saved without one get the
 * amount they already showed (from their odds) locked in once.
 */
function fixToWin(b: Bet): Bet {
  if (b.toWin && b.toWin > 0) return b;
  const amount = Math.round(potentialProfit(b.stake, b.odds) * 100) / 100;
  return amount > 0 ? { ...b, toWin: amount } : b;
}

/** Remembers when a ticket was decided, for "today" / "this week" recaps. */
function stampSettled(old: Bet | undefined, next: Bet): Bet {
  if (next.status === 'pending') {
    const { settledAt: _drop, ...rest } = next;
    return rest;
  }
  if (next.settledAt) return next;
  // Logged already settled (an old ticket): its own date is the best guess.
  if (!old) return next;
  if (old.status !== 'pending') return old.settledAt ? { ...next, settledAt: old.settledAt } : next;
  return { ...next, settledAt: Date.now() };
}

interface PersistedData {
  version: 1;
  bets: Bet[];
  settings: Settings;
}

interface Store {
  loaded: boolean;
  bets: Bet[];
  settings: Settings;
  saveBet: (bet: Bet) => void;
  deleteBet: (id: string) => void;
  setStatus: (id: string, status: BetStatus) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  exportData: () => string;
  importData: (json: string) => { ok: true; count: number } | { ok: false; error: string };
  clearAll: () => void;
  /** Deletes every ticket (here and in your account) but keeps settings. */
  clearBets: () => void;
  /** Apply bets from cloud sync without re-stamping them. */
  applyRemote: (upserts: Bet[], deletedIds: string[]) => void;
}

const StoreContext = createContext<Store | null>(null);

function sortBets(bets: Bet[]): Bet[] {
  return [...bets].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
}

function isBet(x: unknown): x is Bet {
  if (!x || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  return (
    typeof b.id === 'string' &&
    typeof b.date === 'string' &&
    typeof b.odds === 'number' &&
    typeof b.stake === 'number' &&
    typeof b.status === 'string' &&
    ['pending', 'won', 'lost', 'push'].includes(b.status as string)
  );
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [bets, setBets] = useState<Bet[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const skipFirstSave = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw) as Partial<PersistedData>;
          if (Array.isArray(data.bets))
            setBets(sortBets(data.bets.filter(isBet).map(fixToWin)));
          if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        }
      } catch (e) {
        console.warn('Failed to load saved bets', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const data: PersistedData = { version: 1, bets, settings };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((e) =>
      console.warn('Failed to save bets', e),
    );
  }, [bets, settings, loaded]);

  const saveBet = useCallback((input: Bet) => {
    setBets((prev) => {
      const old = prev.find((b) => b.id === input.id);
      const bet = { ...stampSettled(old, input), updatedAt: Date.now() };
      const exists = !!old;
      return sortBets(exists ? prev.map((b) => (b.id === bet.id ? bet : b)) : [...prev, bet]);
    });
  }, []);

  const deleteBet = useCallback((id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const setStatus = useCallback((id: string, status: BetStatus) => {
    setBets((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...stampSettled(b, { ...b, status }),
              settledBy: undefined,
              updatedAt: Date.now(),
            }
          : b,
      ),
    );
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const exportData = useCallback(
    () =>
      JSON.stringify(
        // Never put the API key in a backup file.
        {
          version: 1,
          bets,
          settings: { ...settings, anthropicApiKey: '' },
        } satisfies PersistedData,
        null,
        2,
      ),
    [bets, settings],
  );

  const importData = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      const list: unknown[] = Array.isArray(data) ? data : data?.bets;
      if (!Array.isArray(list)) return { ok: false as const, error: 'No bets found in that data.' };
      const valid = list.filter(isBet);
      if (valid.length === 0 && list.length > 0)
        return { ok: false as const, error: 'None of the bets in that data were valid.' };
      setBets((prev) => {
        const byId = new Map(prev.map((b) => [b.id, b]));
        const now = Date.now();
        valid.forEach((b) => byId.set(b.id, { ...b, updatedAt: now }));
        return sortBets([...byId.values()]);
      });
      if (!Array.isArray(data) && data.settings) {
        // Keep this device's API key; backups never carry one.
        const { anthropicApiKey: _ignored, ...imported } = data.settings as Partial<Settings>;
        setSettings((prev) => ({ ...prev, ...imported }));
      }
      return { ok: true as const, count: valid.length };
    } catch {
      return { ok: false as const, error: "That doesn't look like valid backup data." };
    }
  }, []);

  const clearAll = useCallback(() => {
    setBets([]);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const clearBets = useCallback(() => setBets([]), []);

  const applyRemote = useCallback((upserts: Bet[], deletedIds: string[]) => {
    if (!upserts.length && !deletedIds.length) return;
    setBets((prev) => {
      const byId = new Map(prev.map((b) => [b.id, b]));
      deletedIds.forEach((id) => byId.delete(id));
      upserts.filter(isBet).forEach((b) => byId.set(b.id, b));
      return sortBets([...byId.values()]);
    });
  }, []);

  const value = useMemo(
    () => ({
      loaded,
      bets,
      settings,
      saveBet,
      deleteBet,
      setStatus,
      updateSettings,
      exportData,
      importData,
      clearAll,
      clearBets,
      applyRemote,
    }),
    [
      loaded,
      bets,
      settings,
      saveBet,
      deleteBet,
      setStatus,
      updateSettings,
      exportData,
      importData,
      clearAll,
      clearBets,
      applyRemote,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
