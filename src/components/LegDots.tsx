import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * One dot per leg, the same everywhere in the app:
 * green = hit, orange = still to play / in play, red = missed,
 * amber = pushed (dropped from the ticket), grey = no result (couldn't be graded, e.g. a
 * player with no stats).
 */
export type DotKind = 'hit' | 'toPlay' | 'miss' | 'push' | 'none';

export const DOT_COLOR: Record<DotKind, string> = {
  hit: colors.win,
  toPlay: colors.toPlay,
  miss: colors.loss,
  push: colors.push,
  none: colors.textFaint,
};

export function LegDots({ kinds, size = 9 }: { kinds: DotKind[]; size?: number }) {
  return (
    <View style={styles.row}>
      {kinds.map((k, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: DOT_COLOR[k],
            opacity: k === 'none' ? 0.6 : 1,
          }}
        />
      ))}
    </View>
  );
}

/** The key: what each dot color means. */
export function DotLegend({ showNone = true }: { showNone?: boolean }) {
  const items: [DotKind, string][] = [
    ['hit', 'hit'],
    ['toPlay', 'to play'],
    ['miss', 'missed'],
    ...(showNone ? ([['none', 'no result']] as [DotKind, string][]) : []),
  ];
  return (
    <View style={styles.legend}>
      {items.map(([k, label]) => (
        <View key={k} style={styles.item}>
          <View style={[styles.legendDot, { backgroundColor: DOT_COLOR[k] }]} />
          <Text style={styles.legendText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  legend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
});
