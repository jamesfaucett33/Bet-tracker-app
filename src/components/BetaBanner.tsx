import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BETA_SCANS } from '../plans';
import { openPlans } from '../scanStatus';
import { useSync } from '../sync';
import { colors, radius, space } from '../theme';

const KEY = 'betkeeper:betaWelcome:';
const seen = (email: string) => {
  try {
    return globalThis.localStorage?.getItem(KEY + email) === '1';
  } catch {
    return false;
  }
};

/**
 * One-time "congratulations" banner for beta testers once they're signed in:
 * their counter is set to the beta bonus. Upgrades stay one tap away.
 */
export function BetaWelcome() {
  const sync = useSync();
  const [hidden, setHidden] = useState(false);
  if (!BETA_SCANS || !sync.email || hidden || seen(sync.email)) return null;
  const dismiss = () => {
    try {
      globalThis.localStorage?.setItem(KEY + sync.email, '1');
    } catch {
      // private mode: just hide it for now
    }
    setHidden(true);
  };
  return (
    <View style={styles.box}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Congratulations, beta tester!</Text>
      <Text style={styles.text}>
        You've got <Text style={styles.big}>{BETA_SCANS} free bet uploads</Text> a month while we're in
        beta. Snap or screenshot your tickets and we'll fill in every leg.
      </Text>
      <View style={styles.row}>
        <Pressable onPress={dismiss} style={[styles.btn, styles.btnMain]} accessibilityRole="button">
          <Text style={styles.btnMainText}>Let's go!</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            dismiss();
            openPlans();
          }}
          style={styles.btn}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>See plans</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Sign-up pitch above the account form. */
export function BetaSignupPitch() {
  if (!BETA_SCANS) return null;
  return (
    <View style={[styles.box, { marginBottom: 0 }]}>
      <Text style={styles.title}>🎉 Beta tester bonus</Text>
      <Text style={styles.text}>
        Create your free account now and get{' '}
        <Text style={styles.big}>{BETA_SCANS} free bet uploads</Text> a month for the whole beta.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
    alignItems: 'center',
  },
  emoji: { fontSize: 38 },
  title: { color: colors.text, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  text: { color: colors.textDim, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  big: { color: colors.brand, fontWeight: '900' },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.md, alignSelf: 'stretch' },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  btnMain: { backgroundColor: colors.brand },
  btnText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  btnMainText: { color: colors.bg, fontSize: 15, fontWeight: '900' },
});
