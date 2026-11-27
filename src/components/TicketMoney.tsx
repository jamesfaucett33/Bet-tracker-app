import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../format';
import { betProfit, betToWin, formatOdds } from '../odds';
import { useStore } from '../store';
import { colors, profitColor, radius, space } from '../theme';
import { Bet } from '../types';

/**
 * Every ticket's money in one strip: odds, wagered, to win, payout. To win
 * uses the amount printed on the ticket when there is one. Settled tickets
 * show the result in place of the payout.
 */
export function TicketMoney({ bet }: { bet: Bet }) {
  const { settings } = useStore();
  const money = (n: number, sign = false) => formatAmount(n, settings, { sign });
  const toWin = betToWin(bet);
  const settled = bet.status !== 'pending';
  const result = betProfit(bet);
  const cells: { label: string; value: string; color?: string }[] = [
    { label: 'Odds', value: formatOdds(bet.odds) },
    { label: 'Wagered', value: money(bet.stake) },
    { label: 'To win', value: money(toWin), color: colors.money },
    settled
      ? {
          label: 'Result',
          value: bet.status === 'push' ? 'Push' : money(result, true),
          color: bet.status === 'push' ? colors.push : profitColor(result),
        }
      : { label: 'Payout', value: money(bet.stake + toWin) },
  ];
  return (
    <View style={styles.strip}>
      {cells.map((c) => (
        <View key={c.label} style={styles.cell}>
          <Text style={styles.label}>{c.label}</Text>
          <Text
            style={[styles.value, c.color ? { color: c.color } : null]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {c.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    marginTop: space.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: space.sm,
  },
  cell: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  label: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 2 },
});
