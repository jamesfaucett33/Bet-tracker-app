import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBetLive } from '../live';
import { lossKind } from '../lossKind';
import { fetchReferral, inviteText } from '../referral';
import {
  canMakeCards,
  cardKind,
  CardKind,
  cardLinksLive,
  cardTitle,
  drawCard,
  shareCard,
  shareLink,
  uploadCard,
} from '../shareCard';
import { colors, radius, space } from '../theme';
import { Bet } from '../types';
import { Button } from './ui';

/**
 * "Share this bet" for any ticket (open, live, won, lost): draws the card,
 * shows a preview, and opens the share sheet from the preview (a fresh tap,
 * which iPhones require for sharing files). `compact` is the small icon used
 * on ticket rows.
 */
export function ShareCardButton({ bet, compact }: { bet: Bet; compact?: boolean }) {
  const { legGames, legs: liveLegs } = useBetLive(bet);
  const live = bet.status === 'pending' && legGames.some((g) => g?.state === 'in');
  const kind = cardKind(bet, live);
  const [card, setCard] = useState<{
    blob: Blob;
    url: string;
    kind: CardKind;
    code: string | null;
    link: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!canMakeCards()) return null;

  const open = async () => {
    setBusy(true);
    try {
      const code = (await fetchReferral().catch(() => null))?.code ?? null;
      const now = liveLegs.map((l) => l.progress.state);
      const blob = await drawCard(bet, code, live, now);
      // On betkeyper.com: upload now, so Share sends one link whose preview is the card.
      const link = cardLinksLive()
        ? await uploadCard(blob, {
            title: cardTitle(bet, kind, now),
            description: inviteText(code, kind, kind === 'beat' ? lossKind(bet, now) : undefined).replace(/https?:\S+/, '').trim(),
            ref: code,
          })
        : null;
      setCard({ blob, url: URL.createObjectURL(blob), kind, code, link });
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
      {compact ? (
        <Pressable
          onPress={open}
          hitSlop={10}
          style={({ pressed }) => [styles.icon, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Share this bet"
        >
          {busy ? <ActivityIndicator size="small" color={colors.bg} /> : <Text style={styles.iconText}>📤 Share</Text>}
        </Pressable>
      ) : (
        <Pressable
          onPress={open}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.btnText}>
              {kind === 'win'
                ? '💰 Share this win'
                : kind === 'beat'
                  ? {
                      badBeat: '😩 Share this bad beat',
                      badBet: '🤡 Share this bad bet',
                      busted: '💀 Share this L',
                    }[lossKind(bet, liveLegs.map((l) => l.progress.state))]
                  : kind === 'live'
                    ? '🔥 Share this sweat'
                    : '📤 Share this bet'}
            </Text>
          )}
        </Pressable>
      )}
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
                const loss = card.kind === 'beat' ? lossKind(bet) : undefined;
                const r = card.link
                  ? await shareLink(card.link, inviteText(null, card.kind, loss).replace(/\s*https?:\S+$/, ''))
                  : await shareCard(card.blob, card.kind, inviteText(card.code, card.kind, loss));
                if (r === 'saved' && card.link) {
                  setNote('Link copied. Paste it in a text.');
                  return;
                }
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
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.brand,
  },
  btnText: { color: colors.bg, fontSize: 16, fontWeight: '900' },
  icon: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 64,
    alignItems: 'center',
  },
  iconText: { color: colors.bg, fontSize: 12, fontWeight: '900' },
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
