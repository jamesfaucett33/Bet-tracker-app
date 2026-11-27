import { useEffect, useSyncExternalStore } from 'react';
import { fetchScanStatus, ScanStatus } from './cloudScan';
import { useSync } from './sync';

/**
 * One shared copy of the account's scan status (plan, scans left), so the
 * header badge, Settings and the scan screen always agree. Call
 * refreshScanStatus() after a scan.
 */
let status: ScanStatus | null = null;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshScanStatus() {
  status = await fetchScanStatus();
  emit();
}

export function useScanStatus(): ScanStatus | null {
  const sync = useSync();
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
  useEffect(() => {
    const who = sync.email ?? null;
    if (who === loadedFor) return;
    loadedFor = who;
    if (who) refreshScanStatus();
    else {
      status = null;
      emit();
    }
  }, [sync.email]);
  return sync.email ? current : null;
}

// ---- opening the plans screen from anywhere ----
let plansOpen = false;
const planListeners = new Set<() => void>();
export function openPlans() {
  plansOpen = true;
  planListeners.forEach((l) => l());
}
export function closePlans() {
  plansOpen = false;
  planListeners.forEach((l) => l());
}
export function usePlansOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      planListeners.add(l);
      return () => planListeners.delete(l);
    },
    () => plansOpen,
  );
}
