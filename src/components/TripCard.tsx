import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount, formatDate, todayISO } from '../format';
import { betProfit } from '../odds';
import { useStore } from '../store';
import { colors, profitColor, radius, space } from '../theme';
import { tripBets, tripStats } from '../trips';
import { Bet, Trip } from '../types';
import { CompactBet } from './CompactBet';

function dayOf(trip: Trip): string | null {
  const t = todayISO();
  if (t < trip.start || t > trip.end) return null;
  const day = (a: string, b: string) =>
    Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000) + 1;
  return `Day ${day(trip.start, t)} of ${day(trip.start, trip.end)}`;
}

/** One trip: dates, the money, the record, biggest hit, and its tickets. */
export function TripCard({
  trip,
  onEditBet,
  onDelete,
  startOpen,
}: {
  trip: Trip;
  onEditBet: (b: Bet) => void;
  onDelete?: () => void;
  startOpen?: boolean;
}) {
  const { bets, settings } = useStore();
  const [open, setOpen] = useState(!!startOpen);
  const s = tripStats(trip, bets);
  const list = tripBets(trip, bets);
  const money = (n: number, sign = false) => formatAmount(n, settings, { sign });
  const live = dayOf(trip);

  return (
    <View style={[styles.card, live && { borderColor: colors.brand }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>🎰 {trip.name}</Text>
          <Text style={styles.dates}>
            {formatDate(trip.start)} – {formatDate(trip.end)}
          </Text>
        </View>
        {live ? <Text style={styles.livePill}>{live}</Text> : null}
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Profit</Text>
          <Text style={[styles.cellValue, { color: profitColor(s.profit) }]}>
            {money(s.profit, true)}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Record</Text>
          <Text style={styles.cellValue}>
            {s.wins}W · {s.losses}L{s.pushes ? ` · ${s.pushes}P` : ''}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Wagered</Text>
          <Text style={styles.cellValue}>{money(s.wagered)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Still riding</Text>
          <Text style={styles.cellValue}>{money(s.pendingStake)}</Text>
          {s.pending ? (
            <Text style={styles.cellSub}>to win {money(s.pendingToWin)}</Text>
          ) : null}
        </View>
      </View>

      {s.biggest ? (
        <Text style={styles.biggest} numberOfLines={1}>
          💰 Biggest hit: {money(betProfit(s.biggest), true)} · {s.biggest.pick}
        </Text>
      ) : null}

      <Pressable onPress={() => setOpen((v) => !v)} style={styles.toggle} accessibilityRole="button">
        <Text style={styles.toggleText}>
          {list.length
            ? open
              ? 'Hide tickets ▲'
              : `Show ${list.length} ticket${list.length === 1 ? '' : 's'} ▼`
            : 'No tickets yet. Bets you place on these dates show up here.'}
        </Text>
      </Pressable>
      {open
        ? list.map((b) => (
            <CompactBet
              key={b.id}
              bet={b}
              variant={b.status === 'pending' ? 'upcoming' : 'past'}
              onEdit={() => onEditBet(b)}
            />
          ))
        : null}
      {onDelete ? (
        <Text style={styles.delete} onPress={onDelete} accessibilityRole="button">
          Delete trip
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { color: colors.text, fontSize: 20, fontWeight: '900' },
  dates: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  livePill: {
    color: colors.bg,
    backgroundColor: colors.brand,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
  },
  cellLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  cellValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  cellSub: { color: colors.money, fontSize: 12, fontWeight: '700', marginTop: 1 },
  biggest: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: space.md },
  toggle: { paddingVertical: space.md },
  toggleText: { color: colors.accent, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  delete: { color: colors.loss, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4 },
});
