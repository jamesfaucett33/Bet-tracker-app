import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BetaWelcome } from '../components/BetaBanner';
import { TripCard } from '../components/TripCard';
import { TicketListSheet } from '../components/TicketListSheet';
import { LOSS_TITLE, lossKind } from '../lossKind';
import { pendingReferral, REFERRAL_BONUS } from '../referral';
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
  onViewBet,
  onOpenSettings,
  onOpenTab,
}: {
  onEditBet: (bet: Bet) => void;
  /** Open a ticket to see its legs and stats (with Edit inside). */
  onViewBet: (bet: Bet) => void;
  onOpenSettings?: () => void;
  onOpenTab?: (tab: JumpTab) => void;
}) {
  const sync = useSync();
  const { bets, settings } = useStore();
  const phaseOf = useBetPhases();
  const [period, setPeriodState] = useState<Period>(() => {
    try {
      const v = globalThis.localStorage?.getItem('betkeeper:period');
      return v === 'today' || v === '7d' || v === '30d' || v === 'all' ? v : '7d';
    } catch {
      return '7d';
    }
  });
  const setPeriod = (p: Period) => {
    setPeriodState(p);
    try {
      globalThis.localStorage?.setItem('betkeeper:period', p);
    } catch {
      // private mode
    }
  };
  const [breakdown, setBreakdown] = useState<Breakdown>('sport');
  const [listOf, setListOf] = useState<'won' | 'lost' | 'net' | null>(null);
  const money = (n: number, sign = false) => formatAmount(n, settings, { sign });

  const weekStart = daysAgoISO(6);
  const todayStr = todayISO(); // recomputed after midnight, not stuck on yesterday
  const today = useMemo(() => tally(bets, todayStr), [bets, todayStr]);
  const week = useMemo(() => tally(bets, weekStart), [bets, weekStart]);
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
  const wonTotal = periodBets.filter((b) => b.status === 'won').reduce((n, b) => n + betProfit(b), 0);
  const lostTotal = periodBets.filter((b) => b.status === 'lost').reduce((n, b) => n + b.stake, 0);
  // Box text: drop cents past $1,000 and shrink long amounts so they fit.
  const boxMoney = (n: number) => {
    const t = money(n, true);
    return Math.abs(n) >= 1000 ? t.replace(/\.\d\d$/, '') : t;
  };
  const boxSize = (t: string) => ({ fontSize: t.length > 10 ? 14 : t.length > 8 ? 16 : t.length > 7 ? 18 : 20 });
  const periodName = { today: 'today', '7d': 'last 7 days', '30d': 'last 30 days', ytd: 'this year', all: 'all time' }[period];
  const groups = useMemo(() => groupBy(periodBets, (b) => b[breakdown]), [periodBets, breakdown]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BetaWelcome />
      {sync.configured && !sync.email ? (
        <Pressable onPress={onOpenSettings} style={styles.backup} accessibilityRole="button">
          {pendingReferral() ? (
            <>
              <Text style={styles.backupTitle}>🎁 Your friend gave you {REFERRAL_BONUS} free bet uploads</Text>
              <Text style={styles.backupText}>
                Create your free account (Profile) to claim them and back up your bets. Tap here.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.backupTitle}>☁️ Back up your bets</Text>
              <Text style={styles.backupText}>
                Bets are only on this browser right now. Sign in (Profile) to save them to your
                account and see them on every device.
              </Text>
            </>
          )}
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

      {/* Won / lost / net for the chosen period */}
      <View style={{ marginTop: space.md }}>
        <Segmented<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'today', label: 'Today' },
            { value: '7d', label: '7 Days' },
            { value: '30d', label: '30 Days' },
            { value: 'all', label: 'All Time' },
          ]}
        />
      </View>
      <View style={styles.row3}>
        <Pressable
          style={({ pressed }) => [styles.moneyTile, pressed && styles.tilePressed]}
          onPress={() => setListOf('won')}
          accessibilityRole="button"
          accessibilityLabel="See winning tickets"
        >
          <Text style={styles.moneyLabel}>WON ›</Text>
          <Text style={[styles.moneyValue, boxSize(boxMoney(wonTotal)), { color: colors.win }]} numberOfLines={1}>
            {boxMoney(wonTotal)}
          </Text>
          <Text style={styles.moneySub}>
            {periodSummary.wins} win{periodSummary.wins === 1 ? '' : 's'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.moneyTile, pressed && styles.tilePressed]}
          onPress={() => setListOf('lost')}
          accessibilityRole="button"
          accessibilityLabel="See losing tickets"
        >
          <Text style={styles.moneyLabel}>LOST ›</Text>
          <Text style={[styles.moneyValue, boxSize(boxMoney(-lostTotal)), { color: colors.loss }]} numberOfLines={1}>
            {boxMoney(-lostTotal)}
          </Text>
          <Text style={styles.moneySub}>
            {periodSummary.losses} loss{periodSummary.losses === 1 ? '' : 'es'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.moneyTile,
            { borderColor: profitColor(periodSummary.profit), borderWidth: 2 },
            pressed && styles.tilePressed,
          ]}
          onPress={() => setListOf('net')}
          accessibilityRole="button"
          accessibilityLabel="See all settled tickets"
        >
          <Text style={styles.moneyLabel}>NET ›</Text>
          <Text
            style={[
              styles.moneyValue,
              boxSize(boxMoney(periodSummary.profit)),
              { color: profitColor(periodSummary.profit) },
            ]}
            numberOfLines={1}
          >
            {boxMoney(periodSummary.profit)}
          </Text>
          <Text style={styles.moneySub}>
            {periodSummary.profit > 0 ? 'up' : periodSummary.profit < 0 ? 'down' : 'even'} {periodName}
          </Text>
        </Pressable>
      </View>

      {/* On the table */}
      <SectionTitle>On the table</SectionTitle>
      <Card style={{ padding: 0 }}>
        <Pressable
          style={({ pressed }) => [styles.tableTop, pressed && { opacity: 0.8 }]}
          onPress={() => onOpenTab?.(live.length ? 'live' : 'upcoming')}
          accessibilityRole="button"
          accessibilityLabel="See your open tickets"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.tableLabel}>Riding right now ›</Text>
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
        </Pressable>
        <View style={styles.tableSplit}>
          <Pressable
            style={({ pressed }) => [styles.tableCell, pressed && styles.cellPressed]}
            onPress={() => onOpenTab?.('live')}
            accessibilityRole="button"
            accessibilityLabel="Open Live"
          >
            <Text style={styles.cellLabel}>🔴 Live · {live.length} ›</Text>
            <Text style={styles.cellValue}>{money(sum(live, (b) => b.stake))}</Text>
            <Text style={styles.cellSub}>to win {money(sum(live, betToWin))}</Text>
          </Pressable>
          <View style={styles.vDivider} />
          <Pressable
            style={({ pressed }) => [styles.tableCell, pressed && styles.cellPressed]}
            onPress={() => onOpenTab?.('upcoming')}
            accessibilityRole="button"
            accessibilityLabel="Open Upcoming"
          >
            <Text style={styles.cellLabel}>◷ Upcoming · {upcoming.length} ›</Text>
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
          onPress={best.biggest ? () => onViewBet(best.biggest!) : undefined}
        />
        <FunStat
          label="Longest odds cashed"
          value={best.longest ? formatOdds(best.longest.odds) : '—'}
          sub={best.longest?.pick}
          onPress={best.longest ? () => onViewBet(best.longest!) : undefined}
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
              onPress={() => onViewBet(b)}
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
              tag={lossTag(c.bet)}
              onPress={() => onViewBet(c.bet)}
            />
          ))}
        </Card>
      ) : (
        <Empty text="No heartbreakers in the last 30 days. Love to see it." />
      )}

      <SectionTitle>💀 Bad beats & bad bets this week</SectionTitle>
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
              tag={lossTag(b)}
              onPress={() => onViewBet(b)}
            />
          ))}
        </Card>
      ) : (
        <Empty text="No losses this week. Don’t jinx it. 🤫" />
      )}

      <SectionTitle>{`Your numbers · ${periodName}`}</SectionTitle>
      <View style={styles.grid}>
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
      <TicketListSheet
        title={listOf === 'won' ? '💰 Wins' : listOf === 'lost' ? '💀 Losses' : '📊 All settled tickets'}
        subtitle={`${periodName[0].toUpperCase()}${periodName.slice(1)} · tap a ticket to see its legs`}
        bets={
          listOf
            ? periodBets
                .filter((b) =>
                  listOf === 'won' ? b.status === 'won' : listOf === 'lost' ? b.status === 'lost' : b.status !== 'pending',
                )
                .sort((x, y) => (y.settledAt ?? y.createdAt) - (x.settledAt ?? x.createdAt))
            : null
        }
        onClose={() => setListOf(null)}
        onEditBet={(b) => {
          setListOf(null);
          onEditBet(b);
        }}
      />
    </ScrollView>
  );
}

