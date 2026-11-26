import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { BetCard } from '../components/BetCard';
import { ChipRow, Segmented } from '../components/ui';
import { useStore } from '../store';
import { colors, radius, space } from '../theme';
import { Bet } from '../types';

type StatusFilter = 'all' | 'pending' | 'settled';

export function BetsScreen({ onEditBet }: { onEditBet: (bet: Bet) => void }) {
  const { bets } = useStore();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sport, setSport] = useState('All');
  const [query, setQuery] = useState('');

  const sports = useMemo(
    () => ['All', ...Array.from(new Set(bets.map((b) => b.sport).filter(Boolean)))],
    [bets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bets.filter((b) => {
      if (status === 'pending' && b.status !== 'pending') return false;
      if (status === 'settled' && b.status === 'pending') return false;
      if (sport !== 'All' && b.sport !== sport) return false;
      if (q) {
        const hay = [
          b.pick,
          b.book,
          b.sport,
          b.betType,
          b.notes,
          ...(b.legs?.map((l) => l.pick) ?? []),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bets, status, sport, query]);

  return (
    <FlatList
      data={filtered}
      keyExtractor={(b) => b.id}
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
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: `All (${bets.length})` },
              { value: 'pending', label: 'Pending' },
              { value: 'settled', label: 'Settled' },
            ]}
          />
          {sports.length > 2 ? (
            <ChipRow options={sports} value={sport} onChange={setSport} />
          ) : null}
        </View>
      }
      renderItem={({ item }) => <BetCard bet={item} onPress={() => onEditBet(item)} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {bets.length === 0 ? 'No bets yet' : 'No matching bets'}
          </Text>
          <Text style={styles.emptyText}>
            {bets.length === 0
              ? 'Tap the + button to log your first bet.'
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
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.textDim, fontSize: 14, marginTop: 6 },
});
