import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AccountCard } from '../components/AccountCard';
import { TripsView } from '../components/TripsView';
import { setAlertsOn, useAlertsOn } from '../alerts';
import { InviteView } from '../components/InviteView';
import { TeamPicker } from '../components/TeamPicker';
import { Button, Card, confirm, Field, notify, SectionTitle } from '../components/ui';
import { parseNumber } from '../format';
import { cleanKey, testKey } from '../scan';
import { useStore } from '../store';
import { Bet } from '../types';
import { findPlan } from '../plans';
import { openPlans, useScanStatus } from '../scanStatus';
import { useSync } from '../sync';
import { findTeam } from '../teamThemes';
import { activeTeamId, colors, radius, space } from '../theme';

function ListEditor({
  title,
  items,
  onChange,
  placeholder,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft('');
  };
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card>
        <View style={styles.tags}>
          {items.map((it) => (
            <Text
              key={it}
              style={styles.tag}
              onPress={() => onChange(items.filter((x) => x !== it))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${it}`}
            >
              {it} ✕
            </Text>
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            style={styles.addInput}
            returnKeyType="done"
          />
          <Button title="Add" variant="secondary" onPress={add} style={{ paddingHorizontal: 18 }} />
        </View>
      </Card>
    </>
  );
}

type Page = 'menu' | 'account' | 'invite' | 'trips' | 'team' | 'bankroll' | 'lists' | 'backup' | 'ai' | 'danger';

export function SettingsScreen({
  onAddBet,
  onEditBet,
}: {
  onAddBet: (mode: 'scan' | 'manual') => void;
  onEditBet: (b: Bet) => void;
}) {
  const sync = useSync();
  const scan = useScanStatus();
  const [page, setPage] = useState<Page>('menu');
  const alerts = useAlertsOn();
  const teamName = findTeam(activeTeamId)?.name ?? 'BetKeyper (default)';
  const { settings, updateSettings, exportData, importData, clearAll, clearBets, bets } = useStore();
  const [bankroll, setBankroll] = useState(
    settings.startingBankroll ? String(settings.startingBankroll) : '',
  );
  const [unit, setUnit] = useState(String(settings.unitSize));
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [apiKey, setApiKey] = useState(settings.anthropicApiKey);
  const keySaved = !!settings.anthropicApiKey && apiKey === settings.anthropicApiKey;
  const [keyStatus, setKeyStatus] = useState<string | null>(null); // null | 'testing' | 'ok' | error

  const doExport = async () => {
    const json = exportData();
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bet-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    await Share.share({ message: json, title: 'BetKeyper backup' });
  };

  const doImport = () => {
    const res = importData(importText);
    if (res.ok) {
      notify('Import complete', `Imported ${res.count} bet${res.count === 1 ? '' : 's'}.`);
      setImportText('');
      setShowImport(false);
    } else {
      notify('Import failed', res.error);
    }
  };

  const PAGES: Record<Exclude<Page, 'menu'>, string> = {
    account: 'Account',
    trips: 'Trips',
    invite: 'Invite Friends',
    team: 'Team Colors',
    bankroll: 'Bankroll & Units',
    lists: 'Sportsbooks & Sports',
    backup: 'Backup & Import',
    ai: 'Your Own AI Key',
    danger: 'Delete Data',
  };

  if (page !== 'menu') {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setPage('menu')} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>‹ Profile & Settings</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{PAGES[page]}</Text>
        {page === 'account' ? <AccountCard /> : null}
        {page === 'trips' ? <TripsView onEditBet={onEditBet} /> : null}
        {page === 'invite' ? <InviteView onSignUp={() => setPage('account')} /> : null}
        {page === 'team' ? (
          <>
          <Card>
            <TeamPicker />
          </Card>
          </>
        ) : null}
        {page === 'bankroll' ? (
          <>
          <Card>
            <Field
              label="Starting bankroll ($)"
              value={bankroll}
              onChangeText={setBankroll}
              onBlur={() => {
                const n = parseNumber(bankroll);
                updateSettings({ startingBankroll: Number.isFinite(n) && n > 0 ? n : 0 });
              }}
              placeholder="e.g. 1000"
              keyboardType="decimal-pad"
              hint="Your dashboard will show your current bankroll."
            />
            <Field
              label="Unit size ($)"
              value={unit}
              onChangeText={setUnit}
              onBlur={() => {
                const n = parseNumber(unit);
                if (Number.isFinite(n) && n > 0) updateSettings({ unitSize: n });
                else setUnit(String(settings.unitSize));
              }}
              placeholder="10"
              keyboardType="decimal-pad"
            />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Show amounts in units</Text>
                <Text style={styles.switchHint}>
                  Display profit and stakes as units instead of dollars
                </Text>
              </View>
              <Switch
                value={settings.showUnits}
                onValueChange={(v) => updateSettings({ showUnits: v })}
                trackColor={{ true: colors.accentDim, false: colors.surfaceAlt }}
                thumbColor={settings.showUnits ? colors.accent : colors.textDim}
              />
            </View>
          </Card>
          </>
        ) : null}
        {page === 'lists' ? (
          <>
          <ListEditor
            title="Sportsbooks"
            items={settings.books}
            onChange={(books) => updateSettings({ books })}
            placeholder="Add a sportsbook"
          />
          <ListEditor
            title="Sports"
            items={settings.sports}
            onChange={(sports) => updateSettings({ sports: sports.length ? sports : ['Other'] })}
            placeholder="Add a sport or league"
          />
          </>
        ) : null}
        {page === 'backup' ? (
          <>
          <Card style={{ gap: space.md }}>
            <Text style={styles.body}>
              Export a backup file of your {bets.length} bet{bets.length === 1 ? '' : 's'} any time.
              When you're signed in, bets are also backed up to your account automatically.
            </Text>
            <Button title="Export Backup" variant="secondary" onPress={doExport} />
            <Button
              title={showImport ? 'Cancel Import' : 'Import Backup'}
              variant="secondary"
              onPress={() => setShowImport((v) => !v)}
            />
            {showImport ? (
              <>
                <TextInput
                  value={importText}
                  onChangeText={setImportText}
                  placeholder="Paste backup JSON here"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  style={styles.importBox}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button title="Import" onPress={doImport} disabled={!importText.trim()} />
              </>
            ) : null}
          </Card>
          </>
        ) : null}
        {page === 'ai' ? (
          <>
          <Card style={{ gap: space.md }}>
            <Text style={styles.body}>
              Optional. Signed-in accounts get free AI scans included. If you have your own Anthropic
              API key, add it here to scan on your own account instead (about 2–4¢ per scan).
            </Text>
            <Text
              style={styles.link}
              onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}
              accessibilityRole="link"
            >
              Get an API key at console.anthropic.com →
            </Text>
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-ant-…"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.keyInput}
            />
            <View style={styles.addRow}>
              <Button
                title={keySaved ? 'Key saved ✓' : 'Save Key'}
                onPress={() => {
                  const clean = cleanKey(apiKey);
                  setApiKey(clean);
                  setKeyStatus(null);
                  updateSettings({ anthropicApiKey: clean });
                }}
                disabled={keySaved || !cleanKey(apiKey)}
                style={{ flex: 1 }}
              />
              {settings.anthropicApiKey ? (
                <Button
                  title="Remove"
                  variant="secondary"
                  onPress={() => {
                    setApiKey('');
                    updateSettings({ anthropicApiKey: '' });
                  }}
                  style={{ paddingHorizontal: 18 }}
                />
              ) : null}
            </View>
            {settings.anthropicApiKey ? (
              <>
                <Text style={styles.fine}>
                  Saved key: {settings.anthropicApiKey.slice(0, 11)}…
                  {settings.anthropicApiKey.slice(-4)} ({settings.anthropicApiKey.length} characters).
                  The end should match the key shown in the Console.
                </Text>
                <Button
                  title={keyStatus === 'testing' ? 'Testing…' : 'Test Key'}
                  variant="secondary"
                  disabled={keyStatus === 'testing'}
                  onPress={async () => {
                    setKeyStatus('testing');
                    const err = await testKey(settings.anthropicApiKey);
                    setKeyStatus(err ?? 'ok');
                  }}
                />
                {keyStatus && keyStatus !== 'testing' ? (
                  <Text
                    style={[
                      styles.body,
                      { color: keyStatus === 'ok' ? colors.win : colors.loss, fontWeight: '600' },
                    ]}
                  >
                    {keyStatus === 'ok' ? '✓ Key works — scanning is ready.' : keyStatus}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Text style={styles.fine}>
              Your key is stored only on this device and is never included in backups. Slip photos are
              sent to Anthropic only to read them.
            </Text>
          </Card>
          </>
        ) : null}
        {page === 'danger' ? (
          <>
          <Button
            title={`Delete All Tickets (${bets.length})`}
            variant="danger"
            onPress={() =>
              confirm(
                'Delete all tickets?',
                `This permanently deletes all ${bets.length} tickets on this device and in your account. Your settings and API key stay.`,
                clearBets,
                'Delete Tickets',
              )
            }
          />
          <View style={{ height: space.md }} />
          <Button
            title="Delete All Data"
            variant="danger"
            onPress={() =>
              confirm(
                'Delete all data?',
                'This permanently deletes every ticket and resets all settings, including your API key.',
                clearAll,
                'Delete All',
              )
            }
          />
          </>
        ) : null}
      </ScrollView>
    );
  }

  const planName = scan ? (scan.plan === 'staff' ? 'Staff' : findPlan(scan.plan).name) : null;
  const initials = (sync.name || sync.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile card */}
      <Pressable
        onPress={() => setPage('account')}
        style={({ pressed }) => [styles.profile, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{sync.email ? initials : '👤'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName} numberOfLines={1}>
            {sync.email ? sync.name || 'Your account' : 'Create your free account'}
          </Text>
          <Text style={styles.profileSub} numberOfLines={1}>
            {sync.email ?? 'Back up your bets and get free bet uploads'}
          </Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </Pressable>
      {sync.email ? (
        <Pressable onPress={openPlans} style={styles.planBar} accessibilityRole="button">
          <Text style={styles.planPill}>{planName ?? '…'}</Text>
          <Text style={styles.planText}>
            {scan
              ? scan.plan === 'staff'
                ? 'Unlimited bet uploads'
                : `${scan.left} bet upload${scan.left === 1 ? '' : 's'} left`
              : 'Loading…'}
          </Text>
          <Text style={styles.planCta}>Plans ›</Text>
        </Pressable>
      ) : null}

      <MenuGroup title="Bets">
        <MenuRow icon="✍️" label="Enter a bet manually" sub="Type in any bet, any book" onPress={() => onAddBet('manual')} />
        <MenuRow icon="📷" label="Upload a bet slip" sub="Photo or screenshot, we fill in every leg" onPress={() => onAddBet('scan')} />
        <MenuRow
          icon="🎰"
          label="Trips"
          sub={(settings.trips ?? []).length ? `${(settings.trips ?? []).length} trip${(settings.trips ?? []).length === 1 ? '' : 's'}` : 'Vegas weekend? Track it as a trip'}
          onPress={() => setPage('trips')}
        />
      </MenuGroup>

      <MenuGroup title="Account">
        <MenuRow
          icon="👤"
          label={sync.email ? 'Account & password' : 'Sign in or create account'}
          onPress={() => setPage('account')}
        />
        <MenuRow icon="⚡" label="Plans & bet uploads" onPress={openPlans} />
        <MenuRow
          icon="🎁"
          label="Invite friends"
          sub="You both get 25 free bet uploads"
          onPress={() => setPage('invite')}
        />
      </MenuGroup>

      <MenuGroup title="Personalize">
        <MenuRow icon="🎨" label="Team colors" sub={teamName} onPress={() => setPage('team')} />
        <MenuRow
          icon="🔔"
          label={`Game-day pop-ups: ${alerts ? 'On' : 'Off'}`}
          sub="Cash / bust moments and legs as they land"
          onPress={() => setAlertsOn(!alerts)}
        />
        <MenuRow
          icon="💰"
          label="Bankroll & units"
          sub={settings.startingBankroll ? `Bankroll $${settings.startingBankroll} · unit $${settings.unitSize}` : `Unit $${settings.unitSize}`}
          onPress={() => setPage('bankroll')}
        />
        <MenuRow icon="📚" label="Sportsbooks & sports" onPress={() => setPage('lists')} />
      </MenuGroup>

      <MenuGroup title="Data">
        <MenuRow
          icon="☁️"
          label="Backup & import"
          sub={`${bets.length} bet${bets.length === 1 ? '' : 's'}`}
          onPress={() => setPage('backup')}
        />
        <MenuRow icon="🔑" label="Your own AI key" sub="Advanced" onPress={() => setPage('ai')} />
        <MenuRow icon="🗑️" label="Delete data" danger onPress={() => setPage('danger')} />
      </MenuGroup>

      <Text style={styles.footer}>
        BetKeyper v1.0 · Bet anywhere. Keep it here. · For personal record-keeping only. Please gamble responsibly. If you or
        someone you know has a gambling problem, call 1-800-GAMBLER.
      </Text>
    </ScrollView>
  );
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card style={{ padding: 0 }}>{children}</Card>
    </>
  );
}

function MenuRow({
  icon,
  label,
  sub,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
      accessibilityRole="button"
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.loss }]}>{label}</Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 120 },
  back: { paddingVertical: 6, alignSelf: 'flex-start' },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  pageTitle: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.bg, fontSize: 20, fontWeight: '900' },
  profileName: { color: colors.text, fontSize: 19, fontWeight: '900' },
  profileSub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  planBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  planPill: {
    color: colors.bg,
    backgroundColor: colors.brand,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  planText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  planCta: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '66',
  },
  rowIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  rowLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  chev: { color: colors.textFaint, fontSize: 24, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  switchHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  tag: {
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
  },
  addRow: { flexDirection: 'row', gap: space.sm },
  addInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    color: colors.text,
    fontSize: 15,
  },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  fine: { color: colors.textFaint, fontSize: 12, lineHeight: 17 },
  keyInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  importBox: {
    minHeight: 120,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    color: colors.text,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  footer: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: space.xl,
    lineHeight: 18,
  },
});
