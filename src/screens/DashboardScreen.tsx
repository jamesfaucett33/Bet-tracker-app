import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BetCard } from '../components/BetCard';
import { ProfitChart } from '../components/ProfitChart';
import { Card, Chip, SectionTitle, Segmented } from '../components/ui';
import { formatAmount, formatPct } from '../format';
import { filterByPeriod, groupBy, Period, profitSeries, summarize } from '../stats';
import { useStore } from '../store';
import { colors, profitColor, radius, space } from '../theme';
import { Bet } from '../types';

type Breakdown = 'sport' | 'betType' | 'book';

export function DashboardScreen({ onEditBet }: { onEditBet: (bet: Bet) => void }) {
  const { bets, settings } = useStore();
  const [period, setPeriod] = useState<Period>('all');
  const [breakdown, setBreakdown] = useState<Breakdown>('sport');

  const periodBets = useMemo(() => filterByPeriod(bets, period), [bets, period]);
  const s = useMemo(() => summarize(periodBets), [periodBets]);
  const allTime = useMemo(() => summarize(bets), [bets]);
  const series = useMemo(() => profitSeries(periodBets), [periodBets]);
  const groups = useMemo(() => groupBy(periodBets, (b) => b[breakdown]), [periodBets, breakdown]);
  const pendingBets = useMemo(() => bets.filter((b) => b.status === 'pending'), [bets]);

  const bankroll = settings.startingBankroll + allTime.profit;

  return (
    <ScrollView contentContainerStyle={styles.container}>
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

      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>Profit / Loss</Text>
        <Text style={[styles.heroValue, { color: profitColor(s.profit) }]}>
          {formatAmount(s.profit, settings, { sign: true })}
        </Text>
        <Text style={styles.heroSub}>
          {s.wins}-{s.losses}
          {s.pushes ? `-${s.pushes}` : ''} record · {formatAmount(s.settledStake, settings)} wagered
        </Text>
        <View style={{ marginTop: space.lg }}>
          <ProfitChart series={series} />
        </View>
      </Card>

      <View style={styles.grid}>
        <Stat label="Win Rate" value={formatPct(s.winRate)} />
        <Stat
          label="ROI"
          value={formatPct(s.roi)}
          color={Number.isFinite(s.roi) ? profitColor(s.roi) : undefined}
        />
        <Stat
          label="Pending"
          value={`${allTime.pending}`}
          sub={
            allTime.pending ? `${formatAmount(allTime.pendingStake, settings)} at risk` : undefined
          }
        />
        <Stat
          label={settings.startingBankroll ? 'Bankroll' : 'Pending To Win'}
          value={
            settings.startingBankroll
              ? formatAmount(bankroll, settings)
              : formatAmount(allTime.pendingToWin, settings)
          }
        />
      </View>

      <SectionTitle>Breakdown</SectionTitle>
      <View style={styles.chips}>
        <Chip
          label="Sport"
          selected={breakdown === 'sport'}
          onPress={() => setBreakdown('sport')}
        />
        <Chip
          label="Bet Type"
          selected={breakdown === 'betType'}
          onPress={() => setBreakdown('betType')}
        />
        <Chip
          label="Sportsbook"
          selected={breakdown === 'book'}
          onPress={() => setBreakdown('book')}
        />
      </View>
      <Card style={{ padding: 0 }}>
        {groups.length === 0 ? (
          <Text style={styles.emptyText}>No bets in this period yet.</Text>
        ) : (
          groups.map((g, i) => (
            <View key={g.key} style={[styles.groupRow, i > 0 && styles.groupDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{g.key}</Text>
                <Text style={styles.groupSub}>
                  {g.summary.wins}-{g.summary.losses}
                  {g.summary.pushes ? `-${g.summary.pushes}` : ''} · {formatPct(g.summary.winRate)}{' '}
                  · ROI {formatPct(g.summary.roi)}
                </Text>
              </View>
              <Text style={[styles.groupProfit, { color: profitColor(g.summary.profit) }]}>
                {formatAmount(g.summary.profit, settings, { sign: true })}
              </Text>
            </View>
          ))
        )}
      </Card>

      {pendingBets.length > 0 ? (
        <>
          <SectionTitle>Open Bets ({pendingBets.length})</SectionTitle>
          {pendingBets.slice(0, 5).map((b) => (
            <BetCard key={b.id} bet={b} onPress={() => onEditBet(b)} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, color ? { color } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 120 },
  hero: { marginTop: space.lg },
  heroLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  heroValue: { fontSize: 40, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  heroSub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  statLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  statSub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', gap: space.sm, marginBottom: space.md, flexWrap: 'wrap' },
  groupRow: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  groupDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  groupName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  groupSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  groupProfit: { fontSize: 15, fontWeight: '800' },
  emptyText: { color: colors.textFaint, padding: space.lg, textAlign: 'center' },
});
