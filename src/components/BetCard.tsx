import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount, formatDate } from '../format';
import { useBetLive } from '../live';
import { GameHeader, legsSummary, LiveLegs } from './LiveLegs';
import { betProfit, formatOdds, potentialProfit } from '../odds';
import { useStore } from '../store';
import { colors, profitColor, radius, space, statusColor } from '../theme';
import { Bet, BetStatus } from '../types';

const STATUS_LABEL: Record<BetStatus, string> = {
  pending: 'PENDING',
  won: 'WON',
  lost: 'LOST',
  push: 'PUSH',
};

export function BetCard({ bet, onPress }: { bet: Bet; onPress: () => void }) {
  const { settings, setStatus } = useStore();
  const profit = betProfit(bet);
  const toWin = potentialProfit(bet.stake, bet.odds);
  const { game, legs: liveLegs } = useBetLive(bet);
  const showLive = bet.status === 'pending' && !!game;
  const summary = showLive ? legsSummary(liveLegs) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${bet.pick}, ${STATUS_LABEL[bet.status]}`}
    >
      <View style={[styles.stripe, { backgroundColor: statusColor[bet.status] }]} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.meta} numberOfLines={1}>
            {[bet.sport, bet.betType, bet.book].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[styles.status, { color: statusColor[bet.status] }]}>
            {STATUS_LABEL[bet.status]}
          </Text>
        </View>

        <Text style={styles.pick} numberOfLines={2}>
          {bet.pick || 'Untitled bet'}
        </Text>
        {showLive && game ? (
          <>
            <GameHeader game={game} />
            <LiveLegs legs={liveLegs} />
            {summary ? (
              <Text style={[styles.summary, { color: summary.color }]}>{summary.text}</Text>
            ) : null}
          </>
        ) : bet.legs && bet.legs.length > 0 ? (
          <Text style={styles.legs} numberOfLines={4}>
            {bet.legs
              .map(
                (l) => `• ${l.pick || 'Leg'}${l.odds === null ? '' : ` (${formatOdds(l.odds)})`}`,
              )
              .join('\n')}
          </Text>
        ) : null}

        {bet.trackerUrl ? (
          <Text
            style={styles.tracker}
            onPress={() => Linking.openURL(bet.trackerUrl!)}
            accessibilityRole="link"
          >
            View ticket on {bet.book || 'sportsbook'} ↗
          </Text>
        ) : null}

        <View style={[styles.row, { marginTop: space.sm }]}>
          <Text style={styles.detail}>
            {formatDate(bet.date)} · {formatOdds(bet.odds)} · {formatAmount(bet.stake, settings)}
          </Text>
          {bet.status === 'pending' ? (
            <Text style={styles.toWin}>To win {formatAmount(toWin, settings)}</Text>
          ) : (
            <Text style={[styles.profit, { color: profitColor(profit) }]}>
              {formatAmount(profit, settings, { sign: true })}
            </Text>
          )}
        </View>

        {bet.status === 'pending' ? (
          <View style={styles.actions}>
            {(['won', 'lost', 'push'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setStatus(bet.id, s)}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${s}`}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { borderColor: statusColor[s] },
                  pressed && { backgroundColor: statusColor[s] + '33' },
                ]}
              >
                <Text style={[styles.actionText, { color: statusColor[s] }]}>
                  {s === 'won' ? 'Won' : s === 'lost' ? 'Lost' : 'Push'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: space.md,
  },
  stripe: { width: 4 },
  body: { flex: 1, padding: space.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
  meta: { color: colors.textDim, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  status: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  pick: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  legs: { color: colors.textDim, fontSize: 13, marginTop: 4, lineHeight: 18 },
  detail: { color: colors.textDim, fontSize: 13, flexShrink: 1 },
  tracker: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: space.sm },
  summary: { fontSize: 13, fontWeight: '700', marginTop: space.sm },
  toWin: { color: colors.pending, fontSize: 13, fontWeight: '700' },
  profit: { fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionText: { fontWeight: '700', fontSize: 13 },
});
