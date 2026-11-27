import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../format';
import { useBetLive } from '../live';
import { betProfit, betToWin, formatOdds } from '../odds';
import { useStore } from '../store';
import { colors, profitColor, radius, space, statusColor } from '../theme';
import { Bet } from '../types';
import { BetCard } from './BetCard';
import { DotKind, dotCounts, dotForResult, LegDots } from './LegDots';

/**
 * One-line ticket row that opens into the full bet card. Used for Upcoming
 * and Past so long lists stay easy to scan.
 */
export function CompactBet({
  bet,
  variant,
  onEdit,
}: {
  bet: Bet;
  variant: 'upcoming' | 'past';
  onEdit: () => void;
}) {
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const { legGames, multiGame } = useBetLive(bet);

  if (open) {
    return (
      <View style={styles.openWrap}>
        <BetCard bet={bet} onPress={() => setOpen(false)} />
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [styles.detailsBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={styles.detailsBtnText}>Bet details ›</Text>
        </Pressable>
        <Text style={styles.lessText}>Tap the ticket to collapse ▴</Text>
      </View>
    );
  }

  const legs = bet.legs ?? [];
  // One dot per leg (a single bet is one dot): stored results, else where its game stands.
  const kinds: DotKind[] = legs.length
    ? legs.map((l, i) => dotForResult(l.result, legGames[i]?.state))
    : [
        bet.status === 'won'
          ? 'hit'
          : bet.status === 'lost'
            ? 'miss'
            : bet.status === 'push'
              ? 'push'
              : legGames[0]?.state === 'in'
                ? 'live'
                : 'toPlay',
      ];
  let sub: string;
  let right: { text: string; color: string };
  if (variant === 'past') {
    sub = [
      bet.book,
      legs.length ? `${legs.length} legs` : bet.betType,
      legs.some((l) => l.result) ? dotCounts(kinds) : '',
      `${formatOdds(bet.odds)} · ${formatAmount(bet.stake, settings)}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const profit = betProfit(bet);
    right = {
      text:
        bet.status === 'push' ? 'PUSH' : formatAmount(profit, settings, { sign: true }),
      color: bet.status === 'push' ? statusColor.push : profitColor(profit),
    };
  } else {
    // The earliest kickoff among games not started yet.
    const next = legGames
      .filter((g) => g?.state === 'pre')
      .sort((a, b) => (a!.startTime ?? 0) - (b!.startTime ?? 0))[0];
    const done = new Set(legGames.filter((g) => g?.state === 'post').map((g) => g!.eventId)).size;
    const total = new Set(legGames.filter(Boolean).map((g) => g!.eventId)).size;
    const kickoff = next
      ? done
        ? `${done} of ${total} games done · next ${next.detail}`
        : `${multiGame ? 'First game ' : ''}${next.detail}`
      : legGames.some(Boolean)
        ? ''
        : 'Game not found yet';
    sub = [kickoff, bet.book, `${formatAmount(bet.stake, settings)} @ ${formatOdds(bet.odds)}`]
      .filter(Boolean)
      .join(' · ');
    right = { text: `To win ${formatAmount(betToWin(bet), settings)}`, color: colors.accent };
  }

  return (
    <Pressable
      onPress={() => setOpen(true)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${bet.pick}, tap for details`}
    >
      <View style={[styles.stripe, { backgroundColor: statusColor[bet.status] }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.pick} numberOfLines={1}>
            {bet.pick || 'Untitled bet'}
          </Text>
          <Text style={[styles.right, { color: right.color }]}>{right.text}</Text>
        </View>
        <View style={styles.top}>
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
          <Text style={styles.chev}>▾</Text>
        </View>
        <View style={styles.dots}>
          <LegDots kinds={kinds} size={8} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: space.sm,
  },
  stripe: { width: 4 },
  body: { flex: 1, paddingVertical: 10, paddingHorizontal: space.md, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pick: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15, fontWeight: '700' },
  right: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { flex: 1, minWidth: 0, color: colors.textDim, fontSize: 12 },
  chev: { color: colors.textFaint, fontSize: 12 },
  dots: { flexDirection: 'row', gap: 4, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  openWrap: { marginBottom: space.md },
  detailsBtn: {
    marginTop: -space.xs,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailsBtnText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  lessText: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
});
