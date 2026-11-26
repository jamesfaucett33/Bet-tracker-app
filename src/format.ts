import { Settings } from './types';

export function formatMoney(n: number, opts: { sign?: boolean } = {}): string {
  const str = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n < -0.004) return `-$${str}`;
  if (opts.sign && n > 0.004) return `+$${str}`;
  return `$${str}`;
}

/** Formats a dollar amount as dollars or units depending on settings. */
export function formatAmount(n: number, settings: Settings, opts: { sign?: boolean } = {}): string {
  if (settings.showUnits && settings.unitSize > 0) {
    const u = n / settings.unitSize;
    const str = Math.abs(u).toFixed(2);
    if (u < -0.004) return `-${str}u`;
    if (opts.sign && u > 0.004) return `+${str}u`;
    return `${str}u`;
  }
  return formatMoney(n, opts);
}

export function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isValidISODate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

export function formatDate(iso: string): string {
  if (!isValidISODate(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Parses a user-typed number, tolerating "$", "," and a leading "+". */
export function parseNumber(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '').replace(/^\+/, '');
  if (cleaned === '' || cleaned === '-') return NaN;
  return Number(cleaned);
}
