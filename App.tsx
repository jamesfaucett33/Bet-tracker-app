import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScanBadge } from './src/components/ScanBadge';
import { PlansScreen } from './src/screens/PlansScreen';
import { closePlans, usePlansOpen } from './src/scanStatus';
import { captureReferral } from './src/referral';

captureReferral();
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddMode, BetFormScreen } from './src/screens/BetFormScreen';
import { TicketScreen } from './src/screens/TicketScreen';
import { BetsScreen } from './src/screens/BetsScreen';
import { UpcomingScreen } from './src/screens/UpcomingScreen';
import { CheerHost } from './src/cheer';
import { AlertsHost } from './src/alerts';
import { LiveScreen } from './src/screens/LiveScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LiveProvider, useLive } from './src/live';
import { StoreProvider, useStore } from './src/store';
import { SyncProvider } from './src/sync';
import { colors, space } from './src/theme';
import { Bet } from './src/types';

type Tab = 'dashboard' | 'upcoming' | 'live' | 'bets' | 'settings';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'upcoming', label: 'Upcoming', icon: '◷' },
  { key: 'live', label: 'Live', icon: '◉' },
  { key: 'bets', label: 'Past', icon: '☰' },
  { key: 'settings', label: 'Profile', icon: '👤' },
];

/**
 * Web only: a link ending in #import=<base64 JSON> loads bets in one tap.
 * Shows an in-app banner (browser dialogs can be blocked on page load) and
 * also reacts when the link is opened in a tab that already has the app.
 */
function useLinkImport() {
  const { loaded, importData } = useStore();
  const [pending, setPending] = useState<{ json: string; count: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded || Platform.OS !== 'web') return;
    const check = () => {
      const hash = globalThis.location?.hash ?? '';
      if (!hash.startsWith('#import=')) return;
      globalThis.history?.replaceState(null, '', globalThis.location.pathname);
      try {
        let b64 = decodeURIComponent(hash.slice('#import='.length))
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .replace(/\s/g, '');
        while (b64.length % 4) b64 += '=';
        const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
        const parsed = JSON.parse(json);
        const count = Array.isArray(parsed) ? parsed.length : (parsed?.bets?.length ?? 0);
        setResult(null);
        setPending({ json, count });
      } catch {
        setResult('That import link is damaged — copy the whole link and try again.');
      }
    };
    check();
    globalThis.addEventListener?.('hashchange', check);
    return () => globalThis.removeEventListener?.('hashchange', check);
  }, [loaded]);

  const accept = () => {
    if (!pending) return;
    const res = importData(pending.json);
    setPending(null);
    setResult(res.ok ? `Added ${res.count} bet${res.count === 1 ? '' : 's'}.` : res.error);
  };
  return { pending, result, accept, dismiss: () => (setPending(null), setResult(null)) };
}

/**
 * Web only: notices when a newer version of the app has been published (the
 * page's script bundle changed) and offers a one-tap reload, so phones don't
 * keep running an old copy.
 */
function useUpdateCheck() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bundle = (html: string) => /_expo\/static\/js\/web\/index-[\w]+\.js/.exec(html)?.[0];
    const current = bundle(document.documentElement.innerHTML);
    if (!current) return;
    const check = async () => {
      try {
        const res = await fetch(`${location.pathname}?v=${Date.now()}`, { cache: 'no-store' });
        const latest = bundle(await res.text());
        if (latest && latest !== current) setReady(true);
      } catch {
        // offline: try again later
      }
    };
    check();
    const t = setInterval(check, 2 * 60 * 1000);
    const onShow = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, []);
  return ready;
}

function UpdateBanner() {
  const ready = useUpdateCheck();
  if (!ready) return null;
  return (
    <Pressable
      // A plain reload can come back with the browser's cached copy of the old
      // version for up to 10 minutes; a fresh URL always loads the new one.
      onPress={() => location.replace(`${location.pathname}?v=${Date.now()}`)}
      style={[styles.banner, { backgroundColor: colors.accent }]}
      accessibilityRole="button"
    >
      <Text style={[styles.bannerText, { color: colors.bg, fontWeight: '700' }]}>
        New version available — tap to update
      </Text>
    </Pressable>
  );
}

