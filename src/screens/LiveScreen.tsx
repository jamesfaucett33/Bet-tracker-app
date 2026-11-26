import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BetCard } from '../components/BetCard';
import { TeamLogo } from '../components/LiveLegs';
import { SectionTitle } from '../components/ui';
import { LiveGame, TeamScore, useLive } from '../live';
import { betMarkets } from '../markets';
import { useStore } from '../store';
import { colors, radius, space } from '../theme';
import { Bet } from '../types';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "18/27, 212 yds, 1 TD · 3 car, 4 yds" from a player's box score rows. */
function statLine(stats: Record<string, Record<string, string>> | undefined): string {
  if (!stats) return 'No stats yet';
  const parts: string[] = [];
  const g = (group: string) => stats[group];
  const p = g('passing');
  if (p)
    parts.push(`${p['C/ATT']} pass, ${p.YDS} yds${p.TD && p.TD !== '0' ? `, ${p.TD} TD` : ''}`);
  const r = g('rushing');
  if (r) parts.push(`${r.CAR} car, ${r.YDS} yds${r.TD && r.TD !== '0' ? `, ${r.TD} TD` : ''}`);
  const c = g('receiving');
  if (c)
    parts.push(
      `${c.REC}/${c.TGTS ?? '?'} rec, ${c.YDS} yds${c.TD && c.TD !== '0' ? `, ${c.TD} TD` : ''}`,
    );
  const k = g('kicking');
  if (k) parts.push(`FG ${k.FG}, long ${k.LONG}`);
  if (!parts.length) {
    // Basketball-style single group
    const row = Object.values(stats)[0] ?? {};
    const bits = ['PTS', 'REB', 'AST', '3PT']
      .filter((l) => row[l] !== undefined)
      .map((l) => `${row[l]} ${l.toLowerCase()}`);
    if (bits.length) parts.push(bits.join(', '));
  }
  return parts.join(' · ') || 'No stats yet';
}

function TeamColumn({ team, align }: { team: TeamScore; align: 'left' | 'right' }) {
  return (
    <View style={[styles.teamCol, align === 'right' && { alignItems: 'flex-end' }]}>
      <View style={[styles.teamTop, align === 'right' && { flexDirection: 'row-reverse' }]}>
        <TeamLogo team={team} size={40} />
        <Text style={styles.teamScore}>{team.score}</Text>
      </View>
      <Text style={styles.teamName} numberOfLines={1}>
        {team.hasBall ? (align === 'left' ? '🏈 ' : '') : ''}
        {team.short || team.abbr}
        {team.hasBall && align === 'right' ? ' 🏈' : ''}
      </Text>
    </View>
  );
}

function WinBar({ game }: { game: LiveGame }) {
  if (game.homeWinPct === null) return null;
  const home = Math.round(game.homeWinPct * 100);
  const away = 100 - home;
  return (
    <View style={{ marginTop: space.md }}>
      <View style={styles.winLabels}>
        <Text style={styles.winText}>
          {game.away.abbr} {away}%
        </Text>
        <Text style={styles.winTitle}>Win probability</Text>
        <Text style={styles.winText}>
          {home}% {game.home.abbr}
        </Text>
      </View>
      <View style={styles.winBar}>
        <View style={{ width: `${away}%`, backgroundColor: game.away.color ?? colors.textDim }} />
        <View style={{ width: `${home}%`, backgroundColor: game.home.color ?? colors.accent }} />
      </View>
    </View>
  );
}

