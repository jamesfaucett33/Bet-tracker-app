import React, { useEffect, useState } from 'react';
import { fetchScanCredit, ScanCredit, scansLeft } from '../cloudScan';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSync } from '../sync';
import { colors, radius, space } from '../theme';
import { Button, Card, SectionTitle } from './ui';

function ago(ms: number | null): string {
  if (!ms) return 'not yet';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
}

/** Sign in / create account for cloud sync, or show sync status. */
export function AccountCard() {
  const sync = useSync();
  const [credit, setCredit] = useState<ScanCredit | null>(null);
  useEffect(() => {
    if (sync.email) fetchScanCredit().then(setCredit);
    else setCredit(null);
  }, [sync.email, sync.lastSync]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Change password (signed in)
  const [changing, setChanging] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const savePassword = async () => {
    if (newPw.length < 6) return setPwMsg({ text: 'Use 6 or more characters.', ok: false });
    if (newPw !== newPw2) return setPwMsg({ text: "The two passwords don't match.", ok: false });
    const err = await sync.changePassword(newPw);
    if (err) return setPwMsg({ text: err, ok: false });
    setNewPw('');
    setNewPw2('');
    setChanging(false);
    setPwMsg({ text: 'Password changed. Use it next time you sign in.', ok: true });
  };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (!sync.configured) return null;

  const run = async (fn: 'signIn' | 'signUp') => {
    if (!email.trim() || password.length < 6) {
      setMsg({ text: 'Enter your email and a password (6+ characters).', ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    const err = await sync[fn](email, password);
    setBusy(false);
    if (err === 'CHECK_EMAIL')
      setMsg({
        text: `Account created. Open the email sent to ${email.trim()}, tap the confirm link, then come back here and tap Sign In.`,
        ok: true,
      });
    else if (err) setMsg({ text: err, ok: false });
    else setPassword('');
  };

  return (
    <>
      <SectionTitle>Account & Cloud Backup</SectionTitle>
      <Card style={{ gap: space.md }}>
        {sync.email ? (
          <>
            <Text style={styles.signedIn}>☁️ Signed in as {sync.email}</Text>
            <Text style={styles.body}>
              {sync.state === 'syncing'
                ? 'Syncing…'
                : sync.state === 'error'
                  ? `Sync problem: ${sync.error}`
                  : `${sync.count} bet${sync.count === 1 ? '' : 's'} backed up · last sync ${ago(sync.lastSync)}`}
            </Text>
            <Text style={styles.fine}>
              Your bets are saved to your account and show up on every device and browser you sign
              in on.
            </Text>
            {credit ? (
              <Text style={styles.body}>
                ✨ Free AI scans:{' '}
                {credit.spent >= credit.limit
                  ? 'beta cap reached — contact James for options'
                  : `about ${scansLeft(credit)} scan${scansLeft(credit) === 1 ? '' : 's'} left`}{' '}
                · ${credit.spent.toFixed(2)} of ${credit.limit.toFixed(2)} used
              </Text>
            ) : null}
            <View style={styles.row}>
              <Button
                title="Sync Now"
                variant="secondary"
                onPress={sync.syncNow}
                style={{ flex: 1 }}
              />
              <Button
                title="Sign Out"
                variant="secondary"
                onPress={sync.signOut}
                style={{ flex: 1 }}
              />
            </View>
            {changing ? (
              <>
                <TextInput
                  value={newPw}
                  onChangeText={setNewPw}
                  placeholder="New password (6+ characters)"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry
                  autoComplete="new-password"
                  style={styles.input}
                />
                <TextInput
                  value={newPw2}
                  onChangeText={setNewPw2}
                  placeholder="New password again"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry
                  autoComplete="new-password"
                  style={styles.input}
                />
                <View style={styles.row}>
                  <Button title="Save Password" onPress={savePassword} style={{ flex: 1 }} />
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={() => {
                      setChanging(false);
                      setPwMsg(null);
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            ) : (
              <Button
                title="Change Password"
                variant="secondary"
                onPress={() => {
                  setChanging(true);
                  setPwMsg(null);
                }}
              />
            )}
            {pwMsg ? (
              <Text style={[styles.body, { color: pwMsg.ok ? colors.win : colors.loss }]}>
                {pwMsg.text}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.body}>
              Sign in so your bets are saved online and show up everywhere — Home Screen app,
              Safari, Chrome or a new phone.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password (6+ characters)"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              style={styles.input}
            />
            <View style={styles.row}>
              <Button
                title={busy ? '…' : 'Sign In'}
                onPress={() => run('signIn')}
                disabled={busy}
                style={{ flex: 1 }}
              />
              <Button
                title="Create Account"
                variant="secondary"
                onPress={() => run('signUp')}
                disabled={busy}
                style={{ flex: 1 }}
              />
            </View>
            {msg ? (
              <Text style={[styles.body, { color: msg.ok ? colors.accent : colors.loss }]}>
                {msg.text}
              </Text>
            ) : null}
            <Text style={styles.fine}>
              Bets already on this device are uploaded to your account when you sign in.
            </Text>
          </>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  signedIn: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  fine: { color: colors.textFaint, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', gap: space.sm },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
});
