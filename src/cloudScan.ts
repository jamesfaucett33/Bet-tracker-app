import { FunctionsHttpError } from '@supabase/supabase-js';
import { todayISO } from './format';
import { parseScanAnswer, ScanError, ScannedBet } from './scan';
import { getCloudClient } from './sync';

/**
 * AI scanning for signed-in users on the app owner's key, through the
 * Supabase "scan-slip" function, which allows each account a fixed amount of
 * free scanning (see supabase/functions/scan-slip).
 */

export interface ScanCredit {
  spent: number; // dollars used so far
  limit: number; // free allowance in dollars
  scans: number; // AI scans made
}

export const FREE_CREDIT_USD = 1.0;
/** Typical cost of one scan, used to turn dollars left into "scans left". */
const TYPICAL_SCAN_USD = 0.03;

export function scansLeft(c: ScanCredit): number {
  const avg = c.scans > 0 ? Math.max(0.001, c.spent / c.scans) : TYPICAL_SCAN_USD;
  return Math.max(0, Math.floor((c.limit - c.spent) / avg));
}

/** True when the user is signed in, so cloud scanning can be used. */
export async function canScanInCloud(): Promise<boolean> {
  const sb = getCloudClient();
  if (!sb) return false;
  const { data } = await sb.auth.getSession();
  return !!data.session;
}

export async function fetchScanCredit(): Promise<ScanCredit | null> {
  const sb = getCloudClient();
  if (!sb) return null;
  const { data: session } = await sb.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await sb.from('scan_usage').select('cost_usd');
  if (error) return null;
  const rows = (data ?? []) as { cost_usd: number }[];
  return {
    spent: rows.reduce((s, r) => s + Number(r.cost_usd), 0),
    limit: FREE_CREDIT_USD,
    scans: rows.length,
  };
}

export async function scanInCloud(image: string): Promise<ScannedBet[]> {
  const sb = getCloudClient();
  if (!sb) throw new ScanError('Cloud scanning is not set up.');
  const { data, error } = await sb.functions.invoke('scan-slip', {
    body: { image, today: todayISO() },
  });
  if (error) {
    let body: { error?: string; message?: string } = {};
    if (error instanceof FunctionsHttpError) {
      try {
        body = await error.context.json();
      } catch {
        // not JSON
      }
    }
    if (body.error === 'limit') throw new ScanError("You've used your free AI scans.", 'limit');
    if (body.error === 'auth') throw new ScanError('Sign in to scan with AI.', 'auth');
    throw new ScanError(body.message || 'AI scanning is unavailable right now.', 'unavailable');
  }
  return parseScanAnswer(String(data?.text ?? ''), String(data?.stop_reason ?? ''));
}
