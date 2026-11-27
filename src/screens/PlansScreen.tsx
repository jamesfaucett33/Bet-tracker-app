import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Segmented } from '../components/ui';
import { ScanStatus } from '../cloudScan';
import { formatDate } from '../format';
import {
  Billing,
  findPlan,
  FIRST_MONTH_SCANS,
  Plan,
  PLANS,
  SCAN_PACK,
  usd,
  yearlySavings,
} from '../plans';
import { closePlans, useScanStatus } from '../scanStatus';
import { getCloudClient, useSync } from '../sync';
import { colors, radius, space } from '../theme';

// Most popular first, then bigger plans, then the cheapest.
const PAID = ['pro', 'allpro', 'mvp', 'starter'].map((id) => findPlan(id));
const BEST_SAVING = Math.max(...PAID.map(yearlySavings));

interface Purchase {
  key: string; // plan id or 'pack'
  title: string; // "Pro (yearly)"
  price: string; // "$24.99/yr"
  terms: string;
  billing?: Billing;
}

/** Beta: remember which plan a tester tried to buy (shows real demand). */
async function logInterest(p: Purchase) {
  try {
    const sb = getCloudClient();
    const { data } = (await sb?.auth.getSession()) ?? { data: null };
    if (!sb || !data?.session) return;
    await sb.from('upgrade_interest').insert({ plan: p.key, billing: p.billing ?? null });
  } catch {
    // table not set up yet; ignore
  }
}

/**
 * Pretend checkout for the beta: confirm, "connecting", then a friendly
 * "not available in beta" message. Swap for real in-app purchase at launch.
 */
function Checkout({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const [stage, setStage] = useState<'confirm' | 'working' | 'beta'>('confirm');
  const buy = () => {
    setStage('working');
    logInterest(purchase);
    setTimeout(() => setStage('beta'), 1600);
  };
  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={stage === 'working' ? undefined : onClose} />
      <View style={styles.sheet}>
        {stage === 'confirm' ? (
          <>
            <Text style={styles.sheetLabel}>CONFIRM PURCHASE</Text>
            <Text style={styles.sheetTitle}>{purchase.title}</Text>
            <Text style={styles.sheetPrice}>{purchase.price}</Text>
            <Text style={styles.sheetTerms}>{purchase.terms}</Text>
            <Button title="Subscribe" onPress={buy} style={{ marginTop: space.lg }} />
            <Button title="Cancel" variant="secondary" onPress={onClose} style={{ marginTop: space.sm }} />
          </>
        ) : stage === 'working' ? (
          <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.md }}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.sheetTerms}>Connecting to the App Store…</Text>
          </View>
        ) : (
          <>
            <Text style={styles.betaIcon}>🚧</Text>
            <Text style={[styles.sheetTitle, { textAlign: 'center' }]}>
              Upgrades aren't available in beta testing mode
            </Text>
            <Text style={[styles.sheetTerms, { textAlign: 'center' }]}>
              You weren't charged. Paid plans turn on when BetKeyper launches in the App Store. Thanks
              for testing, and we noted you're interested in {purchase.title.replace(/ \(.*\)$/, '')}!
            </Text>
            <Button title="Got it" onPress={onClose} style={{ marginTop: space.lg }} />
          </>
        )}
      </View>
    </View>
  );
}

function StatusCard({ status, onSignIn }: { status: ScanStatus | null; onSignIn: () => void }) {
  const sync = useSync();
  if (!sync.email) {
    return (
      <View style={styles.status}>
        <Text style={styles.statusTitle}>🎁 {FIRST_MONTH_SCANS} free slip scans your first month</Text>
        <Text style={styles.statusText}>
          Create a free account: snap a bet slip and we fill in every leg for you. Your bets are backed up too.
        </Text>
        <Button title="Sign up free" onPress={onSignIn} style={{ marginTop: space.md }} />
      </View>
    );
  }
  if (!status) {
    return (
      <View style={styles.status}>
        <Text style={styles.statusText}>Loading your plan…</Text>
      </View>
    );
  }
  const staff = status.plan === 'staff';
  const name = staff ? 'Staff' : findPlan(status.plan).name;
  const monthlyLeft = Math.max(0, status.limit - status.used);
  const pct = staff ? 0 : Math.min(1, status.used / Math.max(1, status.limit));
  const low = !staff && status.left <= Math.max(2, status.limit * 0.2);
  return (
    <View style={styles.status}>
      <View style={styles.statusTop}>
        <Text style={styles.statusLabel}>YOUR PLAN</Text>
        <Text style={styles.planPill}>{name}</Text>
      </View>
      {staff ? (
        <Text style={styles.statusTitle}>Unlimited slip scans</Text>
      ) : (
        <>
          <Text style={[styles.statusTitle, low && { color: colors.toPlay }]}>
            {monthlyLeft} of {status.limit} slip scans left
          </Text>
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                { width: `${pct * 100}%`, backgroundColor: low ? colors.toPlay : colors.money },
              ]}
            />
          </View>
          <Text style={styles.statusText}>
            {status.firstMonth ? 'First-month bonus · ' : ''}
            Resets {formatDate(new Date(status.resetsAt).toISOString().slice(0, 10))}
            {status.packLeft ? ` · +${status.packLeft} scan-pack scans` : ''}
          </Text>
        </>
      )}
    </View>
  );
}

