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
          if (Array.isArray(data.bets)) setBets(sortBets(data.bets.filter(isBet)));
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

  const saveBet = useCallback((bet: Bet) => {
    setBets((prev) => {
      const exists = prev.some((b) => b.id === bet.id);
      return sortBets(exists ? prev.map((b) => (b.id === bet.id ? bet : b)) : [...prev, bet]);
    });
  }, []);

  const deleteBet = useCallback((id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const setStatus = useCallback((id: string, status: BetStatus) => {
    setBets((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const exportData = useCallback(
    () => JSON.stringify({ version: 1, bets, settings } satisfies PersistedData, null, 2),
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
        valid.forEach((b) => byId.set(b.id, b));
        return sortBets([...byId.values()]);
      });
      if (!Array.isArray(data) && data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
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
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