/** "1W · 3L" (plus pushes): clearer than "1-3". */
function record(w: number, l: number, p: number): string {
  return `${w}W · ${l}L${p ? ` · ${p}P` : ''}`;
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

/** "😩 Bad beat" / "🤡 Bad bet" / "💀 Busted" for a losing ticket. */
function lossTag(b: Bet): { text: string; color: string } | undefined {
  if (b.status !== 'lost') return undefined;
  const k = lossKind(b);
  const t = LOSS_TITLE[k];
  const word = { badBeat: 'Bad beat', badBet: 'Bad bet', busted: 'Busted' }[k];
  return { text: `${t.emoji} ${word}`, color: k === 'badBeat' ? colors.push : k === 'badBet' ? colors.toPlay : colors.loss };
}

function RecapRow({
  title,
  sub,
  right,
  rightSub,
  rightColor,
  first,
  onPress,
  tag,
}: {
  title: string;
  sub: string;
  right: string;
  rightSub?: string;
  /** Small label pill, e.g. "😩 Bad beat". */
  tag?: { text: string; color: string };
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
        {tag ? (
          <Text style={[styles.tag, { color: tag.color, borderColor: tag.color }]}>{tag.text}</Text>
        ) : null}
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
  moneyTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: 'center',
  },
  tilePressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  moneyLabel: { color: colors.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  moneyValue: { fontSize: 20, fontWeight: '900', marginTop: 4 },
  moneySub: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
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
  cellPressed: { backgroundColor: colors.surfaceAlt },
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
  tag: {
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
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
