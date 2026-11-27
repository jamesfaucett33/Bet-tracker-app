import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Segmented } from './ui';
import { BETA_SCANS } from '../plans';
import { openPlans, useScanStatus } from '../scanStatus';
import { findTeam, League, LEAGUES, TEAMS_BY_LEAGUE, teamPalette } from '../teamThemes';
import { activeTeamId, colors, radius, setTeamTheme, space } from '../theme';

const DEFAULT = { id: null, label: 'BetKeyper', bg: '#061733', accent: '#7BEA2B', second: '#3CC4FF' };

function Swatch({
  label,
  bg,
  accent,
  second,
  selected,
  onPress,
  locked,
}: {
  label: string;
  bg: string;
  accent: string;
  second: string;
  selected: boolean;
  onPress: () => void;
  locked?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} colors`}
      style={[styles.swatch, { backgroundColor: bg }, selected && styles.swatchOn]}
    >
      <View style={styles.bars}>
        <View style={[styles.bar, { backgroundColor: accent }]} />
        <View style={[styles.bar, { backgroundColor: second }]} />
      </View>
      <Text style={[styles.swatchLabel, { color: accent }]} numberOfLines={1}>
        {locked ? '🔒 ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Pick a favorite team (NFL, NBA, MLB or NHL) and the app takes on its
 * colors. NFL is free; other leagues come with Pro and up (free in the beta).
 */
export function TeamPicker() {
  const [open, setOpen] = useState(false);
  const current = findTeam(activeTeamId);
  const [league, setLeague] = useState<League>(current?.league ?? 'NFL');
  const scan = useScanStatus();
  const allLeagues =
    BETA_SCANS > 0 || ['pro', 'allpro', 'mvp', 'staff'].includes(scan?.plan ?? '');
  const locked = league !== 'NFL' && !allLeagues;

  return (
    <View style={{ gap: space.md }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.headRow} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={styles.headLabel}>{current ? current.name : 'BetKeyper (default)'}</Text>
          <Text style={styles.headHint}>
            Pick your favorite team (NFL, NBA, MLB or NHL) and the app takes on its colors.
          </Text>
        </View>
        <Text style={styles.change}>{open ? 'Close' : 'Change'}</Text>
      </Pressable>

      {open && (
        <>
          <Segmented<League>
            value={league}
            onChange={setLeague}
            options={LEAGUES.map((l) => ({ value: l, label: l }))}
          />
          {locked ? (
            <Text style={styles.lockNote} onPress={openPlans}>
              🔒 {league} colors come with Pro. See plans ›
            </Text>
          ) : null}
          <View style={styles.grid}>
            {league === 'NFL' ? (
              <Swatch
                label={DEFAULT.label}
                bg={DEFAULT.bg}
                accent={DEFAULT.accent}
                second={DEFAULT.second}
                selected={!current}
                onPress={() => current && setTeamTheme(null)}
              />
            ) : null}
            {TEAMS_BY_LEAGUE[league].map((t) => {
              const p = teamPalette(t);
              return (
                <Swatch
                  key={t.id}
                  label={t.abbr}
                  bg={p.bg}
                  accent={p.accent}
                  second={p.sky}
                  selected={current?.id === t.id}
                  locked={locked}
                  onPress={() =>
                    locked ? openPlans() : current?.id !== t.id && setTeamTheme(t.id)
                  }
                />
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  headHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  change: { color: colors.accent, fontSize: 14, fontWeight: '700', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lockNote: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  swatch: {
    width: 72,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 8,
    justifyContent: 'space-between',
  },
  swatchOn: { borderColor: '#FFFFFF', borderWidth: 3 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 8, borderRadius: 4 },
  swatchLabel: { fontSize: 13, fontWeight: '900' },
});
