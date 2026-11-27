import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShareCardButton } from './components/ShareCardButton';
import { formatAmount } from './format';
import { useBetLive } from './live';
import { notifyPrefs } from './notify';
import { LOSS_TITLE, lossJoke, lossKind } from './lossKind';
import { betProfit, betToWin } from './odds';
import { useStore } from './store';
import { colors, radius, space } from './theme';
import { Bet } from './types';

/**
 * Game-day pop-ups while the app is open:
 * - a full-screen CASHED! / BUSTED moment when a ticket is decided,
 * - small banners as legs land ("2 of 3 legs in", "One leg away from $148").
 * Only changes seen while the app is open fire; nothing replays on launch.
 * Can be turned off in Profile.
 */

const KEY = 'betkeeper:alerts';
export function alertsOn(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}
let enabled = alertsOn();
const toggleListeners = new Set<() => void>();
export function setAlertsOn(on: boolean) {
  enabled = on;
  try {
    globalThis.localStorage?.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // private mode
  }
  toggleListeners.forEach((l) => l());
}
export function useAlertsOn(): boolean {
  return useSyncExternalStore(
    (l) => {
      toggleListeners.add(l);
      return () => toggleListeners.delete(l);
    },
    () => enabled,
  );
}

// ---- queue ----
type Moment = { kind: 'cash' | 'bust'; betId: string; leg?: string };
type Toast = { id: number; emoji: string; text: string; color: string };
let moment: Moment | null = null;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function pushMoment(m: Moment) {
  if (!enabled || !notifyPrefs()[m.kind === 'cash' ? 'cashed' : 'busted']) return;
  moment = m;
  emit();
  if (Platform.OS === 'web') (globalThis.navigator as Navigator | undefined)?.vibrate?.(m.kind === 'cash' ? [80, 60, 80, 60, 200] : 200);
}
function pushToast(emoji: string, text: string, color: string, pref: 'legs' | 'oneAway' = 'legs') {
  if (!enabled || !notifyPrefs()[pref]) return;
  const t = { id: nextId++, emoji, text, color };
  toasts = [...toasts.slice(-2), t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, 5000);
}

// ---- watchers ----
/** Last leg states seen this session, per bet. */
const seenLegs = new Map<string, string[]>();

