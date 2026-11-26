import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isCovering, LegProgress, LiveGame } from '../live';
import { colors, radius, space } from '../theme';
import { Market } from '../types';

interface LegRow {
  label: string;
  market?: Market;
  progress: LegProgress;
}

const STATE_COLOR = {
  hit: colors.win,
  miss: colors.loss,
  live: colors.pending,
  pre: colors.textFaint,
  unknown: colors.textFaint,
} as const;

export function GameHeader({ game }: { game: LiveGame }) {
  const live = game.state === 'in';
  const final = game.state === 'post';
  return (
    <View style={styles.gameRow}>
      <View style={[styles.badge, live ? styles.badgeLive : final ? styles.badgeFinal : null]}>
        {live ? <View style={styles.dot} /> : null}
        <Text style={[styles.badgeText, live && { color: colors.loss }]}>
          {live ? 'LIVE' : final ? 'FINAL' : 'UPCOMING'}
        </Text>
      </View>
      <Text style={styles.score} numberOfLines={1}>
        {game.away.abbr} {game.away.score} – {game.home.abbr} {game.home.score}
      </Text>
      {!final ? (
        <Text style={styles.clock} numberOfLines={1}>
          {game.detail}
        </Text>
      ) : null}
    </View>
  );
}

export function LiveLegs({ legs }: { legs: LegRow[] }) {
  return (
    <View style={styles.legs}>
      {legs.map((leg, i) => {
        const p = leg.progress;
        const color = STATE_COLOR[p.state];
        const teamMarket =
          leg.market && (leg.market.kind === 'moneyline' || leg.market.kind === 'spread');
        const covering = isCovering(p, leg.market);
        let fill = 0;
        if (p.state === 'hit') fill = 1;
        else if (teamMarket) fill = covering ? 1 : 0.08;
        else if (p.current !== null && p.target)
          fill = Math.min(1, Math.max(0, p.current / p.target));
        const barColor =
          p.state === 'live' && teamMarket ? (covering ? colors.win : colors.loss) : color;
        return (
          <View key={i} style={styles.leg}>
            <View style={styles.legTop}>
              <Text style={styles.legIcon}>
                {p.state === 'hit' ? '✅' : p.state === 'miss' ? '❌' : '•'}
              </Text>
              <Text style={styles.legLabel} numberOfLines={1}>
                {leg.label}
              </Text>
              <Text style={[styles.legValue, { color: p.state === 'live' ? colors.text : color }]}>
                {p.text}
              </Text>
            </View>
            {p.state !== 'unknown' ? (
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.round(fill * 100)}%`, backgroundColor: barColor },
                  ]}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function legsSummary(legs: LegRow[]): { text: string; color: string } | null {
  const graded = legs.filter((l) => l.progress.state !== 'unknown');
  if (!graded.length) return null;
  const hit = graded.filter((l) => l.progress.state === 'hit').length;
  const missed = graded.some((l) => l.progress.state === 'miss');
  if (missed) return { text: 'A leg missed', color: colors.loss };
  if (hit === legs.length)
    return { text: `All ${legs.length} legs hit 🎉 — mark it Won`, color: colors.win };
  return { text: `${hit} of ${legs.length} legs hit`, color: colors.textDim };
}

const styles = StyleSheet.create({
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  badgeLive: { backgroundColor: colors.loss + '22' },
  badgeFinal: { backgroundColor: colors.surfaceAlt },
  badgeText: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.loss },
  score: { color: colors.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  clock: { color: colors.textDim, fontSize: 12, marginLeft: 'auto' },
  legs: { marginTop: space.sm, gap: 10 },
  leg: {},
  legTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legIcon: { width: 18, fontSize: 12, color: colors.textDim, textAlign: 'center' },
  legLabel: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13 },
  legValue: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    marginTop: 5,
    marginLeft: 24,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
});
