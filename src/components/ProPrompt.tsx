import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { saveProInterest } from '../cloudScan';
import { colors, radius, space } from '../theme';

/**
 * "Would you subscribe?" test for Bet Tracker Pro. Nothing is charged: the
 * answer is saved to public.pro_interest so the owner can see demand.
 */
export function ProPrompt({ reason }: { reason?: string }) {
  const [answer, setAnswer] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [failed, setFailed] = useState(false);

  const pick = async (a: 'yes' | 'maybe' | 'no') => {
    setAnswer(a);
    setFailed(!(await saveProInterest(a)));
  };

  return (
    <View style={styles.box}>
      <Text style={styles.badge}>BET TRACKER PRO</Text>
      <Text style={styles.title}>Unlimited AI slip scanning · $1.99/mo</Text>
      {reason ? <Text style={styles.reason}>{reason}</Text> : null}
      {answer ? (
        <Text style={styles.thanks}>
          {failed
            ? "Couldn't save your answer — check your connection."
            : answer === 'yes'
              ? "Thanks! You're on the list — we'll let you know when Pro launches."
              : 'Thanks for the feedback!'}
        </Text>
      ) : (
        <>
          <Text style={styles.ask}>
            Would you subscribe? (Nothing is charged — this is a test.)
          </Text>
          <View style={styles.row}>
            {(
              [
                ['yes', 'Yes'],
                ['maybe', 'Maybe'],
                ['no', 'No'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => pick(key)}
                style={[styles.btn, key === 'yes' && styles.btnYes]}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, key === 'yes' && { color: colors.bg }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: space.lg,
    gap: space.sm,
  },
  badge: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  reason: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  ask: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  thanks: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', gap: space.sm, marginTop: 2 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  btnYes: { backgroundColor: colors.accent },
  btnText: { color: colors.text, fontWeight: '800', fontSize: 15 },
});