/** Watches one open ticket's legs and announces the ones that land. */
function BetWatcher({ bet }: { bet: Bet }) {
  const { legs } = useBetLive(bet);
  const { settings } = useStore();
  const states = legs.map((l) => l.progress.state);
  const sig = states.join('|');
  useEffect(() => {
    const before = seenLegs.get(bet.id);
    seenLegs.set(bet.id, states);
    if (!before || before.length !== states.length) return; // first look: no replay
    const total = states.length;
    states.forEach((st, i) => {
      const was = before[i];
      // Only legs seen in progress, so a game that ended before you opened the app stays quiet.
      if (was === st || was !== 'live') return;
      const label = legs[i].label;
      if (st === 'hit') {
        const done = states.filter((x) => x === 'hit' || x === 'push').length;
        const left = states.filter((x) => x === 'live' || x === 'pre');
        const dead = states.includes('miss');
        if (total > 1 && left.length === 1 && !dead) {
          const last = legs[states.findIndex((x) => x === 'live' || x === 'pre')].label;
          pushToast('🔥', `One leg away from ${formatAmount(betToWin(bet), settings)}! Waiting on ${last}`, colors.toPlay, 'oneAway');
        } else {
          pushToast('✅', total > 1 ? `${label} hit! ${done} of ${total} legs in` : `${label} is in!`, colors.win);
        }
      } else if (st === 'miss' && total > 1) {
        pushToast('❌', `${label} missed`, colors.loss);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return null;
}

/** Mount once: watches every open ticket and every ticket's result. */
export function AlertsHost() {
  const { bets } = useStore();
  const open = bets.filter((b) => b.status === 'pending');
  const prev = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const now = new Map(bets.map((b) => [b.id, b.status]));
    const before = prev.current;
    prev.current = now;
    if (!before) return; // first load: no replay
    for (const b of bets) {
      if (before.get(b.id) !== 'pending' || b.status === 'pending') continue;
      // Decided while the app is open: auto-graded, or a win you just marked.
      if (b.status === 'won') pushMoment({ kind: 'cash', betId: b.id });
      else if (b.status === 'lost' && b.settledBy === 'auto') {
        const dead = b.legs?.find((l) => l.result === 'miss');
        pushMoment({ kind: 'bust', betId: b.id, leg: dead?.pick });
      }
    }
  }, [bets]);

  return (
    <>
      {open.map((b) => (
        <BetWatcher key={b.id} bet={b} />
      ))}
      <ToastStack />
      <MomentModal />
    </>
  );
}

function ToastStack() {
  const list = useSyncExternalStore(subscribe, () => toasts);
  if (!list.length) return null;
  return (
    <View style={styles.toastWrap} pointerEvents="box-none">
      {list.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => {
            toasts = toasts.filter((x) => x.id !== t.id);
            emit();
          }}
          style={[styles.toast, { borderColor: t.color }]}
          accessibilityRole="alert"
        >
          <Text style={styles.toastEmoji}>{t.emoji}</Text>
          <Text style={styles.toastText} numberOfLines={2}>
            {t.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const CONFETTI = ['💵', '💰', '🎉', '💸', '🤑', '💵', '🎊', '💰', '💸', '🎉', '💵', '🤑', '💰', '🎊'];

function MomentModal() {
  const m = useSyncExternalStore(subscribe, () => moment);
  const { bets, settings } = useStore();
  const bet = m ? bets.find((b) => b.id === m.betId) : undefined;
  const pop = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const [, force] = useState(0);

  useEffect(() => {
    if (!m) return;
    pop.setValue(0);
    fall.setValue(0);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    force((n) => n + 1);
  }, [m, pop, fall]);

  if (!m || !bet) return null;
  const close = () => {
    moment = null;
    emit();
  };
  const cash = m.kind === 'cash';
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { borderColor: cash ? colors.money : colors.loss, transform: [{ scale }] }]}>
          <Text style={styles.bigEmoji}>{cash ? '💰' : LOSS_TITLE[lossKind(bet)].emoji}</Text>
          <Text style={[styles.title, { color: cash ? colors.money : colors.loss }]}>
            {cash ? 'CASHED!' : LOSS_TITLE[lossKind(bet)].title}
          </Text>
          {!cash ? <Text style={styles.joke}>"{lossJoke(lossKind(bet), bet)}"</Text> : null}
          <Text style={styles.amount}>
            {cash
              ? `+${formatAmount(betProfit(bet), settings)}`
              : formatAmount(-bet.stake, settings, { sign: true })}
          </Text>
          <Text style={styles.pick} numberOfLines={2}>
            {bet.pick}
          </Text>
          {!cash && m.leg ? <Text style={styles.leg}>❌ {m.leg} missed</Text> : null}
          <ShareCardButton bet={bet} />
          <Pressable onPress={close} style={styles.done} accessibilityRole="button">
            <Text style={styles.doneText}>{cash ? "Let's go! 🙌" : 'On to the next one'}</Text>
          </Pressable>
        </Animated.View>
        {cash
          ? CONFETTI.map((e, i) => (
              <Animated.Text
                key={i}
                pointerEvents="none"
                style={[
                  styles.confetti,
                  {
                    left: `${6 + i * 12}%`,
                    transform: [
                      { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-60 - (i % 5) * 70, 760 + (i % 4) * 50] }) },
                      { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? 240 : -200}deg`] }) },
                    ],
                  },
                ]}
              >
                {e}
              </Animated.Text>
            ))
          : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', top: 110, left: space.lg, right: space.lg, gap: space.sm, zIndex: 50 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastEmoji: { fontSize: 22 },
  toastText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: space.xl, overflow: 'hidden' },
  confetti: { position: 'absolute', top: 0, fontSize: 34, zIndex: 5 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderRadius: 28,
    padding: space.xl,
    alignItems: 'stretch',
  },
  bigEmoji: { fontSize: 64, textAlign: 'center' },
  title: { fontSize: 44, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  amount: { color: colors.text, fontSize: 40, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  pick: { color: colors.textDim, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: space.sm },
  joke: { color: colors.text, fontSize: 16, fontWeight: '800', fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  leg: { color: colors.loss, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  done: { paddingVertical: 14, alignItems: 'center', marginTop: space.sm },
  doneText: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
