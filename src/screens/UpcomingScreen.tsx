import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CompactBet } from '../components/CompactBet';
import { formatAmount } from '../format';
import { useBetPhases } from '../live';
import { betToWin } from '../odds';
import { useStore } from '../store';
import { colors, radius, space } from '../theme';
import { Bet } from '../types';

/** Open tickets where no game has started yet. */
export function UpcomingScreen({ onEditBet }: { onEditBet: (bet: Bet) => void }) {
  const { bets, settings } = useStore();
  const phaseOf = useBetPhases();
  const upcoming = useMemo(
    () =>
      bets
        .filter((b) => phaseOf(b) === 'upcoming')
        .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bets, phaseOf],
  );
  const staked = upcoming.reduce((s, b) => s + b.stake, 0);
  const toWin = upcoming.reduce((s, b) => s + betToWin(b), 0);

  return (
    <FlatList
      data={upcoming}
      keyExtractor={(b) => b.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        upcoming.length ? (
          <View style={styles.summary}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Tickets</Text>
              <Text style={styles.statValue}>{upcoming.length}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Wagered</Text>
              <Text style={styles.statValue}>{formatAmount(staked, settings)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Could win</Text>
              <Text style={[styles.statValue, { color: colors.accent }]}>
                {formatAmount(toWin, settings)}
              </Text>
            </View>
          </View>
        ) : undefined
      }
      renderItem={({ item }) => (
        <CompactBet bet={item} variant="upcoming" onEdit={() => onEditBet(item)} />
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing upcoming</Text>
          <Text style={styles.emptyText}>
            Tickets show here until their first game kicks off, then move to Live.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 120 },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: space.md,
    marginBottom: space.lg,
  },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.textDim, fontSize: 14, marginTop: 6, textAlign: 'center' },
});
