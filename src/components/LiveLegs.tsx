import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { formatChance } from '../chance';
import { isCovering, LegProgress, LiveGame, TeamScore } from '../live';
import { dotCounts, dotForState, Dot } from './LegDots';
import { colors, radius, space } from '../theme';
import { Market } from '../types';

interface LegRow {
  label: string;
  market?: Market;
  progress: LegProgress;
  chance?: number | null;
  /** That leg's own game, for multi-game parlays. */
  gameText?: string;
}

/** Green when likely, amber when it's a coin flip, red when it's a long shot. */
export function chanceColor(c: number): string {
  if (c >= 0.6) return colors.win;
  if (c >= 0.3) return colors.push;
  return colors.loss;
}

export function TeamLogo({ team, size = 20 }: { team: TeamScore; size?: number }) {
  if (!team.logo) return null;
  return <Image source={{ uri: team.logo }} style={{ width: size, height: size }} />;
}

// Bars use the dot colors: green hit, orange pending, grey not started, red missed, amber push.
const STATE_COLOR = {
  hit: colors.win,
  miss: colors.loss,
  push: colors.push,
  live: colors.toPlay,
  pre: colors.textDim,
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
      <View style={styles.scoreRow}>
        <TeamLogo team={game.away} />
        <Text style={styles.score} numberOfLines={1}>
          {game.away.abbr} {game.away.score} – {game.home.score} {game.home.abbr}
        </Text>
        <TeamLogo team={game.home} />
      </View>
      {!final ? (
        <Text style={styles.clock} numberOfLines={1}>
          {game.detail}
        </Text>
      ) : null}
    </View>
  );
}

export function LiveLegs({ legs, final = false }: { legs: LegRow[]; final?: boolean }) {
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
        const barColor = color;
        return (
          <View key={i} style={styles.leg}>
            <View style={styles.legTop}>
              <Dot kind={dotForState(p.state)} />
              <Text style={styles.legLabel} numberOfLines={1}>
                {leg.label}
              </Text>
              <Text style={[styles.legValue, { color: p.state === 'live' ? colors.text : color }]}>
                {p.text}
              </Text>
              {leg.chance !== null &&
              leg.chance !== undefined &&
              (p.state === 'live' || p.state === 'pre') ? (
                <View style={[styles.chip, { borderColor: chanceColor(leg.chance) }]}>
                  <Text style={[styles.chipText, { color: chanceColor(leg.chance) }]}>
                    {formatChance(leg.chance)}
                  </Text>
                </View>
              ) : null}
            </View>
            {leg.gameText ? <Text style={styles.legGame}>{leg.gameText}</Text> : null}
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

export function legsSummary(
  legs: LegRow[],
  gameState: LiveGame['state'] = 'in',
): { text: string; color: string } | null {
  if (!legs.length) return null;
  const final = gameState === 'post';
  const kinds = legs.map((l) => dotForState(l.progress.state));
  const missed = kinds.includes('miss');
  const done = kinds.every((k) => k === 'hit' || k === 'push');
  if (missed) return { text: `Busted · ${dotCounts(kinds)}`, color: colors.loss };
  if (done && kinds.every((k) => k === 'push'))
    return { text: 'Final — every leg pushed: stake back', color: colors.push };
  if (done)
    return final
      ? { text: `Final — every leg hit: settling as Won`, color: colors.win }
      : { text: `${dotCounts(kinds)} — not official until the game ends`, color: colors.win };
  return { text: dotCounts(kinds), color: colors.text };
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
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 40,
    alignItems: 'center',
  },
  chipText: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  clock: { color: colors.textDim, fontSize: 12, marginLeft: 'auto' },
  legs: { marginTop: space.sm, gap: 10 },
  leg: {},
  legTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legIcon: { width: 18, fontSize: 12, color: colors.textDim, textAlign: 'center' },
  legGame: { color: colors.textFaint, fontSize: 11, marginLeft: 24, marginTop: 2 },
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
