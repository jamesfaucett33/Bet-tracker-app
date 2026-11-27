import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { fetchReferral, inviteLink, inviteText, REFERRAL_BONUS, ReferralInfo } from '../referral';
import { useSync } from '../sync';
import { colors, radius, space } from '../theme';
import { Button, Card } from './ui';

/** Profile → Invite friends: your code and link, share it, and who joined. */
export function InviteView({ onSignUp }: { onSignUp: () => void }) {
  const sync = useSync();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (sync.email) fetchReferral().then(setInfo);
  }, [sync.email]);

  const share = async () => {
    const text = inviteText(info?.code ?? null);
    const nav = globalThis.navigator as Navigator | undefined;
    if (Platform.OS === 'web' && nav?.share) {
      try {
        await nav.share({ text });
        return;
      } catch {
        // cancelled, fall through to copy
      }
    }
    try {
      await nav?.clipboard?.writeText(text);
      setNote('Invite copied. Paste it in a text or group chat.');
    } catch {
      setNote(text);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🎁</Text>
        <Text style={styles.heroTitle}>
          Give {REFERRAL_BONUS}, get {REFERRAL_BONUS}
        </Text>
        <Text style={styles.heroText}>
          Every friend who joins with your link gets {REFERRAL_BONUS} free bet uploads, and so do
          you. Bonus uploads never expire.
        </Text>
      </View>

      {!sync.email ? (
        <Card style={{ gap: space.md }}>
          <Text style={styles.body}>Create your free account to get your invite link.</Text>
          <Button title="Create free account" onPress={onSignUp} />
        </Card>
      ) : (
        <Card style={{ gap: space.md }}>
          <Text style={styles.label}>YOUR INVITE CODE</Text>
          <Text style={styles.code}>{info ? (info.code ?? 'Coming soon') : '…'}</Text>
          {info?.code ? (
            <Text style={styles.link} selectable>
              {inviteLink(info.code)}
            </Text>
          ) : null}
          <Button title="Share my invite" onPress={share} disabled={!info?.code} />
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <Text style={styles.body}>
            {info?.friends
              ? `🙌 ${info.friends} friend${info.friends === 1 ? '' : 's'} joined · +${Math.min(info.friends, 20) * REFERRAL_BONUS} uploads for you`
              : 'No friends yet. Your share cards carry your code too.'}
          </Text>
        </Card>
      )}

      <Text style={styles.fine}>
        Friends get their uploads once they confirm their email. You earn bonus uploads for up to
        20 friends. One account per person.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: space.xl,
  },
  heroEmoji: { fontSize: 44 },
  heroTitle: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  heroText: { color: colors.textDim, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  label: { color: colors.sky, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  code: { color: colors.brand, fontSize: 40, fontWeight: '900', letterSpacing: 4 },
  link: { color: colors.textDim, fontSize: 13 },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  note: { color: colors.money, fontSize: 13, fontWeight: '700' },
  fine: { color: colors.textFaint, fontSize: 12, lineHeight: 17 },
});
