import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { betChance, formatChance, legChance } from '../chance';
import { chanceColor, legsSummary, TeamLogo } from '../components/LiveLegs';
import { DotKind, DotLegend, LegDots } from '../components/LegDots';
import { betToWin, formatOdds } from '../odds';
import { SectionTitle } from '../components/ui';
import {
  findPlayerKey,
  gameLine,
  gradeMarket,
  LegProgress,
  LiveGame,
  TeamScore,
  useBetPhases,
  useLive,
} from '../live';
import { betMarkets, propLabel } from '../markets';
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
  const sk = g('forwards') ?? g('defenses') ?? g('skaters');
  if (sk) parts.push(`${sk.G} G, ${sk.A} A, ${sk.S} SOG${sk.BS && sk.BS !== '0' ? `, ${sk.BS} blk` : ''}`);
  const gl = g('goalies');
  if (gl) parts.push(`${gl.SV} saves, ${gl.GA} GA`);
  const d = g('defensive');
  if (d)
    parts.push(
      `${d.TOT} tkl (${d.SOLO} solo)${d.SACKS && d.SACKS !== '0' ? `, ${d.SACKS} sacks` : ''}${
        d.TFL && d.TFL !== '0' ? `, ${d.TFL} TFL` : ''
      }`,
    );
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
  const done = p.state === 'hit' || p.state === 'miss' || p.state === 'push';
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
          {p.state === 'hit'
            ? final
              ? '✅ '
              : '✓ '
            : p.state === 'miss'
              ? '❌ '
              : p.state === 'push'
                ? '↩️ Push · '
                : ''}
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

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

/** Dot color for a leg: green hit, orange still to play, red missed. */
function dotFor(state: LegProgress['state'], final = false): DotKind {
  if (state === 'hit') return 'hit';
  if (state === 'miss') return 'miss';
  if (state === 'push') return 'push';
  if (state === 'unknown' || final) return 'none';
  return 'toPlay';
}

/** The legs of these tickets that are on this game. */
function legsOnGame(
  bets: Bet[],
  game: LiveGame,
  legGames: Map<string, (LiveGame | undefined)[]>,
) {
  const out: { bet: Bet; label: string; market: ReturnType<typeof betMarkets>[number]['market'] }[] =
    [];
  for (const bet of bets) {
    const perLeg = legGames.get(bet.id) ?? [];
    betMarkets(bet).forEach((m, i) => {
      const g = perLeg[i] ?? (perLeg.length ? undefined : game);
      if (g?.eventId === game.eventId) out.push({ bet, label: m.label, market: m.market });
    });
  }
  return out;
}

