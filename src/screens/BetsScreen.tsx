import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CompactBet } from '../components/CompactBet';
import { DotLegend } from '../components/LegDots';
import { ChipRow, SectionTitle, Segmented } from '../components/ui';
import { formatAmount, formatDate } from '../format';
import { betEventIds, useBetPhases, useLive, useRecentGames } from '../live';
import { betProfit } from '../odds';
import { daysAgoISO, settledDay, settledOrder } from '../recap';
import { useStore } from '../store';
import { colors, profitColor, radius, space } from '../theme';
import { Bet } from '../types';
import { GameCast, GameEntry, GameRow, TicketList } from './LiveScreen';

type View_ = 'recent' | 'history';
type ResultFilter = 'all' | 'won' | 'lost' | 'push';
type Row = { kind: 'day'; date: string; profit: number } | { kind: 'bet'; bet: Bet };

const RECENT_DAYS = 7;

/** Tickets grouped under the day they were decided, newest first. */
function byDay(list: Bet[]): Row[] {
  const out: Row[] = [];
  let day: Extract<Row, { kind: 'day' }> | null = null;
  for (const b of [...list].sort((a, c) => settledOrder(c, a))) {
    const d = settledDay(b);
    if (!day || day.date !== d) {
      day = { kind: 'day', date: d, profit: 0 };
      out.push(day);
    }
    day.profit += betProfit(b);
    out.push({ kind: 'bet', bet: b });
  }
  return out;
}

/**
 * Past: "Recent" is the last week (tickets that need your call, the games you
 * had action on with their final stats, and recent results); "History" is
 * every ticket ever, with search and filters.
 */