function ImportBanner({ link }: { link: ReturnType<typeof useLinkImport> }) {
  if (!link.pending && !link.result) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        {link.pending
          ? `Import ${link.pending.count} bet${link.pending.count === 1 ? '' : 's'} from this link?`
          : link.result}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {link.pending ? (
          <Pressable onPress={link.accept} style={[styles.bannerBtn, styles.bannerPrimary]}>
            <Text style={[styles.bannerBtnText, { color: colors.bg }]}>Import</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={link.dismiss} style={styles.bannerBtn}>
          <Text style={styles.bannerBtnText}>{link.pending ? 'Not now' : 'OK'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// On the web (home-screen app) read the notch / home-bar space from CSS
// directly; it's reliable everywhere, including inside pop-ups.
const WEB = Platform.OS === 'web';
const css = (v: string) => v as unknown as number;
const webTop = { paddingTop: css('env(safe-area-inset-top, 0px)') };
const webBottom = { paddingBottom: css('max(env(safe-area-inset-bottom, 0px), 8px)') };
const webFab = { bottom: css('calc(72px + env(safe-area-inset-bottom, 0px))') };
const webMenu = { bottom: css('calc(142px + env(safe-area-inset-bottom, 0px))') };

/**
 * Full-screen pop-up content kept clear of the iPhone notch / status bar and
 * home bar. On the web (home-screen app) the safe-area values come straight
 * from the browser, which is reliable inside pop-ups.
 */
function ModalSafe({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.root,
          {
            // CSS safe-area values; RN-web passes these through to the page.
            paddingTop: css('max(env(safe-area-inset-top, 0px), 8px)'),
            paddingBottom: css('env(safe-area-inset-bottom, 0px)'),
          },
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  );
}

function Main() {
  const { loaded } = useStore();
  const link = useLinkImport();
  const { games } = useLive();
  const anyLive = [...games.values()].some((g) => g.state === 'in');
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('dashboard');
  // Tabs opened from a box (e.g. Dashboard -> Upcoming) remember where they
  // came from, so a Back bar can return there. Tapping the tab bar clears it.
  const [backTo, setBackTo] = useState<Tab[]>([]);
  const goTo = (t: Tab) => {
    if (t === tab) return;
    setBackTo((h) => [...h, tab]);
    setTab(t);
  };
  const goBack = () => {
    const prev = backTo[backTo.length - 1];
    if (!prev) return;
    setBackTo((h) => h.slice(0, -1));
    setTab(prev);
  };
  // undefined = closed, null = new bet, Bet = editing
  const [editing, setEditing] = useState<Bet | null | undefined>(undefined);
  const plansOpen = usePlansOpen();
  const [addMenu, setAddMenu] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode | undefined>(undefined);
  const startAdd = (mode: AddMode) => {
    setAddMenu(false);
    setAddMode(mode);
    setEditing(null);
  };

  if (!loaded) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const openBet = (b: Bet) => {
    setAddMode(undefined);
    setEditing(b);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={WEB ? [] : ['top']} style={[styles.header, WEB && webTop]}>
        <View style={styles.brandRow}>
          <Image source={require('./assets/badge.png')} style={styles.badge} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              <Text style={{ color: colors.text }}>Bet</Text>
              <Text style={{ color: colors.brand }}>Keyper</Text>
            </Text>
            <Text style={styles.slogan} numberOfLines={1}>
              Every ticket. Every book. One place.
            </Text>
          </View>
          <ScanBadge />
        </View>
        <UpdateBanner />
        <ImportBanner link={link} />
      </SafeAreaView>

      {backTo.length ? (
        <Pressable onPress={goBack} style={styles.backBar} accessibilityRole="button">
          <Text style={styles.backText}>‹ Back to {TABS.find((x) => x.key === backTo[backTo.length - 1])?.label}</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {tab === 'dashboard' && (
          <DashboardScreen
            onEditBet={openBet}
            onViewBet={(b) => setViewing(b.id)}
            onOpenSettings={() => goTo('settings')}
            onOpenTab={goTo}
          />
        )}
        {tab === 'upcoming' && <UpcomingScreen onEditBet={openBet} onOpenLive={() => goTo('live')} />}
        {tab === 'live' && <LiveScreen onEditBet={openBet} />}
        {tab === 'bets' && <BetsScreen onEditBet={openBet} />}
        {tab === 'settings' && <SettingsScreen onAddBet={startAdd} onEditBet={openBet} />}
      </View>

      {addMenu ? (
        <>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setAddMenu(false)}
            accessibilityLabel="Close menu"
          />
          <View style={[styles.addMenu, WEB ? webMenu : { bottom: 142 + insets.bottom }]}>
            <Pressable
              onPress={() => startAdd('scan')}
              style={({ pressed }) => [styles.addItem, pressed && styles.addItemPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.addIcon}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.addTitle}>Scan photo(s)</Text>
                <Text style={styles.addSub}>Bet slip photos or screenshots</Text>
              </View>
            </Pressable>
            <View style={styles.addDivider} />
            <Pressable
              onPress={() => startAdd('manual')}
              style={({ pressed }) => [styles.addItem, pressed && styles.addItemPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.addIcon}>✍️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.addTitle}>Enter bet manually</Text>
                <Text style={styles.addSub}>Type in any bet slip</Text>
              </View>
            </Pressable>
          </View>
        </>
      ) : null}

      {tab !== 'settings' ? (
        <Pressable
          onPress={() => setAddMenu((v) => !v)}
          style={({ pressed }) => [
            styles.fab,
            WEB ? webFab : { bottom: 72 + insets.bottom },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add bet"
        >
          <Text style={[styles.fabText, addMenu && { transform: [{ rotate: '45deg' }] }]}>+</Text>
        </Pressable>
      ) : null}

      <View style={[styles.tabBar, WEB ? webBottom : { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                setAddMenu(false);
                setBackTo([]);
                setTab(t.key);
              }}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.tabIcon,
                  active && { color: colors.accent },
                  t.key === 'live' && anyLive && { color: colors.loss },
                  t.key === 'settings' && !active && { opacity: 0.45 }, // emoji ignores color
                ]}
              >
                {t.icon}
              </Text>
              <Text style={[styles.tabLabel, active && { color: colors.accent }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <CheerHost />
      <AlertsHost />

      <Modal
        visible={editing !== undefined}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(undefined)}
      >
        <SafeAreaProvider>
          <ModalSafe>
            {editing !== undefined ? (
              <BetFormScreen
                key={editing?.id ?? 'new'}
                bet={editing ?? undefined}
                mode={addMode}
                onClose={() => setEditing(undefined)}
              />
            ) : null}
          </ModalSafe>
        </SafeAreaProvider>
      </Modal>

      <Modal
        visible={viewing !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewing(null)}
      >
        <SafeAreaProvider>
          <ModalSafe>
            {viewing ? (
              <TicketScreen
                betId={viewing}
                onClose={() => setViewing(null)}
                onEdit={(b) => {
                  setViewing(null);
                  openBet(b);
                }}
              />
            ) : null}
          </ModalSafe>
        </SafeAreaProvider>
      </Modal>

      <Modal
        visible={plansOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePlans}
      >
        <SafeAreaProvider>
          <ModalSafe>
          {plansOpen ? (
            <PlansScreen
              onSignIn={() => {
                setEditing(undefined);
                setBackTo([]);
                setTab('settings');
              }}
            />
          ) : null}
          </ModalSafe>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <SyncProvider>
          <LiveProvider>
            <StatusBar style="light" />
            <Main />
          </LiveProvider>
        </SyncProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.lg, paddingBottom: space.sm, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 30 },
  slogan: { color: colors.textDim, fontSize: 10.5, fontWeight: '700', marginTop: 1 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.brand + '55',
  },
  badge: { width: 38, height: 38 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.brand + '66',
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { color: colors.textFaint, fontSize: 20 },
  tabLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  banner: {
    marginTop: space.sm,
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: space.sm,
  },
  bannerText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  bannerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  bannerPrimary: { backgroundColor: colors.accent },
  bannerBtnText: { color: colors.text, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: space.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  backBar: { paddingHorizontal: space.lg, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  fabText: { color: colors.bg, fontSize: 34, fontWeight: '600', marginTop: -3 },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  addMenu: {
    position: 'absolute',
    right: space.lg,
    width: 270,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.brand,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  addItemPressed: { backgroundColor: colors.surfaceAlt },
  addIcon: { fontSize: 24 },
  addTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  addSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  addDivider: { height: 1, backgroundColor: colors.border },
});
