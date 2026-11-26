import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { CompactBet } from '../components/CompactBet';
import { DotLegend } from '../components/LegDots';
import { ChipRow, Segmented } from '../components/ui';
import { formatAmount, formatDate } from '../format';
import { betProfit } from '../odds';
import { settledDay, settledOrder } from '../recap';
import { useStore } from '../store';
import { colors, profitColor, radius, space } from '../theme';
import { Bet } from '../types';

type ResultFilter = 'all' | 'won' | 'lost' | 'push';
type Row = { kind: 'day'; date: string; profit: number } | { kind: 'bet'; bet: Bet };

/** Settled tickets (won, lost, push), one compact row each, grouped by day. */
export function BetsScreen({ onEditBet }: { onEditBet: (bet: Bet) => void }) {
  const { bets, settings } = useStore();
  const [result, setResult] = useState<ResultFilter>('all');
  const [sport, setSport] = useState('All');
  const [query, setQuery] = useState('');

  const past = useMemo(() => bets.filter((b) => b.status !== 'pending'), [bets]);
  const sports = useMemo(
    () => ['All', ...Array.from(new Set(past.map((b) => b.sport).filter(Boolean)))],
    [past],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return past
      .filter((b) => {
        if (result !== 'all' && b.status !== result) return false;
        if (sport !== 'All' && b.sport !== sport) return false;
        if (q) {
          const hay = [b.pick, b.book, b.sport, b.betType, b.notes, ...(b.legs?.map((l) => l.pick) ?? [])]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => settledOrder(b, a)); // newest decided first
  }, [past, result, sport, query]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    let day: Extract<Row, { kind: 'day' }> | null = null;
    for (const b of filtered) {
      const d = settledDay(b); // grouped by the day it was decided
      if (!day || day.date !== d) {
        day = { kind: 'day', date: d, profit: 0 };
        out.push(day);
      }
      day.profit += betProfit(b);
      out.push({ kind: 'bet', bet: b });
    }
    return out;
  }, [filtered]);

  const count = (s: ResultFilter) => past.filter((b) => b.status === s).length;
  const total = filtered.reduce((s, b) => s + betProfit(b), 0);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => (r.kind === 'day' ? `d-${r.date}` : r.bet.id)}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.lg }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search picks, books, notes…"
            placeholderTextColor={colors.textFaint}
            style={styles.search}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <Segmented<ResultFilter>
            value={result}
            onChange={setResult}
            options={[
              { value: 'all', label: `All (${past.length})` },
              { value: 'won', label: `Won (${count('won')})` },
              { value: 'lost', label: `Lost (${count('lost')})` },
              { value: 'push', label: `Push (${count('push')})` },
            ]}
          />
          {sports.length > 2 ? (
            <ChipRow options={sports} value={sport} onChange={setSport} />
          ) : null}
          <DotLegend />
          {filtered.length ? (
            <Text style={styles.total}>
              {filtered.length} ticket{filtered.length === 1 ? '' : 's'} ·{' '}
              <Text style={{ color: profitColor(total) }}>
                {formatAmount(total, settings, { sign: true })}
              </Text>
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) =>
        item.kind === 'day' ? (
          <View style={styles.day}>
            <Text style={styles.dayText}>{formatDate(item.date)}</Text>
            <Text style={[styles.dayText, { color: profitColor(item.profit) }]}>
              {formatAmount(item.profit, settings, { sign: true })}
            </Text>
          </View>
        ) : (
          <CompactBet bet={item.bet} variant="past" onEdit={() => onEditBet(item.bet)} />
        )
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {past.length === 0 ? 'No finished tickets yet' : 'No matching tickets'}
          </Text>
          <Text style={styles.emptyText}>
            {past.length === 0
              ? 'Tickets land here once they win, lose or push.'
              : 'Try a different filter or search.'}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 120 },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  total: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  day: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
    marginBottom: 6,
  },
  dayText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.textDim, fontSize: 14, marginTop: 6 },
});
