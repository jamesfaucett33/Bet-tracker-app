import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { confirm, notify } from './src/components/ui';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BetFormScreen } from './src/screens/BetFormScreen';
import { BetsScreen } from './src/screens/BetsScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LiveProvider } from './src/live';
import { StoreProvider, useStore } from './src/store';
import { colors, space } from './src/theme';
import { Bet } from './src/types';

type Tab = 'dashboard' | 'bets' | 'settings';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'bets', label: 'Bets', icon: '☰' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

const TITLES: Record<Tab, string> = {
  dashboard: 'Bet Tracker',
  bets: 'My Bets',
  settings: 'Settings',
};

/**
 * Web only: a link ending in #import=<base64 JSON> loads bets in one tap,
 * e.g. to share a set of tickets. The user confirms before anything is added.
 */
function useLinkImport() {
  const { loaded, importData } = useStore();
  useEffect(() => {
    if (!loaded || Platform.OS !== 'web') return;
    const hash = globalThis.location?.hash ?? '';
    if (!hash.startsWith('#import=')) return;
    const clear = () => globalThis.history?.replaceState(null, '', globalThis.location.pathname);
    let json = '';
    try {
      const b64 = decodeURIComponent(hash.slice('#import='.length));
      json = new TextDecoder().decode(
        Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
      );
      const parsed = JSON.parse(json);
      const count = Array.isArray(parsed) ? parsed.length : (parsed?.bets?.length ?? 0);
      confirm(
        'Import bets?',
        `This link adds ${count} bet${count === 1 ? '' : 's'}.`,
        () => {
          const res = importData(json);
          notify(
            res.ok ? 'Imported' : 'Import failed',
            res.ok ? `Added ${res.count} bets.` : res.error,
          );
        },
        'Import',
      );
    } catch {
      notify('Import failed', 'That import link is damaged.');
    }
    clear();
  }, [loaded, importData]);
}

function Main() {
  const { loaded } = useStore();
  useLinkImport();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('dashboard');
  // undefined = closed, null = new bet, Bet = editing
  const [editing, setEditing] = useState<Bet | null | undefined>(undefined);

  if (!loaded) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const openBet = (b: Bet) => setEditing(b);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Text style={styles.title}>{TITLES[tab]}</Text>
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {tab === 'dashboard' && <DashboardScreen onEditBet={openBet} />}
        {tab === 'bets' && <BetsScreen onEditBet={openBet} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      {tab !== 'settings' ? (
        <Pressable
          onPress={() => setEditing(null)}
          style={({ pressed }) => [
            styles.fab,
            { bottom: 72 + insets.bottom },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add bet"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabIcon, active && { color: colors.accent }]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && { color: colors.accent }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={editing !== undefined}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(undefined)}
      >
        <SafeAreaProvider>
          <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            {editing !== undefined ? (
              <BetFormScreen
                key={editing?.id ?? 'new'}
                bet={editing ?? undefined}
                onClose={() => setEditing(undefined)}
              />
            ) : null}
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <LiveProvider>
          <StatusBar style="light" />
          <Main />
        </LiveProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.lg, paddingBottom: space.sm, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: space.sm },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { color: colors.textFaint, fontSize: 20 },
  tabLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
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
  fabText: { color: colors.bg, fontSize: 34, fontWeight: '600', marginTop: -3 },
});