/** Every player in your legs on this game: full stat line (live or final) and your props on them. */
function YourPlayers({ game, bets }: { game: LiveGame; bets: Bet[] }) {
  const { legGames } = useLive();
  const players = new Map<
    string,
    { name: string; props: { label: string; progress: LegProgress; odds: number | null }[] }
  >();
  for (const leg of legsOnGame(bets, game, legGames)) {
    const m = leg.market;
    if (m?.kind !== 'player') continue;
    const key = findPlayerKey(game, m.player) ?? norm(m.player);
    const entry = players.get(key) ?? { name: game.playerNames.get(key) ?? m.player, props: [] };
    const label = propLabel(m);
    if (!entry.props.some((p) => p.label === label))
      entry.props.push({ label, progress: gradeMarket(m, game), odds: null });
    players.set(key, entry);
  }
  if (!players.size) return null;
  const final = game.state === 'post';
  return (
    <>
      <SectionTitle>Your players · {final ? 'final stats' : 'live stats'}</SectionTitle>
      <View style={styles.panel}>
        {[...players.entries()].map(([key, p], i) => (
          <View key={key} style={[styles.playerRow, i > 0 && styles.divider]}>
            <Text style={styles.playerName}>{p.name}</Text>
            <Text style={styles.playerLine}>{statLine(game.players.get(key))}</Text>
            {p.props.map((prop) => {
              const st = prop.progress.state;
              const color =
                st === 'hit' ? colors.win : st === 'miss' ? colors.loss : colors.textDim;
              return (
                <View key={prop.label} style={styles.playerProp}>
                  <Text style={[styles.playerPropLabel, { color }]}>
                    {st === 'hit' ? (final ? '✅ ' : '✓ ') : st === 'miss' ? '❌ ' : '• '}
                    {prop.label}
                  </Text>
                  <Text style={[styles.playerPropValue, { color }]}>{prop.progress.text}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </>
  );
}

/** One box per ticket; each leg is graded against its own game. */
function TicketList({
  title,
  bets,
  fallback,
  showGameLines = false,
  startOpen = false,
  onEditBet,
}: {
  title: string;
  bets: Bet[];
  fallback?: LiveGame;
  showGameLines?: boolean;
  /** Show every ticket expanded (e.g. ones waiting for a Won/Lost/Push tap). */
  startOpen?: boolean;
  onEditBet: (b: Bet) => void;
}) {
  const { setStatus } = useStore();
  const { legGames } = useLive();
  // Tickets start condensed; tap one to see every leg.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(startOpen ? bets.map((b) => b.id) : []),
  );
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // One box per ticket: every leg graded, with the player's stat line.
  const tickets = useMemo(() => {
    const list = bets.map((bet) => {
      const perLeg = legGames.get(bet.id) ?? [];
      const legs = betMarkets(bet).map((m, i) => {
        const game = perLeg[i] ?? (perLeg.length ? undefined : fallback);
        const progress = gradeMarket(m.market, game);
        const chance = legChance(
          m.market,
          progress,
          game,
          bet.legs?.length ? bet.legs[i]?.odds : bet.odds,
        );
        const gameText = showGameLines ? (game ? gameLine(game) : 'Game not found yet') : null;
        const market = m.market;
        if (market?.kind === 'player') {
          const key = (game && findPlayerKey(game, market.player)) ?? norm(market.player);
          return {
            id: `${bet.id}-${i}`,
            player: game?.playerNames.get(key) ?? market.player,
            statLine: game ? statLine(game.players.get(key)) : 'Game not found yet',
            gameText,
            prop: {
              label: propLabel(market),
              progress,
              chance,
            },
          };
        }
        return {
          id: `${bet.id}-${i}`,
          player: null,
          statLine: null,
          gameText,
          prop: { label: m.label, progress, chance },
        };
      });
      const legGamesHere = betMarkets(bet).map(
        (_, i) => perLeg[i] ?? (perLeg.length ? undefined : fallback),
      );
      const overall: 'pre' | 'in' | 'post' = legGamesHere.every((g) => g?.state === 'post')
        ? 'post'
        : legGamesHere.some((g) => g?.state === 'in')
          ? 'in'
          : 'pre';
      const chances = legs.map((l) => l.prop.chance);
      const chance = betChance(chances);
      const summary = legsSummary(
        legs.map((l) => ({
          label: l.prop.label,
          progress: l.prop.progress,
          chance: l.prop.chance,
        })),
        overall,
      );
      return { bet, legs, chance, summary, overall };
    });
    // Tickets still alive first, best chance on top.
    return list.sort((a, b) => (b.chance ?? -1) - (a.chance ?? -1));
  }, [bets, fallback, legGames, showGameLines]);

  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      {tickets.map(({ bet, legs, chance, summary, overall }) => {
        const missed = legs.some((l) => l.prop.progress.state === 'miss');
        const allHit = legs.every((l) => l.prop.progress.state === 'hit');
        const borderColor = missed ? colors.loss : allHit ? colors.push : colors.border;
        const expanded = open.has(bet.id);
        return (
          <Pressable
            key={bet.id}
            onPress={() => toggle(bet.id)}
            style={[styles.ticket, { borderColor }]}
            accessibilityRole="button"
            accessibilityLabel={`${bet.pick}, ${expanded ? 'tap to collapse' : 'tap to expand'}`}
          >
            <View>
              <View style={styles.ticketHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.ticketTitle} numberOfLines={1}>
                    {bet.pick}
                  </Text>
                  <Text style={styles.ticketSub} numberOfLines={1}>
                    {[bet.book, bet.notes].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {chance !== null && !missed && overall !== 'post' ? (
                  <View style={[styles.bigChip, { borderColor: chanceColor(chance) }]}>
                    <Text style={[styles.bigChipText, { color: chanceColor(chance) }]}>
                      {formatChance(chance)}
                    </Text>
                    <Text style={styles.bigChipLabel}>to cash</Text>
                  </View>
                ) : null}
              </View>
              {!expanded ? (
                <>
                  <View style={styles.condensed}>
                    <Text style={styles.condensedText} numberOfLines={1}>
                      {money(bet.stake)} to win{' '}
                      <Text style={{ color: colors.accent, fontWeight: '800' }}>
                        {money(betToWin(bet))}
                      </Text>
                    </Text>
                    <LegDots kinds={legs.map((l) => dotFor(l.prop.progress.state))} />
                  </View>
                  {summary ? (
                    <Text style={[styles.ticketSummary, { color: summary.color }]}>
                      {summary.text}
                    </Text>
                  ) : null}
                  <Text style={styles.more}>▾ Tap to see every leg</Text>
                </>
              ) : null}
              {expanded ? (
              <View style={styles.statStrip}>
                {[
                  { label: 'Odds', value: formatOdds(bet.odds) },
                  { label: 'Wagered', value: money(bet.stake) },
                  { label: 'To win', value: money(betToWin(bet)), hi: true },
                  {
                    label: 'Payout',
                    value: money(bet.stake + betToWin(bet)),
                  },
                ].map((st) => (
                  <View key={st.label} style={styles.stat}>
                    <Text style={styles.statLabel}>{st.label}</Text>
                    <Text
                      style={[styles.statValue, st.hi && { color: colors.accent }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {st.value}
                    </Text>
                  </View>
                ))}
              </View>
              ) : null}
              {expanded && summary ? (
                <Text style={[styles.ticketSummary, { color: summary.color }]}>{summary.text}</Text>
              ) : null}
            </View>
            {expanded ? (
            <>
            {legs.map((leg) => (
              <View key={leg.id} style={styles.ticketLeg}>
                {leg.player ? (
                  <>
                    <Text style={styles.playerName}>{leg.player}</Text>
                    <Text style={styles.playerLine}>{leg.statLine}</Text>
                  </>
                ) : null}
                {leg.gameText ? <Text style={styles.legGameLine}>{leg.gameText}</Text> : null}
                <PropMeter prop={leg.prop} final={overall === 'post'} />
              </View>
            ))}
            {overall === 'post' ? (
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
            <Pressable
              onPress={() => onEditBet(bet)}
              style={({ pressed }) => [styles.detailsBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Text style={styles.detailsBtnText}>Bet details ›</Text>
            </Pressable>
            <Text style={[styles.more, { textAlign: 'center' }]}>Tap the ticket to collapse ▴</Text>
            </>
            ) : null}
          </Pressable>
        );
      })}
    </>
  );
}

function GameCast({
  game,
  gameBets,
  parlayBets,
  onEditBet,
}: {
  game: LiveGame;
  gameBets: Bet[];
  parlayBets: Bet[];
  onEditBet: (b: Bet) => void;
}) {
  const live = game.state === 'in';

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

      <YourPlayers game={game} bets={[...gameBets, ...parlayBets]} />

      {gameBets.length ? (
        <TicketList
          title={`Your Tickets (${gameBets.length})`}
          bets={gameBets}
          fallback={game}
          onEditBet={onEditBet}
        />
      ) : null}
      {parlayBets.length ? (
        <TicketList
          title={`Parlays with a leg in this game (${parlayBets.length})`}
          bets={parlayBets}
          showGameLines
          onEditBet={onEditBet}
        />
      ) : null}

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

interface GameEntry {
  game: LiveGame;
  /** Tickets entirely on this game. */
  single: Bet[];
  /** Multi-game parlays with at least one leg here. */
  parlays: Bet[];
}

/** How a ticket stands right now: chance to cash, any leg missed, all legs hit. */
function ticketStatus(bet: Bet, perLeg: (LiveGame | undefined)[], fallback?: LiveGame) {
  const states: LegProgress['state'][] = [];
  const chances: (number | null)[] = [];
  betMarkets(bet).forEach((m, i) => {
    const g = perLeg[i] ?? (perLeg.length ? undefined : fallback);
    const progress = gradeMarket(m.market, g);
    states.push(progress.state);
    chances.push(
      legChance(m.market, progress, g, bet.legs?.length ? bet.legs[i]?.odds : bet.odds),
    );
  });
  return {
    states,
    chance: betChance(chances),
    missed: states.includes('miss'),
    allHit: states.length > 0 && states.every((st) => st === 'hit' || st === 'push'),
  };
}

/** One scoreboard line per game; tapping it opens the full gamecast. */
function GameRow({
  entry,
  onPress,
}: {
  entry: GameEntry;
  onPress: () => void;
}) {
  const { legGames } = useLive();
  const { game } = entry;
  const live = game.state === 'in';
  const tickets = [...entry.single, ...entry.parlays];
  const statuses = tickets.map((b) => ticketStatus(b, legGames.get(b.id) ?? [], game));
  const alive = statuses.filter((st) => !st.missed);
  const best = alive.reduce<number | null>(
    (m, st) => (st.chance !== null && (m === null || st.chance > m) ? st.chance : m),
    null,
  );
  // Finished game: how your legs on it went.
  const here = legsOnGame(tickets, game, legGames).map((l) => gradeMarket(l.market, game).state);
  const hitN = here.filter((st) => st === 'hit').length;
  const missN = here.filter((st) => st === 'miss').length;
  const summary =
    game.state === 'post'
      ? `${here.length} leg${here.length === 1 ? '' : 's'} here · ${hitN} ✓${missN ? ` · ${missN} ✗` : ''}`
      : alive.length === 0
      ? `${tickets.length === 1 ? 'Ticket' : 'All tickets'} busted 💀`
      : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}` +
        (alive.length < tickets.length ? ` · ${alive.length} alive` : '') +
        (best !== null ? ` · best ${formatChance(best)} to cash` : '');
  const team = (t: TeamScore, leading: boolean) => (
    <View style={styles.rowTeam}>
      <TeamLogo team={t} size={22} />
      <Text style={[styles.rowAbbr, leading && { color: colors.text }]}>{t.abbr}</Text>
      <Text style={[styles.rowScore, leading && { color: colors.text }]}>{t.score}</Text>
      {t.hasBall ? <Text style={styles.rowBall}>🏈</Text> : null}
    </View>
  );
  const awayLead = Number(game.away.score) > Number(game.home.score);
  const homeLead = Number(game.home.score) > Number(game.away.score);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.gameRow,
        live && { borderColor: colors.loss + '88' },
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${game.away.short} at ${game.home.short}, tap for your bets`}
    >
      <View style={{ flex: 1, gap: 4 }}>
        {team(game.away, awayLead)}
        {team(game.home, homeLead)}
      </View>
      <View style={styles.rowRight}>
        <View style={styles.rowStatus}>
          {live ? <View style={styles.dot} /> : null}
          <Text style={[styles.rowStatusText, live && { color: colors.loss }]}>
            {live ? game.detail : game.state === 'post' ? 'FINAL' : game.detail}
          </Text>
        </View>
        <Text
          style={[
            styles.rowSummary,
            {
              color:
                game.state === 'post'
                  ? missN
                    ? colors.loss
                    : colors.win
                  : alive.length
                    ? best !== null
                      ? chanceColor(best)
                      : colors.textDim
                    : colors.loss,
            },
          ]}
          numberOfLines={1}
        >
          {summary}
        </Text>
        {/* One dot per leg you have in this game: green hit, orange to play, red missed. */}
        <LegDots
          kinds={legsOnGame(tickets, game, legGames).map((l) =>
            dotFor(gradeMarket(l.market, game).state, game.state === 'post'),
          )}
        />
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

export function LiveScreen({ onEditBet }: { onEditBet: (bet: Bet) => void }) {
  const { bets } = useStore();
  const { games, legGames, refresh, refreshing, lastError } = useLive();
  const [selected, setSelected] = useState<string | null>(null);
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const isMulti = (b: Bet) =>
    new Set((legGames.get(b.id) ?? []).filter(Boolean).map((g) => g!.eventId)).size > 1;
  const phaseOf = useBetPhases();

  // Every started game with at least one of your open legs on it.
  const { entries, multiBets } = useMemo(() => {
    const map = new Map<string, GameEntry>();
    const multi: Bet[] = [];
    const entry = (g: LiveGame) => {
      const e = map.get(g.eventId) ?? { game: g, single: [], parlays: [] };
      map.set(g.eventId, e);
      return e;
    };
    for (const b of bets) {
      if (b.status !== 'pending') continue;
      const phase = phaseOf(b);
      if (phase !== 'live' && phase !== 'settle') continue;
      if (isMulti(b)) {
        if (phase === 'live') multi.push(b);
        const seen = new Set<string>();
        for (const g of legGames.get(b.id) ?? []) {
          if (!g || g.state === 'pre' || seen.has(g.eventId)) continue;
          seen.add(g.eventId);
          entry(g).parlays.push(b);
        }
      } else {
        const g = games.get(b.id);
        if (!g || g.state === 'pre') continue;
        entry(g).single.push(b);
      }
    }
    return { entries: [...map.values()], multiBets: multi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bets, games, legGames]);

  const inProgress = entries.filter((e) => e.game.state === 'in');
  const completed = entries.filter((e) => e.game.state === 'post');
  const updated = entries[0]?.game.updatedAt;
  const ago = updated ? Math.max(0, Math.round((Date.now() - updated) / 1000)) : null;
  const open = selected ? entries.find((e) => e.game.eventId === selected) : undefined;
  // Games are over but the app couldn't call it (e.g. a player with no stats).
  const toSettle = bets.filter((b) => phaseOf(b) === 'settle');

  const refreshRow = (
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
  );

  // One game opened: its full gamecast with your tickets.
  if (open) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          onPress={() => setSelected(null)}
          style={styles.back}
          accessibilityRole="button"
          hitSlop={10}
        >
          <Text style={styles.backText}>‹ All games</Text>
        </Pressable>
        {refreshRow}
        <GameCast
          game={open.game}
          gameBets={open.single}
          parlayBets={open.parlays}
          onEditBet={onEditBet}
        />
        <Text style={styles.footnote}>
          Hit chances are rough estimates from each leg's pace and the time left (ESPN's win
          probability for moneylines). Same-game legs are treated as independent.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {refreshRow}

      {entries.length === 0 && !multiBets.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing live right now</Text>
          <Text style={styles.emptyText}>
            Tickets move here from Upcoming as soon as one of their games kicks off, with a live
            gamecast and every leg tracked.
          </Text>
        </View>
      ) : null}

      {inProgress.length ? (
        <>
          <SectionTitle>
            🔴 In progress ({inProgress.length}) · tap a game for your bets
          </SectionTitle>
          <View style={{ marginTop: -4, marginBottom: space.sm }}>
            <DotLegend showNone={false} />
          </View>
          {inProgress.map((e) => (
            <GameRow key={e.game.eventId} entry={e} onPress={() => setSelected(e.game.eventId)} />
          ))}
        </>
      ) : null}

      {multiBets.length ? (
        <View style={{ marginTop: inProgress.length ? space.lg : 0 }}>
          <TicketList
            title={`Your live slips · multi-game (${multiBets.length})`}
            bets={multiBets}
            showGameLines
            onEditBet={onEditBet}
          />
        </View>
      ) : null}

      {completed.length ? (
        <View style={{ marginTop: space.lg }}>
          <SectionTitle>✅ Completed games ({completed.length}) · tap for final stats</SectionTitle>
          {completed.map((e) => (
            <GameRow key={e.game.eventId} entry={e} onPress={() => setSelected(e.game.eventId)} />
          ))}
        </View>
      ) : null}

      {toSettle.length ? (
        <View style={{ marginTop: space.lg }}>
          <TicketList
            title={`✍️ Games over · needs your call (${toSettle.length})`}
            bets={toSettle}
            showGameLines
            startOpen
            onEditBet={onEditBet}
          />
          <Text style={styles.footnote}>
            The app couldn't grade these from the stats (usually a player who didn't play). Check
            your ticket and tap Won, Lost or Push.
          </Text>
        </View>
      ) : null}
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
  legGameLine: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  ticket: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: space.md,
    marginBottom: space.md,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ticketTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  ticketSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  statStrip: {
    flexDirection: 'row',
    marginTop: space.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: space.sm,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  condensed: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  condensedText: { flex: 1, minWidth: 0, color: colors.textDim, fontSize: 13 },
  legDots: { flexDirection: 'row', gap: 4 },
  legDot: { width: 9, height: 9, borderRadius: 5 },
  more: { color: colors.textFaint, fontSize: 12, fontWeight: '700', marginTop: space.sm },
  detailsBtn: {
    marginTop: space.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailsBtnText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
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
  back: { marginBottom: space.sm },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  rowTeam: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowAbbr: { color: colors.textDim, fontSize: 15, fontWeight: '800', width: 44 },
  rowScore: {
    color: colors.textDim,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 26,
  },
  rowBall: { fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 4, maxWidth: '58%' },
  rowStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowStatusText: { color: colors.textDim, fontSize: 12, fontWeight: '800' },
  rowSummary: { fontSize: 12, fontWeight: '700' },
  rowDots: { flexDirection: 'row', gap: 4 },
  chev: { color: colors.textFaint, fontSize: 24, fontWeight: '300' },
  playerProp: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  playerPropLabel: { fontSize: 13, fontWeight: '700', flex: 1 },
  playerPropValue: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  footnote: {
    color: colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: space.md,
  },
});
