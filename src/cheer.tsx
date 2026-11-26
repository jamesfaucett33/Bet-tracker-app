import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from './theme';

/**
 * A friendly "good luck" card shown when tickets are saved, with a different
 * well-wish each time (never the same one twice in a row).
 */

const WISHES = [
  'Ticket locked in. May every leg hit. 🍀',
  'Good luck! Let’s cash this one. 💰',
  'It’s in. Now sit back and sweat it out. 😅',
  'Locked and loaded. Go get ’em! 🏈',
  'Fingers crossed, legs crossed, everything crossed. 🤞',
  'This one has winner written all over it. ✨',
  'The sportsbook is already nervous. 😏',
  'Wishing you clean covers and no bad beats. 🙏',
  'Here’s to green checkmarks all day. ✅',
  'Let it ride! 🎢',
  'Big ticket energy. Good luck! ⚡',
  'May the over be over and the under be under. 📈',
  'All the luck in the world on this one. 🌟',
  'Nothing to do now but cheer. Go team! 📣',
  'Cash it and go Hawks! 💚💙',
  'Good vibes only on this ticket. 😎',
  'Let’s get this bread. 🍞',
  'Luck is on the way. Enjoy the games! 🎉',
  'Lock it in. Sunday’s looking good. ☀️',
  'Here’s hoping the payout beats the hot dogs. 🌭',
];

let last = -1;
function pickWish(): string {
  let i = Math.floor(Math.random() * WISHES.length);
  if (i === last) i = (i + 1) % WISHES.length;
  last = i;
  return WISHES[i];
}

export interface CheerInfo {
  /** e.g. "Ticket saved" or "3 tickets saved" */
  title: string;
  /** Short lines under the wish: ticket names, to-win totals. */
  lines?: string[];
  /** Anything skipped (duplicates, photos to retake). */
  note?: string;
}

let show: ((c: CheerInfo & { wish: string }) => void) | null = null;

export function cheer(info: CheerInfo) {
  const payload = { ...info, wish: pickWish() };
  // Let the form's sheet close first so the card shows on the main screen.
  setTimeout(() => show?.(payload), 250);
}

export function CheerHost() {
  const [c, setC] = useState<(CheerInfo & { wish: string }) | null>(null);
  useEffect(() => {
    show = setC;
    return () => {
      show = null;
    };
  }, []);
  if (!c) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => setC(null)}>
      <Pressable style={styles.backdrop} onPress={() => setC(null)}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎟️</Text>
          <Text style={styles.title}>{c.title}</Text>
          <Text style={styles.wish}>{c.wish}</Text>
          {c.lines?.length ? (
            <View style={styles.lines}>
              {c.lines.map((l, i) => (
                <Text key={i} style={styles.line} numberOfLines={2}>
                  {l}
                </Text>
              ))}
            </View>
          ) : null}
          {c.note ? <Text style={styles.note}>{c.note}</Text> : null}
          <Pressable
            onPress={() => setC(null)}
            style={styles.btn}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Let’s go!</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000aa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: space.xl,
    alignItems: 'center',
  },
  emoji: { fontSize: 44 },
  title: { color: colors.accent, fontSize: 22, fontWeight: '800', marginTop: space.sm },
  wish: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: space.sm,
    lineHeight: 24,
  },
  lines: {
    alignSelf: 'stretch',
    marginTop: space.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  line: { color: colors.textDim, fontSize: 13 },
  note: { color: colors.textFaint, fontSize: 12, marginTop: space.md, textAlign: 'center' },
  btn: {
    marginTop: space.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 36,
  },
  btnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
});
