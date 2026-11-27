import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { setAlertsOn, useAlertsOn } from '../alerts';
import { enablePush, NOTIFY_OPTIONS, pushAllowed, pushSupported, setNotifyPref, useNotifyPrefs } from '../notify';
import { useSync } from '../sync';
import { colors, space } from '../theme';
import { Button, Card, SectionTitle } from './ui';

/** Profile → Notifications: pick which alerts you get, in the app and on your phone. */
export function NotificationsView() {
  const prefs = useNotifyPrefs();
  const inApp = useAlertsOn();
  const sync = useSync();
  const [push, setPush] = useState<string | null>(null);
  useEffect(() => {
    pushAllowed().then((ok) => ok && setPush('on'));
  }, []);

  const row = (label: string, sub: string, value: boolean, onChange: (v: boolean) => void, emoji?: string) => (
    <View style={styles.row} key={label}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accentDim, false: colors.surfaceAlt }}
        thumbColor={value ? colors.accent : colors.textDim}
      />
    </View>
  );

  return (
    <View>
      <Card>
        {row('Game-day pop-ups in the app', 'Shown while BetKeyper is open', inApp, setAlertsOn, '🔔')}
      </Card>

      <SectionTitle>Tell me when…</SectionTitle>
      <Card style={{ padding: 0 }}>
        {NOTIFY_OPTIONS.map((o) =>
          row(
            o.label,
            o.phoneOnly ? `${o.sub} · phone notifications` : o.sub,
            prefs[o.key],
            (v) => setNotifyPref(o.key, v),
            o.emoji,
          ),
        )}
      </Card>

      <SectionTitle>Phone notifications</SectionTitle>
      {pushSupported() ? (
        <Card style={{ gap: space.md }}>
          <Text style={styles.body}>
            Get these on your lock screen, even when BetKeyper is closed.
          </Text>
          <Button
            title={push === 'on' ? 'Notifications are on ✓' : 'Turn on phone notifications'}
            disabled={push === 'on' || !sync.email}
            onPress={async () => setPush(await enablePush())}
          />
          {!sync.email ? <Text style={styles.sub}>Sign in first so we know where to send them.</Text> : null}
          {push === 'denied' ? (
            <Text style={styles.warn}>
              Notifications are blocked. Turn them on in your phone's Settings → BetKeyper.
            </Text>
          ) : null}
          {push === 'error' ? <Text style={styles.warn}>Couldn't turn them on. Try again.</Text> : null}
        </Card>
      ) : (
        <Card>
          <Text style={styles.body}>
            📱 Lock-screen notifications come with the BetKeyper app in the App Store. Your choices
            above are saved{sync.email ? ' to your account' : ''} and used as soon as you install it.
          </Text>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '55',
  },
  emoji: { fontSize: 20, width: 26, textAlign: 'center' },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  warn: { color: colors.toPlay, fontSize: 13, fontWeight: '600' },
});
