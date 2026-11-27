import { Pressable, StyleSheet, Text } from 'react-native';
import { BETA_SCANS, findPlan, FIRST_MONTH_SCANS } from '../plans';
import { openPlans, useScanStatus } from '../scanStatus';
import { useSync } from '../sync';
import { colors, radius } from '../theme';

/**
 * Header corner button: AI scans left and the plan, with an Upgrade call to
 * action. Opens the plans screen.
 */
export function ScanBadge() {
  const sync = useSync();
  const status = useScanStatus();

  let top: string;
  let cta: string;
  let low = false;
  // The corner always sells plans, even if this device has its own AI key.
  if (!sync.email) {
    top = 'Free uploads';
    cta = `Get ${Math.max(BETA_SCANS, FIRST_MONTH_SCANS)}`;
  } else if (!status) {
    top = '… uploads';
    cta = 'Plans';
  } else if (status.plan === 'staff') {
    top = 'Unlimited';
    cta = 'Staff';
  } else {
    const n = status.left;
    low = n <= Math.max(2, status.limit * 0.2);
    top = `${n} upload${n === 1 ? '' : 's'} left`;
    cta = status.plan === 'mvp' ? 'MVP' : status.plan === 'rookie' ? 'Upgrade' : `${findPlan(status.plan).name} ↑`;
  }

  return (
    <Pressable
      onPress={openPlans}
      style={({ pressed }) => [styles.wrap, low && styles.wrapLow, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`${top}. ${cta}. Open plans`}
      hitSlop={6}
    >
      <Text style={[styles.top, low && { color: colors.toPlay }]} numberOfLines={1}>
        ⚡ {top}
      </Text>
      <Text style={[styles.cta, low && styles.ctaLow]} numberOfLines={1}>
        {cta}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 84,
  },
  wrapLow: { borderColor: colors.toPlay },
  top: { color: colors.text, fontSize: 11, fontWeight: '800' },
  cta: {
    color: colors.bg,
    backgroundColor: colors.brand,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  ctaLow: { backgroundColor: colors.toPlay },
});
