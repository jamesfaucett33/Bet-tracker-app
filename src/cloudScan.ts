import { FunctionsHttpError } from '@supabase/supabase-js';
import { todayISO } from './format';
import { FIRST_MONTH_DAYS, FIRST_MONTH_SCANS, findPlan, PlanId, scansFor, scanWindow } from './plans';
import { parseScanAnswer, ScanError, ScannedBet } from './scan';
import { getCloudClient } from './sync';

/**
 * AI scanning for signed-in users on the app owner's key, through the
 * Supabase "scan-slip" function, which allows each account its plan's AI
 * scans per month (src/plans.ts, enforced in supabase/functions/scan-slip).
 */

/** Where an account stands on AI scans this month. */
export interface ScanStatus {
  plan: PlanId | 'staff';
  used: number; // AI scans used this window
  limit: number; // AI scans this window allows
  left: number; // monthly scans left + scan-pack scans left
  packLeft: number;
  resetsAt: number; // ms
  firstMonth: boolean;
}

/** True when the user is signed in, so cloud scanning can be used. */
export async function canScanInCloud(): Promise<boolean> {
  const sb = getCloudClient();
  if (!sb) return false;
  const { data } = await sb.auth.getSession();
  return !!data.session;
}

/**
 * This account's plan and scans left, worked out the same way the scan-slip
 * function enforces them. Works before setup-plans.sql is run (everyone is a
 * Rookie then).
 */
export async function fetchScanStatus(): Promise<ScanStatus | null> {
  const sb = getCloudClient();
  if (!sb) return null;
  const { data: session } = await sb.auth.getSession();
  const user = session.session?.user;
  if (!user) return null;

  const { data: sub } = await sb.from('subscriptions').select('plan, renews_at').maybeSingle();
  const active = sub && (!sub.renews_at || Date.parse(sub.renews_at) > Date.now());
  const staff = active && sub.plan === 'staff';
  const plan = staff ? 'staff' : active ? findPlan(sub.plan).id : 'rookie';
  const planScans = staff ? STAFF_SCANS : scansFor(findPlan(plan).id);
  const win = scanWindow(
    planScans,
    Date.parse(user.created_at),
    Date.now(),
    FIRST_MONTH_SCANS,
    FIRST_MONTH_DAYS,
  );
  const since = new Date(win.startMs).toISOString();
  let used = await sb
    .from('scan_usage')
    .select('id', { count: 'exact', head: true })
    .eq('paid_from', 'plan')
    .gte('created_at', since);
  const hasPaidFrom = !used.error;
  if (!hasPaidFrom)
    used = await sb.from('scan_usage').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if (used.error) return null;

  let packLeft = 0;
  const { data: packs, error: packErr } = await sb.from('scan_packs').select('scans');
  if (!packErr && hasPaidFrom) {
    const bought = (packs ?? []).reduce((n, r) => n + Number((r as { scans: number }).scans), 0);
    const { count } = await sb
      .from('scan_usage')
      .select('id', { count: 'exact', head: true })
      .eq('paid_from', 'pack');
    packLeft = Math.max(0, bought - (count ?? 0));
  }
  const n = used.count ?? 0;
  return {
    plan,
    used: n,
    limit: win.limit,
    left: Math.max(0, win.limit - n) + packLeft,
    packLeft,
    resetsAt: win.resetsMs,
    firstMonth: win.firstMonth,
  };
}

const STAFF_SCANS = 100000;

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
    if (body.error === 'limit') throw new ScanError("You've used this month's slip scans.", 'limit');
    if (body.error === 'auth') throw new ScanError('Sign in to scan with AI.', 'auth');
    throw new ScanError(body.message || 'AI scanning is unavailable right now.', 'unavailable');
  }
  return parseScanAnswer(String(data?.text ?? ''), String(data?.stop_reason ?? ''));
}
