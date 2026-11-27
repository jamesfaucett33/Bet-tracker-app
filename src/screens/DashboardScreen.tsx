import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BetaWelcome } from '../components/BetaBanner';
import { TripCard } from '../components/TripCard';
import { activeTrip } from '../trips';
import { dotCounts, dotForResult } from '../components/LegDots';
import { Card, Chip, SectionTitle, Segmented } from '../components/ui';
import { formatAmount, formatDate, formatPct, todayISO } from '../format';
import { useBetPhases } from '../live';
import { betProfit, betToWin, formatOdds } from '../odds';
import {
  bestHits,
  closeCalls,
  daysAgoISO,
  headline,
  recentWins,
  settledDay,
  streaks,
  tally,
  Tally,
  worstBeats,
} from '../recap';
import { filterByPeriod, groupBy, Period, summarize } from '../stats';
import { useStore } from '../store';
import { useSync } from '../sync';
import { colors, profitColor, radius, space } from '../theme';
import { Bet } from '../types';

type Breakdown = 'sport' | 'betType' | 'book';
type JumpTab = 'upcoming' | 'live' | 'bets';

/** All recap: money on the table, how the day / week / all time went, and the fun stuff. */
export function DashboardScreen({
  onEditBet,
  onOpenSettings,
  onOpenTab,
}: {
  onEditBet: (bet: Bet) => void;
  onOpenSettings?: () => void;
  onOpenTab?: (tab: JumpTab) => void;
}) {
  const sync = useSync();
  const { bets, settings } = useStore();
  const phaseOf = useBetPhases();
  const [period, setPeriod] = useState<Period>('all');
  const [breakdown, setBreakdown] = useState<Breakdown>('sport');
  const money = (n: number, sign = false) => formatAmount(n, settings, { sign });

  const weekStart = daysAgoISO(6);
  const todayStr = todayISO(); // recomputed after midnight, not stuck on yesterday
  const today = useMemo(() => tally(bets, todayStr), [bets, todayStr]);
  const week = useMemo(() => tally(bets, weekStart), [bets, weekStart]);
  const allTime = useMemo(() => tally(bets), [bets]);
  const vibe = headline(week, today, (n) => money(n));

  // Money still riding.
  const open = bets.filter((b) => b.status === 'pending');
  const live = open.filter((b) => phaseOf(b) === 'live');
  const upcoming = open.filter((b) => phaseOf(b) === 'upcoming');
  const toSettle = open.filter((b) => phaseOf(b) === 'settle');
  const sum = (list: Bet[], f: (b: Bet) => number) => list.reduce((s, b) => s + f(b), 0);

  const streak = useMemo(() => streaks(bets), [bets]);
  const wins = useMemo(() => recentWins(bets), [bets]);
  const close = useMemo(() => closeCalls(bets, daysAgoISO(29)), [bets]);
  const worst = useMemo(() => worstBeats(bets, weekStart), [bets, weekStart]);
  const best = useMemo(() => bestHits(bets), [bets]);
  const allSummary = useMemo(() => summarize(bets), [bets]);

  const periodBets = useMemo(() => filterByPeriod(bets, period), [bets, period]);
  const periodSummary = useMemo(() => summarize(periodBets), [periodBets]);
  const periodSettled = periodSummary.wins + periodSummary.losses + periodSummary.pushes;
  const groups = useMemo(() => groupBy(periodBets, (b) => b[breakdown]), [periodBets, breakdown]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BetaWelcome />
      {sync.configured && !sync.email ? (
        <Pressable onPress={onOpenSettings} style={styles.backup} accessibilityRole="button">
          <Text style={styles.backupTitle}>☁️ Back up your bets</Text>
          <Text style={styles.backupText}>
            Bets are only on this browser right now. Sign in (Profile) to save them to your account
            and see them on every device.
          </Text>
        </Pressable>
      ) : null}

      {(() => {
        const trip = activeTrip(settings.trips);
        return trip ? <TripCard trip={trip} onEditBet={onEditBet} /> : null;
      })()}

      <View style={styles.vibe}>
        <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
        <Text style={styles.vibeText}>{vibe.text}</Text>
      </View>

      {/* Up / down: today, last 7 days, all time */}
      <View style={styles.row3}>
        <PLTile label="Today" t={today} money={money} />
        <PLTile label="7 days" t={week} money={money} />
        <PLTile label="All time" t={allTime} money={money} big />
      </View>

      {/* On the table */}
      <SectionTitle>On the table</SectionTitle>
      <Card style={{ padding: 0 }}>
        <View style={styles.tableTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tableLabel}>Riding right now</Text>
            <Text style={styles.tableValue}>{money(sum(open, (b) => b.stake))}</Text>
            <Text style={styles.tableSub}>
              {open.length} open ticket{open.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.tableLabel}>Could win</Text>
            <Text style={[styles.tableValue, { color: colors.money }]}>
              {money(sum(open, betToWin))}
            </Text>
            <Text style={styles.tableSub}>if everything cashes 🙏</Text>
          </View>
        </View>
        <View style={styles.tableSplit}>
          <Pressable style={styles.tableCell} onPress={() => onOpenTab?.('live')} accessibilityRole="button">
            <Text style={styles.cellLabel}>🔴 Live · {live.length}</Text>
            <Text style={styles.cellValue}>{money(sum(live, (b) => b.stake))}</Text>
            <Text style={styles.cellSub}>to win {money(sum(live, betToWin))}</Text>
          </Pressable>
          <View style={styles.vDivider} />
          <Pressable style={styles.tableCell} onPress={() => onOpenTab?.('upcoming')} accessibilityRole="button">
            <Text style={styles.cellLabel}>◷ Upcoming · {upcoming.length}</Text>
            <Text style={styles.cellValue}>{money(sum(upcoming, (b) => b.stake))}</Text>
            <Text style={styles.cellSub}>to win {money(sum(upcoming, betToWin))}</Text>
          </Pressable>
        </View>
        {toSettle.length ? (
          <Pressable
            style={styles.settleNote}
            onPress={() => onOpenTab?.('bets')}
            accessibilityRole="button"
          >
            <Text style={styles.settleNoteText}>
              ✍️ {toSettle.length} ticket{toSettle.length === 1 ? '' : 's'} finished but need your
              call · tap to settle
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {/* Fun numbers */}
      <View style={styles.grid}>
        <FunStat
          label="Streak"
          value={
            streak.current
              ? `${streak.current.kind === 'W' ? '🔥' : '🥶'} ${streak.current.kind}${streak.current.n}`
              : '—'
          }
          sub={streak.bestWin > 1 ? `Best run: ${streak.bestWin} straight wins` : streak.bestWin ? 'Best run: 1 win' : undefined}
        />
        <FunStat
          label="Win rate"
          value={formatPct(allSummary.winRate)}
          sub={`ROI ${formatPct(allSummary.roi)}`}
        />
        <FunStat
          label="Biggest hit"
          value={best.biggest ? money(betProfit(best.biggest), true) : '—'}
          sub={best.biggest?.pick}
          color={best.biggest ? colors.win : undefined}
          onPress={best.biggest ? () => onEditBet(best.biggest!) : undefined}
        />
        <FunStat
          label="Longest odds cashed"
          value={best.longest ? formatOdds(best.longest.odds) : '—'}
          sub={best.longest?.pick}
          onPress={best.longest ? () => onEditBet(best.longest!) : undefined}
        />
      </View>

      <SectionTitle>🏆 Recent wins</SectionTitle>
      {wins.length ? (
        <Card style={{ padding: 0 }}>
          {wins.map((b, i) => (
            <RecapRow
              key={b.id}
              first={i === 0}
              title={b.pick}
              sub={`${formatDate(settledDay(b))} · ${formatOdds(b.odds)} · ${money(b.stake)}`}
              right={money(betProfit(b), true)}
              rightColor={colors.win}
              onPress={() => onEditBet(b)}
            />
          ))}
        </Card>
      ) : (
        <Empty text="No wins yet. The first one’s the sweetest. 🍀" />
      )}

      <SectionTitle>😬 Close calls · one leg away</SectionTitle>
      {close.length ? (
        <Card style={{ padding: 0 }}>
          {close.map((c, i) => (
            <RecapRow
              key={c.bet.id}
              first={i === 0}
              title={c.bet.pick}
              sub={`${c.hits} hit · 1 missed: ${c.missed}`}
              right={`${money(c.wouldHavePaid)}`}
              rightSub="would’ve paid"
              rightColor={colors.push}
              onPress={() => onEditBet(c.bet)}
            />
          ))}
        </Card>
      ) : (
        <Empty text="No heartbreakers in the last 30 days. Love to see it." />
      )}

      <SectionTitle>💀 Worst beats this week</SectionTitle>
      {worst.length ? (
        <Card style={{ padding: 0 }}>
          {worst.map((b, i) => (
            <RecapRow
              key={b.id}
              first={i === 0}
              title={b.pick}
              sub={`${formatDate(settledDay(b))} · ${formatOdds(b.odds)}${
                b.legs?.some((l) => l.result)
                  ? ` · ${dotCounts(b.legs.map((l) => dotForResult(l.result)))}`
                  : ''
              }`}
              right={money(-b.stake, true)}
              rightColor={colors.loss}
              onPress={() => onEditBet(b)}
            />
          ))}
        </Card>
      ) : (
        <Empty text="No losses this week. Don’t jinx it. 🤫" />
      )}

      <SectionTitle>Your numbers</SectionTitle>
      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: '7d', label: '7 Days' },
          { value: '30d', label: '30 Days' },
          { value: 'ytd', label: 'YTD' },
          { value: 'all', label: 'All Time' },
        ]}
      />
      <View style={[styles.grid, { marginTop: space.md }]}>
        <FunStat
          label="Profit"
          value={money(periodSummary.profit, true)}
          color={profitColor(periodSummary.profit)}
          sub={`ROI ${formatPct(periodSummary.roi)}`}
        />
        <FunStat
          label="Record"
          value={record(periodSummary.wins, periodSummary.losses, periodSummary.pushes)}
          sub={`${formatPct(periodSummary.winRate)} won`}
        />
        <FunStat
          label="Wagered"
          value={money(periodSummary.settledStake)}
          sub={`${periodSettled} settled ticket${periodSettled === 1 ? '' : 's'}`}
        />
        <FunStat
          label="Paid back"
          value={money(periodSummary.settledStake + periodSummary.profit)}
          color={colors.money}
          sub="stakes + winnings returned"
        />
      </View>

      <SectionTitle>Breakdown</SectionTitle>
      <View style={styles.chips}>
        <Chip label="Sport" selected={breakdown === 'sport'} onPress={() => setBreakdown('sport')} />
        <Chip
          label="Bet Type"
          selected={breakdown === 'betType'}
          onPress={() => setBreakdown('betType')}
        />
        <Chip label="Sportsbook" selected={breakdown === 'book'} onPress={() => setBreakdown('book')} />
      </View>
      <Card style={{ padding: 0 }}>
        {groups.length === 0 ? (
          <Text style={styles.emptyText}>No bets in this period yet.</Text>
        ) : (
          groups.map((g, i) => (
            <View key={g.key} style={[styles.groupRow, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{g.key}</Text>
                <Text style={styles.groupSub}>
                  {record(g.summary.wins, g.summary.losses, g.summary.pushes)} ·{' '}
                  {formatPct(g.summary.winRate)} won · ROI {formatPct(g.summary.roi)}
                </Text>
              </View>
              <Text style={[styles.groupProfit, { color: profitColor(g.summary.profit) }]}>
                {money(g.summary.profit, true)}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

/** "1W · 3L" (plus pushes): clearer than "1-3". */
function record(w: number, l: number, p: number): string {
  return `${w}W · ${l}L${p ? ` · ${p}P` : ''}`;
}

function PLTile({
  label,
  t,
  money,
  big,
}: {
  label: string;
  t: Tally;
  money: (n: number, sign?: boolean) => string;
  big?: boolean;
}) {
  return (
    <View style={[styles.plTile, big && { borderColor: colors.accent }]}>
      <Text style={styles.plLabel}>{label}</Text>
      <Text
        style={[styles.plValue, { color: t.count ? profitColor(t.profit) : colors.textFaint }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {money(t.count ? t.profit : 0, !!t.count)}
      </Text>
      <Text style={styles.plSub}>
        {t.count ? record(t.wins, t.losses, t.pushes) : 'no results'}
      </Text>
    </View>
  );
}

function FunStat({
  label,
  value,
  sub,
  color,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.statSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

function RecapRow({
  title,
  sub,
  right,
  rightSub,
  rightColor,
  first,
  onPress,
}: {
  title: string;
  sub: string;
  right: string;
  rightSub?: string;
  rightColor: string;
  first: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.recapRow, !first && styles.divider, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.recapTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.recapSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.recapRight, { color: rightColor }]}>{right}</Text>
        {rightSub ? <Text style={styles.recapRightSub}>{rightSub}</Text> : null}
      </View>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 120 },
  backup: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.sky,
    padding: space.md,
    marginBottom: space.md,
  },
  backupTitle: { color: colors.sky, fontSize: 15, fontWeight: '800' },
  backupText: { color: colors.textDim, fontSize: 13, marginTop: 4, lineHeight: 18 },
  vibe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '66',
    padding: space.md,
  },
  vibeEmoji: { fontSize: 30 },
  vibeText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  row3: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  plTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: 'center',
  },
  plLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  plValue: { fontSize: 21, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  plSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  tableTop: { flexDirection: 'row', padding: space.lg, gap: space.md },
  tableLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  tableValue: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 2 },
  tableSub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  tableSplit: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableCell: { flex: 1, padding: space.md, alignItems: 'center' },
  settleNote: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: space.md,
  },
  settleNoteText: { color: colors.push, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  vDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  cellLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  cellValue: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  cellSub: { color: colors.money, fontSize: 12, fontWeight: '600', marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.lg },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.md,
  },
  statLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  statSub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  recapRow: { flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.md },
  recapTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  recapSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  recapRight: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  recapRightSub: { color: colors.textFaint, fontSize: 11 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  chips: { flexDirection: 'row', gap: space.sm, marginBottom: space.md, flexWrap: 'wrap' },
  groupRow: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  groupName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  groupSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  groupProfit: { fontSize: 15, fontWeight: '800' },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  emptyText: { color: colors.textFaint, padding: space.lg, textAlign: 'center', fontSize: 13 },
});
