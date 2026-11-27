import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CompactBet } from '../components/CompactBet';
import { formatAmount } from '../format';
import { useBetPhases, useLive } from '../live';
import { betToWin } from '../odds';
import { useStore } from '../store';
import { colors, radius, space } from '../theme';
import { Bet } from '../types';

/** Open tickets where no game has started yet. */
export function UpcomingScreen({ onEditBet }: { onEditBet: (bet: Bet) => void }) {
  const { bets, settings } = useStore();
  const phaseOf = useBetPhases();
  const { games, legGames } = useLive();
  // Soonest kickoff first; tickets whose games aren't found yet go last, by bet date.
  const kickoff = (b: Bet) => {
    const times = (legGames.get(b.id) ?? [games.get(b.id)])
      .map((g) => g?.startTime)
      .filter((t): t is number => !!t);
    return times.length ? Math.min(...times) : Number.MAX_SAFE_INTEGER;
  };
  const upcoming = useMemo(
    () =>
      bets
        .filter((b) => phaseOf(b) === 'upcoming')
        .sort(
          (a, b) =>
            kickoff(a) - kickoff(b) ||
            (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bets, phaseOf, games, legGames],
  );
  // Money on the table: tickets in progress, tickets not started, and both together.
  const inProgress = bets.filter((b) => phaseOf(b) === 'live');
  const sum = (list: Bet[], f: (b: Bet) => number) => list.reduce((acc, b) => acc + f(b), 0);
  const money = (n: number) => formatAmount(n, settings);
  const rows = [
    { label: '🔴 Live', list: inProgress },
    { label: '◷ Upcoming', list: upcoming },
  ];
  const open = [...inProgress, ...upcoming];
  const totalStake = sum(open, (b) => b.stake);
  const totalWin = sum(open, betToWin);

  return (
    <FlatList
      data={upcoming}
      keyExtractor={(b) => b.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        open.length ? (
          <View style={styles.summary}>
            <View style={styles.tRow}>
              <Text style={[styles.tHead, styles.tName]}> </Text>
              <Text style={[styles.tHead, styles.tNum]}>Tickets</Text>
              <Text style={[styles.tHead, styles.tMoney]}>Wagered</Text>
              <Text style={[styles.tHead, styles.tMoney]}>Could win</Text>
            </View>
            {rows.map((r) => (
              <View key={r.label} style={styles.tRow}>
                <Text style={[styles.tCell, styles.tName]}>{r.label}</Text>
                <Text style={[styles.tCell, styles.tNum]}>{r.list.length}</Text>
                <Text style={[styles.tCell, styles.tMoney]}>{money(sum(r.list, (b) => b.stake))}</Text>
                <Text style={[styles.tCell, styles.tMoney, { color: colors.accent }]}>
                  {money(sum(r.list, betToWin))}
                </Text>
              </View>
            ))}
            <View style={[styles.tRow, styles.tTotal]}>
              <Text style={[styles.tCell, styles.tName, styles.bold]}>Total open</Text>
              <Text style={[styles.tCell, styles.tNum, styles.bold]}>{open.length}</Text>
              <Text style={[styles.tCell, styles.tMoney, styles.bold]}>{money(totalStake)}</Text>
              <Text style={[styles.tCell, styles.tMoney, styles.bold, { color: colors.accent }]}>
                {money(totalWin)}
              </Text>
            </View>
            <Text style={styles.payout}>
              Total payout if everything cashes:{' '}
              <Text style={{ color: colors.accent, fontWeight: '800' }}>
                {money(totalStake + totalWin)}
              </Text>
            </Text>
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
  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  tTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 9,
  },
  tHead: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tCell: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tName: { flex: 1.5 },
  tNum: { flex: 0.8, textAlign: 'center' },
  tMoney: { flex: 1.3, textAlign: 'right' },
  bold: { fontWeight: '800' },
  payout: { color: colors.textDim, fontSize: 13, marginTop: space.sm, textAlign: 'center' },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
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
