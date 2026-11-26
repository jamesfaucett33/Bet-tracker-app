import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * One dot per leg, the same everywhere in the app:
 * green = hit, orange = pending (game in play), clear ring = game not started, red = missed,
 * amber = pushed (dropped from the ticket), grey = no result (couldn't be graded, e.g. a
 * player with no stats).
 */
export type DotKind = 'hit' | 'live' | 'toPlay' | 'miss' | 'push' | 'none';

export const DOT_COLOR: Record<DotKind, string> = {
  hit: colors.win,
  live: colors.toPlay,
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
          style={dotStyle(k, size)}
        />
      ))}
    </View>
  );
}

/** Not-started legs are clear rings; everything else is a filled dot. */
function dotStyle(k: DotKind, size: number) {
  return k === 'toPlay'
    ? {
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: colors.textDim, // clear ring: nothing has happened yet
      }
    : {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: DOT_COLOR[k],
        opacity: k === 'none' ? 0.6 : 1,
      };
}

/** "✓ 1 hit · 1 pending · 13 not started" (and missed / pushed / no result when there are any). */
export function dotCounts(kinds: DotKind[]): string {
  const n = (k: DotKind) => kinds.filter((x) => x === k).length;
  return [
    n('hit') ? `✓ ${n('hit')} hit` : '',
    n('live') ? `${n('live')} pending` : '',
    n('toPlay') ? `${n('toPlay')} not started` : '',
    n('miss') ? `${n('miss')} missed` : '',
    n('push') ? `${n('push')} pushed` : '',
    n('none') ? `${n('none')} no result` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The key: what each dot color means. */
export function DotLegend({ showNone = true }: { showNone?: boolean }) {
  const items: [DotKind, string][] = [
    ['hit', 'hit'],
    ['live', 'pending'],
    ['toPlay', 'not started'],
    ['miss', 'missed'],
    ...(showNone ? ([['none', 'no result']] as [DotKind, string][]) : []),
  ];
  return (
    <View style={styles.legend}>
      {items.map(([k, label]) => (
        <View key={k} style={styles.item}>
          <View style={dotStyle(k, 8)} />
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
