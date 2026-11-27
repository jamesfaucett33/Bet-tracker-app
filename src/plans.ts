/**
 * BetKeyper plans: how many AI scans each one includes and what it costs.
 * Manual entry and the free on-phone screenshot reader are unlimited on every
 * plan; only AI scans count. The server (supabase/functions/scan-slip) enforces
 * the same limits; scripts/build-scan-function.ts copies them from here.
 *
 * Pricing math is in docs/PRICING.md.
 */

export type PlanId = 'rookie' | 'starter' | 'pro' | 'allpro' | 'mvp';
export type Billing = 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  scans: number; // AI scans per month (Rookie: after the first month)
  monthly: number; // USD per month, billed monthly
  yearly: number; // USD per year, billed yearly
  badge?: string;
  perks: { text: string; soon?: boolean }[];
}

/** New accounts get this many AI scans in their first 30 days. */
export const FIRST_MONTH_SCANS = 25;
export const FIRST_MONTH_DAYS = 30;

/** One-time scan pack: extra scans that never expire. */
export const SCAN_PACK = { scans: 50, price: 0.99 };

const BASE_PERKS = [
  { text: 'Unlimited manual entry + free screenshot reading' },
  { text: 'Live tracking & auto-grading for every leg' },
  { text: 'Cloud backup on every device' },
];

export const PLANS: Plan[] = [
  {
    id: 'rookie',
    name: 'Rookie',
    tagline: 'Free forever',
    scans: 5,
    monthly: 0,
    yearly: 0,
    perks: [
      { text: `${FIRST_MONTH_SCANS} AI scans your first month, then 5 a month` },
      ...BASE_PERKS,
      { text: 'NFL team colors' },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For the weekend bettor',
    scans: 25,
    monthly: 0.99,
    yearly: 9.99,
    perks: [{ text: 'Everything in Rookie' }],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Scan every ticket, every week',
    scans: 100,
    monthly: 2.99,
    yearly: 24.99,
    badge: 'Most popular',
    perks: [
      { text: 'Everything in Starter' },
      { text: 'Team colors for every league', soon: true },
      { text: 'Shareable win & bad-beat cards', soon: true },
      { text: 'Vegas trip view', soon: true },
    ],
  },
  {
    id: 'allpro',
    name: 'All-Pro',
    tagline: 'For serious volume',
    scans: 400,
    monthly: 5.99,
    yearly: 49.99,
    perks: [
      { text: 'Everything in Pro' },
      { text: 'Early access to new features' },
    ],
  },
  {
    id: 'mvp',
    name: 'MVP',
    tagline: 'High roller. Every book, every day.',
    scans: 750,
    monthly: 9.99,
    yearly: 89.99,
    badge: 'Most scans',
    perks: [
      { text: 'Everything in All-Pro' },
      { text: 'Priority support' },
    ],
  },
];

export function findPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Percent saved by paying yearly instead of 12 months. */
export function yearlySavings(p: Plan): number {
  if (!p.monthly) return 0;
  return Math.round((1 - p.yearly / (p.monthly * 12)) * 100);
}

export const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * The current scan window for an account: when it started, how many AI scans
 * it allows and when it resets. The first 30 days after sign-up are one window
 * with the first-month bonus; after that, windows are calendar months (UTC).
 * Pure and self-contained (no imports): the server function embeds a copy.
 */
export function scanWindow(
  planScans: number,
  createdAtMs: number,
  nowMs: number,
  firstMonthScans: number,
  firstMonthDays: number,
): { startMs: number; resetsMs: number; limit: number; firstMonth: boolean } {
  const firstEnd = createdAtMs + firstMonthDays * 86400000;
  if (nowMs < firstEnd) {
    return {
      startMs: createdAtMs,
      resetsMs: firstEnd,
      limit: Math.max(firstMonthScans, planScans),
      firstMonth: true,
    };
  }
  const now = new Date(nowMs);
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const nextMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return {
    // Scans made in the first-month window don't count against this month.
    startMs: Math.max(monthStart, firstEnd),
    resetsMs: nextMonth,
    limit: planScans,
    firstMonth: false,
  };
}