function GameCast({
  game,
  gameBets,
  onEditBet,
}: {
  game: LiveGame;
  gameBets: Bet[];
  onEditBet: (b: Bet) => void;
}) {
  const live = game.state === 'in';
  // Players that appear on your tickets for this game.
  const players = useMemo(() => {
    const names = new Map<string, string>();
    for (const b of gameBets)
      for (const m of betMarkets(b))
        if (m.market?.kind === 'player') names.set(norm(m.market.player), m.market.player);
    return [...names.entries()].map(([key, name]) => ({
      name: game.playerNames.get(key) ?? name,
      line: statLine(game.players.get(key)),
    }));
  }, [gameBets, game]);

  return (
    <View style={{ marginBottom: space.xl }}>
      <View style={styles.board}>
        <View style={styles.boardRow}>
          <TeamColumn team={game.away} align="left" />
          <View style={styles.center}>
            <View style={[styles.badge, live && { backgroundColor: colors.loss + '26' }]}>
              {live ? <View style={styles.dot} /> : null}
              <Text style={[styles.badgeText, live && { color: colors.loss }]}>
                {live ? 'LIVE' : game.state === 'post' ? 'FINAL' : 'UPCOMING'}
              </Text>
            </View>
            {game.state !== 'post' ? <Text style={styles.clock}>{game.detail}</Text> : null}
          </View>
          <TeamColumn team={game.home} align="right" />
        </View>
        {game.downDistance ? <Text style={styles.down}>🏈 {game.downDistance}</Text> : null}
        <WinBar game={game} />
      </View>

      {players.length ? (
        <>
          <SectionTitle>Your Players</SectionTitle>
          <View style={styles.panel}>
            {players.map((p, i) => (
              <View key={p.name} style={[styles.playerRow, i > 0 && styles.divider]}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerLine}>{p.line}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle>Your Tickets ({gameBets.length})</SectionTitle>
      {gameBets.map((b) => (
        <BetCard key={b.id} bet={b} onPress={() => onEditBet(b)} />
      ))}

      {game.plays.length ? (
        <>
          <SectionTitle>Play by Play</SectionTitle>
          <View style={styles.panel}>
            {game.plays.map((p, i) => (
              <View key={i} style={[styles.playRow, i > 0 && styles.divider]}>
                <Text style={styles.playMeta}>
                  {p.period ? `Q${p.period} ` : ''}
                  {p.clock}
                </Text>
                <Text style={styles.playText}>{p.text}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {game.scoringPlays.length ? (
        <>
          <SectionTitle>Scoring</SectionTitle>
          <View style={styles.panel}>
            {game.scoringPlays.map((p, i) => (
              <View key={i} style={[styles.playRow, i > 0 && styles.divider]}>
                <Text style={styles.playMeta}>
                  {p.team ?? ''} · Q{p.period} {p.clock}
                </Text>
                <Text style={styles.playText}>{p.text}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

export function LiveScreen({ onEditBet }: { onEditBet: (bet: Bet) => void }) {
  const { bets } = useStore();
  const { games, refresh, refreshing, lastError } = useLive();
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // One gamecast per game, with the pending tickets on it.
  const byGame = useMemo(() => {
    const map = new Map<string, { game: LiveGame; bets: Bet[] }>();
    for (const b of bets) {
      if (b.status !== 'pending') continue;
      const g = games.get(b.id);
      if (!g) continue;
      const entry = map.get(g.eventId) ?? { game: g, bets: [] };
      entry.bets.push(b);
      map.set(g.eventId, entry);
    }
    // Live games first, then upcoming, then finished.
    const order = { in: 0, pre: 1, post: 2 } as const;
    return [...map.values()].sort((a, b) => order[a.game.state] - order[b.game.state]);
  }, [bets, games]);

  const updated = byGame[0]?.game.updatedAt;
  const ago = updated ? Math.max(0, Math.round((Date.now() - updated) / 1000)) : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.refreshRow}>
        <Text style={styles.refreshText}>
          {lastError
            ? `Update failed: ${lastError}`
            : ago !== null
              ? `Updated ${ago < 5 ? 'just now' : `${ago}s ago`} · refreshes every 30s`
              : refreshing
                ? 'Loading games…'
                : ''}
        </Text>
        <Pressable onPress={refresh} style={styles.refreshBtn} accessibilityRole="button">
          <Text style={styles.refreshBtnText}>{refreshing ? '…' : '↻ Refresh'}</Text>
        </Pressable>
      </View>

      {byGame.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No games to show</Text>
          <Text style={styles.emptyText}>
            Open bets on NFL, college football, NBA, NHL or MLB games show up here with a live
            gamecast once their game is found.
          </Text>
        </View>
      ) : (
        byGame.map(({ game, bets: gameBets }) => (
          <GameCast key={game.eventId} game={game} gameBets={gameBets} onEditBet={onEditBet} />
        ))
      )}
      <Text style={styles.footnote}>
        Hit chances are rough estimates from each leg's pace and the time left (ESPN's win
        probability for moneylines). Same-game legs are treated as independent.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 120 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md, gap: space.sm },
  refreshText: { color: colors.textFaint, fontSize: 12, flex: 1 },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  refreshBtnText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  board: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  boardRow: { flexDirection: 'row', alignItems: 'center' },
  teamCol: { flex: 1 },
  teamTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  teamScore: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  teamName: { color: colors.textDim, fontSize: 13, fontWeight: '700', marginTop: 4 },
  center: { alignItems: 'center', paddingHorizontal: space.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  badgeText: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.loss },
  clock: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 6 },
  down: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: space.md,
  },
  winLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  winText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  winTitle: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  winBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  playerRow: { padding: space.md },
  playerName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  playerLine: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  playRow: { padding: space.md },
  playMeta: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  playText: { color: colors.text, fontSize: 13, marginTop: 2, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: {
    color: colors.textDim,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  footnote: {
    color: colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: space.md,
  },
});
