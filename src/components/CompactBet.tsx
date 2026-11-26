import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../format';
import { useBetLive } from '../live';
import { betProfit, betToWin, formatOdds } from '../odds';
import { useStore } from '../store';
import { colors, profitColor, radius, space, statusColor } from '../theme';
import { Bet } from '../types';
import { BetCard } from './BetCard';

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
      <View>
        <BetCard bet={bet} onPress={onEdit} />
        <Pressable
          onPress={() => setOpen(false)}
          style={styles.less}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.lessText}>▲ Show less · tap the card to edit</Text>
        </Pressable>
      </View>
    );
  }

  const legs = bet.legs ?? [];
  let sub: string;
  let right: { text: string; color: string };
  if (variant === 'past') {
    const graded = legs.filter((l) => l.result);
    const hits = graded.filter((l) => l.result === 'hit').length;
    sub = [
      bet.book,
      legs.length ? `${legs.length} legs` : bet.betType,
      graded.length ? `${hits}/${legs.length} hit` : '',
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
    const next = legGames.find((g) => g?.state === 'pre');
    const kickoff = next
      ? `${multiGame ? 'First game ' : ''}${next.detail}`
      : legGames.some(Boolean)
        ? ''
        : 'Kickoff not found yet';
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
        {legs.length && variant === 'past' ? (
          <View style={styles.dots}>
            {legs.map((l) => (
              <View
                key={l.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      l.result === 'hit'
                        ? colors.win
                        : l.result === 'miss'
                          ? colors.loss
                          : colors.surfaceAlt,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
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
  less: { alignItems: 'center', marginTop: -space.sm, marginBottom: space.md },
  lessText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
});
