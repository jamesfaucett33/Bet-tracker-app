import React, { useState } from 'react';
import {
  Linking,
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
import { TeamPicker } from '../components/TeamPicker';
import { Button, Card, confirm, Field, notify, SectionTitle } from '../components/ui';
import { parseNumber } from '../format';
import { cleanKey, testKey } from '../scan';
import { useStore } from '../store';
import { colors, radius, space } from '../theme';

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

export function SettingsScreen() {
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

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <AccountCard />

      <SectionTitle>Team Colors</SectionTitle>
      <Card>
        <TeamPicker />
      </Card>

      <SectionTitle>Bankroll & Units</SectionTitle>
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

      <SectionTitle>Advanced: Your Own AI Key</SectionTitle>
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

      <SectionTitle>Backup</SectionTitle>
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

      <SectionTitle>Danger Zone</SectionTitle>
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

      <Text style={styles.footer}>
        BetKeyper v1.0 · Bet anywhere. Keep it here. · For personal record-keeping only. Please gamble responsibly. If you or
        someone you know has a gambling problem, call 1-800-GAMBLER.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 120 },
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
