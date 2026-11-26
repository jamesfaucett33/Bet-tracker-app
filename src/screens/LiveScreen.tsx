import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { betChance, formatChance, legChance } from '../chance';
import { chanceColor, legsSummary, TeamLogo } from '../components/LiveLegs';
import { formatOdds, potentialProfit } from '../odds';
import { SectionTitle } from '../components/ui';
import { gradeMarket, LegProgress, LiveGame, TeamScore, useLive } from '../live';
import { betMarkets } from '../markets';
import { useStore } from '../store';
import { colors, radius, space, statusColor } from '../theme';
import { Bet, PLAYER_STATS } from '../types';

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

interface PlayerProp {
  label: string; // "60+ rushing yds"
  progress: LegProgress;
  chance: number | null;
}

/** One prop: label, current / target, progress bar and live chance. */
function PropMeter({ prop, final }: { prop: PlayerProp; final: boolean }) {
  const { progress: p, chance } = prop;
  const done = p.state === 'hit' || p.state === 'miss';
  const color =
    p.state === 'hit'
      ? colors.win
      : p.state === 'miss'
        ? colors.loss
        : chance !== null
          ? chanceColor(chance)
          : colors.pending;
  const fill =
    p.state === 'hit'
      ? 1
      : p.current !== null && p.target
        ? Math.min(1, Math.max(0, p.current / p.target))
        : 0;
  return (
    <View style={styles.prop}>
      <View style={styles.propTop}>
        <Text style={styles.propLabel} numberOfLines={1}>
          {p.state === 'hit' ? (final ? '✅ ' : '✓ ') : p.state === 'miss' ? '❌ ' : ''}
          {prop.label}
        </Text>
        <Text style={styles.propValue}>{p.text}</Text>
        {!done && chance !== null ? (
          <View style={[styles.chip, { borderColor: color }]}>
            <Text style={[styles.chipText, { color }]}>{formatChance(chance)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.round(fill * 100)}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
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
  const { setStatus } = useStore();
  // One box per ticket: every leg graded, with the player's stat line.
  const tickets = useMemo(() => {
    const list = gameBets.map((bet) => {
      const legs = betMarkets(bet).map((m, i) => {
        const progress = gradeMarket(m.market, game);
        const chance = legChance(m.market, progress, game);
        const market = m.market;
        if (market?.kind === 'player') {
          const key = norm(market.player);
          return {
            id: `${bet.id}-${i}`,
            player: game.playerNames.get(key) ?? market.player,
            statLine: statLine(game.players.get(key)),
            prop: {
              label: `${market.line}+ ${PLAYER_STATS[market.stat].toLowerCase()}`,
              progress,
              chance,
            },
          };
        }
        return {
          id: `${bet.id}-${i}`,
          player: null,
          statLine: null,
          prop: { label: m.label, progress, chance },
        };
      });
      const chances = legs.map((l) => l.prop.chance);
      const chance = betChance(chances);
      const summary = legsSummary(
        legs.map((l) => ({
          label: l.prop.label,
          progress: l.prop.progress,
          chance: l.prop.chance,
        })),
        game.state,
      );
      return { bet, legs, chance, summary };
    });
    // Tickets still alive first, best chance on top.
    return list.sort((a, b) => (b.chance ?? -1) - (a.chance ?? -1));
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

      <SectionTitle>Your Tickets ({tickets.length})</SectionTitle>
      {tickets.map(({ bet, legs, chance, summary }) => {
        const missed = legs.some((l) => l.prop.progress.state === 'miss');
        const allHit = legs.every((l) => l.prop.progress.state === 'hit');
        const borderColor = missed ? colors.loss : allHit ? colors.push : colors.border;
        return (
          <View key={bet.id} style={[styles.ticket, { borderColor }]}>
            <Pressable onPress={() => onEditBet(bet)} accessibilityRole="button">
              <View style={styles.ticketHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.ticketTitle} numberOfLines={1}>
                    {formatOdds(bet.odds)} · ${bet.stake.toFixed(2)} → $
                    {potentialProfit(bet.stake, bet.odds).toFixed(2)}
                  </Text>
                  <Text style={styles.ticketSub} numberOfLines={1}>
                    {bet.pick}
                    {bet.book ? ` · ${bet.book}` : ''}
                  </Text>
                </View>
                {chance !== null && !missed && game.state !== 'post' ? (
                  <View style={[styles.bigChip, { borderColor: chanceColor(chance) }]}>
                    <Text style={[styles.bigChipText, { color: chanceColor(chance) }]}>
                      {formatChance(chance)}
                    </Text>
                    <Text style={styles.bigChipLabel}>to cash</Text>
                  </View>
                ) : null}
              </View>
              {summary ? (
                <Text style={[styles.ticketSummary, { color: summary.color }]}>{summary.text}</Text>
              ) : null}
            </Pressable>
            {legs.map((leg) => (
              <View key={leg.id} style={styles.ticketLeg}>
                {leg.player ? (
                  <>
                    <Text style={styles.playerName}>{leg.player}</Text>
                    <Text style={styles.playerLine}>{leg.statLine}</Text>
                  </>
                ) : null}
                <PropMeter prop={leg.prop} final={game.state === 'post'} />
              </View>
            ))}
            {game.state === 'post' ? (
              <View style={styles.settleRow}>
                {(['won', 'lost', 'push'] as const).map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => setStatus(bet.id, st)}
                    style={[styles.settleBtn, { borderColor: statusColor[st] }]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.settleText, { color: statusColor[st] }]}>
                      {st === 'won' ? 'Won' : st === 'lost' ? 'Lost' : 'Push'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

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
  prop: { marginTop: space.sm },
  ticket: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: space.md,
    marginBottom: space.md,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ticketTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  ticketSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  ticketSummary: { fontSize: 13, fontWeight: '700', marginTop: space.sm },
  ticketLeg: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bigChip: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 62,
  },
  bigChipText: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bigChipLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
  settleRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  settleBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  settleText: { fontWeight: '700', fontSize: 13 },
  propTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  propLabel: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13, fontWeight: '600' },
  propValue: { color: colors.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 40,
    alignItems: 'center',
  },
  chipText: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    marginTop: 5,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
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