export function BetsScreen({ onEditBet }: { onEditBet: (bet: Bet) => void }) {
  const { bets, settings } = useStore();
  const { games, legGames } = useLive();
  const phaseOf = useBetPhases();
  const recentGames = useRecentGames(RECENT_DAYS);
  const [view, setView] = useState<View_>('recent');
  const [openGame, setOpenGame] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFilter>('all');
  const [sport, setSport] = useState('All');
  const [query, setQuery] = useState('');
  const money = (n: number, sign = false) => formatAmount(n, settings, { sign });

  const past = useMemo(() => bets.filter((b) => b.status !== 'pending'), [bets]);
  const since = daysAgoISO(RECENT_DAYS - 1);
  const recent = useMemo(() => past.filter((b) => settledDay(b) >= since), [past, since]);
  // Finished, but the app couldn't settle them: they wait here for a Won / Lost / Push tap.
  const toSettle = bets.filter((b) => phaseOf(b) === 'settle');

  // Each recent game with the tickets that had a leg in it.
  const gameEntries: GameEntry[] = useMemo(
    () =>
      recentGames.map((game) => {
        const entry: GameEntry = { game, single: [], parlays: [] };
        for (const b of bets) {
          const perLeg = legGames.get(b.id) ?? (games.get(b.id) ? [games.get(b.id)] : undefined);
          const ids = betEventIds(b, perLeg);
          if (!ids.includes(game.eventId)) continue;
          if (new Set(ids.filter(Boolean)).size > 1) entry.parlays.push(b);
          else entry.single.push(b);
        }
        return entry;
      }),
    [recentGames, bets, games, legGames],
  );

  const sports = useMemo(
    () => ['All', ...Array.from(new Set(past.map((b) => b.sport).filter(Boolean)))],
    [past],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return past.filter((b) => {
      if (result !== 'all' && b.status !== result) return false;
      if (sport !== 'All' && b.sport !== sport) return false;
      if (q) {
        const hay = [b.pick, b.book, b.sport, b.betType, b.notes, ...(b.legs?.map((l) => l.pick) ?? [])]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [past, result, sport, query]);

  // ---- one game opened: final score, your players' final stats, your tickets ----
  const opened = openGame ? gameEntries.find((e) => e.game.eventId === openGame) : undefined;
  if (opened) {
    const tickets = [...opened.single, ...opened.parlays];
    const open = tickets.filter((b) => b.status === 'pending');
    const done = tickets.filter((b) => b.status !== 'pending');
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => setOpenGame(null)} style={styles.back} accessibilityRole="button" hitSlop={10}>
          <Text style={styles.backText}>‹ Past</Text>
        </Pressable>
        <GameCast
          game={opened.game}
          gameBets={opened.single}
          parlayBets={opened.parlays}
          onEditBet={onEditBet}
          tickets={
            <>
              {open.length ? (
                <TicketList
                  title={`Still open (${open.length})`}
                  bets={open}
                  showGameLines
                  onEditBet={onEditBet}
                />
              ) : null}
              {done.length ? (
                <>
                  <SectionTitle>Your tickets on this game ({done.length})</SectionTitle>
                  {done.map((b) => (
                    <CompactBet key={b.id} bet={b} variant="past" onEdit={() => onEditBet(b)} />
                  ))}
                </>
              ) : null}
            </>
          }
        />
      </ScrollView>
    );
  }

  const rows = byDay(view === 'recent' ? recent : filtered);
  const shown = view === 'recent' ? recent : filtered;
  const total = shown.reduce((s, b) => s + betProfit(b), 0);
  const count = (s: ResultFilter) => past.filter((b) => b.status === s).length;

  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      <Segmented<View_>
        value={view}
        onChange={setView}
        options={[
          { value: 'recent', label: `Last ${RECENT_DAYS} days` },
          { value: 'history', label: `All history (${past.length})` },
        ]}
      />

      {view === 'recent' ? (
        <>
          {toSettle.length ? (
            <View>
              <TicketList
                title={`✍️ Needs your call (${toSettle.length})`}
                bets={toSettle}
                showGameLines
                startOpen
                onEditBet={onEditBet}
              />
              <Text style={styles.note}>
                The games are over but the app couldn't grade these (usually a player who didn't
                play, or a half / quarter bet). Check your ticket and tap Won, Lost or Push.
              </Text>
            </View>
          ) : null}
          {gameEntries.length ? (
            <View>
              <SectionTitle>
                Recent games ({gameEntries.length}) · tap for final stats
              </SectionTitle>
              {gameEntries.map((e) => (
                <GameRow key={e.game.eventId} entry={e} onPress={() => setOpenGame(e.game.eventId)} />
              ))}
            </View>
          ) : null}
          <SectionTitle>Recent tickets</SectionTitle>
        </>
      ) : (
        <>
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
              { value: 'all', label: 'All' },
              { value: 'won', label: `Won (${count('won')})` },
              { value: 'lost', label: `Lost (${count('lost')})` },
              { value: 'push', label: `Push (${count('push')})` },
            ]}
          />
          {sports.length > 2 ? <ChipRow options={sports} value={sport} onChange={setSport} /> : null}
        </>
      )}
      <DotLegend />
      {shown.length ? (
        <Text style={styles.total}>
          {shown.length} ticket{shown.length === 1 ? '' : 's'} ·{' '}
          <Text style={{ color: profitColor(total) }}>{money(total, true)}</Text>
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => (r.kind === 'day' ? `d-${r.date}` : r.bet.id)}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      renderItem={({ item }) =>
        item.kind === 'day' ? (
          <View style={styles.day}>
            <Text style={styles.dayText}>{formatDate(item.date)}</Text>
            <Text style={[styles.dayText, { color: profitColor(item.profit) }]}>
              {money(item.profit, true)}
            </Text>
          </View>
        ) : (
          <CompactBet bet={item.bet} variant="past" onEdit={() => onEditBet(item.bet)} />
        )
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {view === 'recent'
              ? `Nothing settled in the last ${RECENT_DAYS} days`
              : past.length === 0
                ? 'No finished tickets yet'
                : 'No matching tickets'}
          </Text>
          <Text style={styles.emptyText}>
            {view === 'recent'
              ? 'Older tickets are under All history.'
              : past.length === 0
                ? 'Tickets land here once they win, lose or push.'
                : 'Try a different filter or search.'}
          </Text>
          {view === 'recent' && past.length ? (
            <Pressable onPress={() => setView('history')} accessibilityRole="button">
              <Text style={[styles.backText, { marginTop: space.md }]}>See all history ›</Text>
            </Pressable>
          ) : null}
        </View>
      }
      ListFooterComponent={
        view === 'recent' && rows.length && past.length > recent.length ? (
          <Pressable onPress={() => setView('history')} style={styles.more} accessibilityRole="button">
            <Text style={styles.moreText}>
              See all history ({past.length - recent.length} older ticket
              {past.length - recent.length === 1 ? '' : 's'}) ›
            </Text>
          </Pressable>
        ) : undefined
      }
    />
  );
}


const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 120 },
  back: { marginBottom: space.sm },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  note: { color: colors.textFaint, fontSize: 12, lineHeight: 17, marginTop: -space.xs },
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
  more: {
    marginTop: space.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  moreText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.textDim, fontSize: 14, marginTop: 6 },
});