function PlanCard({
  plan,
  billing,
  current,
  rank,
  onBuy,
}: {
  plan: Plan;
  billing: Billing;
  current: boolean;
  rank: number; // index vs the current plan: higher = upgrade
  onBuy: (p: Purchase) => void;
}) {
  const yearly = billing === 'yearly';
  const featured = plan.id === 'pro';
  const save = yearlySavings(plan);
  const price = yearly ? plan.yearly : plan.monthly;
  const perMonth = yearly ? plan.yearly / 12 : plan.monthly;
  const perScan = (perMonth / plan.scans) * 100;
  return (
    <View style={[styles.card, featured && styles.cardFeatured, current && styles.cardCurrent]}>
      {plan.badge || current ? (
        <View style={styles.badgeRow}>
          {current ? <Text style={[styles.badge, styles.badgeCurrent]}>Your plan</Text> : null}
          {plan.badge ? <Text style={styles.badge}>{plan.badge}</Text> : null}
        </View>
      ) : null}
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.tagline}>{plan.tagline}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.price}>
            {usd(price)}
            <Text style={styles.per}>{yearly ? '/yr' : '/mo'}</Text>
          </Text>
          {yearly ? (
            <Text style={styles.save}>
              {usd(perMonth)}/mo · save {save}%
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.scanRow}>
        <Text style={styles.scanBig}>{plan.scans.toLocaleString()}</Text>
        <Text style={styles.scanText}>
          slip scans a month{'\n'}
          <Text style={styles.scanSub}>about {perScan < 0.95 ? perScan.toFixed(1) : Math.round(perScan)}¢ a scan</Text>
        </Text>
      </View>
      {plan.perks.map((p) => (
        <Text key={p.text} style={styles.perk}>
          <Text style={{ color: colors.money }}>✓ </Text>
          {p.text}
          {p.soon ? <Text style={styles.soon}> SOON</Text> : null}
        </Text>
      ))}
      <Button
        title={current ? 'Current plan' : rank > 0 ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
        variant={featured && !current ? 'primary' : 'secondary'}
        disabled={current}
        onPress={() =>
          onBuy({
            key: plan.id,
            billing,
            title: `${plan.name} (${billing})`,
            price: `${usd(price)}${yearly ? '/yr' : '/mo'}`,
            terms: `${plan.scans.toLocaleString()} slip scans a month. ${
              yearly ? 'Billed yearly' : 'Billed monthly'
            }, renews automatically. Cancel anytime in your App Store settings.`,
          })
        }
        style={{ marginTop: space.md }}
      />
    </View>
  );
}

