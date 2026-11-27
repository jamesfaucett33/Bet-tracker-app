import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { CompactBet } from '../components/CompactBet';
import { formatAmount } from '../format';
import { useBetPhases, useLive } from '../live';
import { betToWin } from '../odds';
import { useStore } from '../store';
import { colors, radius, space } from '../theme';
import { Bet } from '../types';

/** Open tickets where no game has started yet. */
export function UpcomingScreen({
  onEditBet,
  onOpenLive,
}: {
  onEditBet: (bet: Bet) => void;
  onOpenLive?: () => void;
}) {
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
  // Big totals drop the cents so the columns don't run together.
  const money = (n: number) => {
    const t = formatAmount(n, settings);
    return Math.abs(n) >= 10000 ? t.replace(/\.\d\d$/, '') : t;
  };
  const rows = [
    { label: '🔴 Live', list: inProgress, live: true },
    { label: '◷ Upcoming', list: upcoming, live: false },
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
              <Pressable
                key={r.label}
                style={({ pressed }) => [styles.tRow, pressed && r.live && { opacity: 0.7 }]}
                onPress={r.live ? onOpenLive : undefined}
                disabled={!r.live}
                accessibilityRole={r.live ? 'button' : undefined}
              >
                <Text style={[styles.tCell, styles.tName]}>{r.live ? `${r.label} ›` : r.label}</Text>
                <Text style={[styles.tCell, styles.tNum]}>{r.list.length}</Text>
                <Text style={[styles.tCell, styles.tMoney]}>{money(sum(r.list, (b) => b.stake))}</Text>
                <Text style={[styles.tCell, styles.tMoney, { color: colors.money }]}>
                  {money(sum(r.list, betToWin))}
                </Text>
              </Pressable>
            ))}
            <View style={[styles.tRow, styles.tTotal]}>
              <Text style={[styles.tCell, styles.tName, styles.bold]}>Total open</Text>
              <Text style={[styles.tCell, styles.tNum, styles.bold]}>{open.length}</Text>
              <Text style={[styles.tCell, styles.tMoney, styles.bold]}>{money(totalStake)}</Text>
              <Text style={[styles.tCell, styles.tMoney, styles.bold, { color: colors.money }]}>
                {money(totalWin)}
              </Text>
            </View>
            <Text style={styles.payout}>
              Total payout if everything cashes:{' '}
              <Text style={{ color: colors.money, fontWeight: '800' }}>
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
    borderTopWidth: 1,
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
  tName: { flex: 1.3 },
  tNum: { flex: 0.6, textAlign: 'center' },
  tMoney: { flex: 1.5, textAlign: 'right', paddingLeft: 6 },
  bold: { fontWeight: '800' },
  payout: { color: colors.textDim, fontSize: 13, marginTop: space.sm, textAlign: 'center' },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
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
