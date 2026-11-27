import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchReferral, inviteText } from '../referral';
import { canMakeCards, cardKind, CardKind, drawCard, shareCard } from '../shareCard';
import { colors, radius, space } from '../theme';
import { Bet } from '../types';
import { Button } from './ui';

/**
 * "Share this win" / "Share this bad beat" for a settled ticket: draws the
 * card, shows a preview, and opens the share sheet from the preview (a fresh
 * tap, which iPhones require for sharing files).
 */
export function ShareCardButton({ bet }: { bet: Bet }) {
  const kind = cardKind(bet);
  const [card, setCard] = useState<{ blob: Blob; url: string; kind: CardKind; code: string | null } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!kind || !canMakeCards()) return null;

  const open = async () => {
    setBusy(true);
    try {
      const code = (await fetchReferral().catch(() => null))?.code ?? null;
      const blob = await drawCard(bet, code);
      setCard({ blob, url: URL.createObjectURL(blob), kind, code });
      setNote(null);
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (card) URL.revokeObjectURL(card.url);
    setCard(null);
  };

  return (
    <>
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.btn,
          { borderColor: kind === 'win' ? colors.money : colors.loss },
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.btnText}>
            {kind === 'win' ? '💰 Share this win' : '💀 Share this bad beat'}
          </Text>
        )}
      </Pressable>
      <Modal visible={!!card} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {card ? (
              <Image source={{ uri: card.url }} style={styles.preview} resizeMode="contain" />
            ) : null}
            <Button
              title="Share"
              onPress={async () => {
                if (!card) return;
                const r = await shareCard(card.blob, card.kind, inviteText(card.code, card.kind));
                if (r === 'saved') setNote('Saved to your downloads.');
                if (r === 'shared') close();
              }}
              style={{ marginTop: space.md }}
            />
            {card?.code ? (
              <Text style={styles.note}>
                🎁 Your invite code is on the card. Friends who join with it get 25 free bet uploads, and
                so do you.
              </Text>
            ) : null}
            {note ? <Text style={styles.note}>{note}</Text> : null}
            <Button title="Close" variant="secondary" onPress={close} style={{ marginTop: space.sm }} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: space.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  btnText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  preview: { width: '100%', aspectRatio: 1080 / 1350, borderRadius: radius.md },
  note: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: space.sm },
});