/** Where people pick a plan: status, monthly / yearly tabs, plans, scan packs. */
export function PlansScreen({ onSignIn }: { onSignIn: () => void }) {
  const status = useScanStatus();
  const [billing, setBilling] = useState<Billing>('yearly');
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const currentId = status?.plan ?? 'rookie';
  const currentIdx = PLANS.findIndex((p) => p.id === currentId);
  const rookie = PLANS[0];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Bet<Text style={{ color: colors.brand }}>Keyper</Text> Plans
        </Text>
        <Pressable onPress={closePlans} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <StatusCard
          status={status}
          onSignIn={() => {
            closePlans();
            onSignIn();
          }}
        />

        <Text style={styles.pitch}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>Unlimited bet tracking on every plan.</Text>{' '}
          A slip scan is a photo of a bet slip that we read for you — every leg filled in. Plans add
          more slip scans.
        </Text>

        <Segmented<Billing>
          value={billing}
          onChange={setBilling}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: `Yearly · up to ${BEST_SAVING}% off` },
          ]}
        />

        {PAID.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            billing={billing}
            current={p.id === currentId}
            rank={PLANS.indexOf(p) - currentIdx}
            onBuy={setPurchase}
          />
        ))}

        {/* Scan pack */}
        <View style={styles.pack}>
          <View style={{ flex: 1 }}>
            <Text style={styles.packTitle}>⚡ Slip scan pack</Text>
            <Text style={styles.packText}>
              {SCAN_PACK.scans} extra slip scans · one-time · never expire. Great for a big weekend.
            </Text>
          </View>
          <Button
            title={usd(SCAN_PACK.price)}
            variant="secondary"
            onPress={() =>
              setPurchase({
                key: 'pack',
                title: 'Slip scan pack',
                price: `${usd(SCAN_PACK.price)} one-time`,
                terms: `${SCAN_PACK.scans} extra slip scans that never expire. Charged once.`,
              })
            }
            style={{ paddingHorizontal: space.lg }}
          />
        </View>

        {/* Free plan */}
        <View style={[styles.card, currentId === 'rookie' && styles.cardCurrent]}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{rookie.name}</Text>
              <Text style={styles.tagline}>{rookie.tagline}</Text>
            </View>
            <Text style={styles.price}>Free</Text>
          </View>
          {rookie.perks.map((p) => (
            <Text key={p.text} style={styles.perk}>
              <Text style={{ color: colors.money }}>✓ </Text>
              {p.text}
            </Text>
          ))}
        </View>

        <Text style={styles.fine}>
          Slip scans reset every month and don't roll over; scan-pack scans never expire. Entering
          bets by hand is always unlimited, and clear screenshots your phone reads on its own don't
          use a slip scan. Subscriptions renew automatically and can
          be cancelled anytime in your App Store settings. BetKeyper tracks bets you've placed
          elsewhere; it does not take wagers. 21+.
        </Text>
      </ScrollView>
      {purchase ? <Checkout purchase={purchase} onClose={() => setPurchase(null)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.brand + '55',
  },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '900' },
  close: { color: colors.textDim, fontSize: 22, fontWeight: '700', padding: 4 },
  container: { padding: space.lg, paddingBottom: 60, gap: space.md },
  status: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.brand,
    padding: space.lg,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { color: colors.sky, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  planPill: {
    color: colors.bg,
    backgroundColor: colors.brand,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  statusTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: space.sm },
  statusText: { color: colors.textDim, fontSize: 13, marginTop: 6, lineHeight: 18 },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    marginTop: space.sm,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  pitch: { color: colors.textDim, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
  },
  cardFeatured: { borderColor: colors.brand, borderWidth: 2.5 },
  cardCurrent: { borderColor: colors.sky },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: space.sm },
  badge: {
    alignSelf: 'flex-start',
    color: colors.bg,
    backgroundColor: colors.brand,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  badgeCurrent: { backgroundColor: colors.sky },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  planName: { color: colors.text, fontSize: 22, fontWeight: '900' },
  tagline: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  price: { color: colors.text, fontSize: 24, fontWeight: '900' },
  per: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  save: { color: colors.money, fontSize: 12, fontWeight: '800', marginTop: 2 },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginVertical: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  scanBig: { color: colors.brand, fontSize: 30, fontWeight: '900' },
  scanText: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  scanSub: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  perk: { color: colors.text, fontSize: 14, lineHeight: 22 },
  soon: { color: colors.sky, fontSize: 10, fontWeight: '900' },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: space.lg,
  },
  packTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  packText: { color: colors.textDim, fontSize: 13, marginTop: 2, lineHeight: 18 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.xl,
    paddingBottom: 40,
  },
  sheetLabel: { color: colors.sky, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: space.sm },
  sheetPrice: { color: colors.money, fontSize: 30, fontWeight: '900', marginTop: 4 },
  sheetTerms: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginTop: space.sm },
  betaIcon: { fontSize: 44, textAlign: 'center' },
  fine: { color: colors.textFaint, fontSize: 11, lineHeight: 16, marginTop: space.sm },
});
