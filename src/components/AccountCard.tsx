import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BETA_SCANS, findPlan } from '../plans';
import { BetaSignupPitch } from './BetaBanner';
import { clearReferral, pendingReferral, REFERRAL_BONUS } from '../referral';
import { openPlans, useScanStatus } from '../scanStatus';
import { useSync } from '../sync';
import { colors, radius, space } from '../theme';
import { Button, Card } from './ui';

function ago(ms: number | null): string {
  if (!ms) return 'not yet';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
}

function Check({
  on,
  onPress,
  label,
  fine,
  disabled,
}: {
  on: boolean;
  onPress: () => void;
  label: string;
  fine?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled }}
      style={[styles.check, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.box, on && styles.boxOn]}>
        {on ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        {fine ? <Text style={styles.fine}>{fine}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Sign in / create account for cloud sync, or show sync status. */
export function AccountCard() {
  const sync = useSync();
  const scan = useScanStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signUp' | 'signIn'>('signUp');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [optEmail, setOptEmail] = useState(true);
  const [optSms, setOptSms] = useState(false);
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

  const phoneDigits = phone.replace(/\D/g, '');
  const run = async (fn: 'signIn' | 'signUp') => {
    if (fn === 'signUp' && fullName.trim().split(/\s+/).length < 2) {
      setMsg({ text: 'Enter your full name (first and last).', ok: false });
      return;
    }
    if (!email.trim() || password.length < 6) {
      setMsg({ text: 'Enter your email and a password (6+ characters).', ok: false });
      return;
    }
    if (fn === 'signUp' && phone.trim() && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      setMsg({ text: 'Check your phone number (10 digits), or leave it blank.', ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    const err =
      fn === 'signUp'
        ? await sync.signUp(email, password, {
            full_name: fullName.trim().replace(/\s+/g, ' '),
            ...(phoneDigits ? { phone: phoneDigits } : {}),
            marketing_email: optEmail,
            marketing_sms: !!phoneDigits && optSms,
            ...(pendingReferral() ? { ref: pendingReferral()! } : {}),
          })
        : await sync.signIn(email, password);
    setBusy(false);
    const hadRef = fn === 'signUp' && !!pendingReferral();
    if (fn === 'signUp' && (err === 'CHECK_EMAIL' || !err)) clearReferral();
    if (err === 'CHECK_EMAIL')
      setMsg({
        text: `🎉 Account created${hadRef ? ` — your ${REFERRAL_BONUS} bonus uploads unlock when you confirm your email` : BETA_SCANS ? ` — your ${BETA_SCANS} free beta bet uploads are waiting` : ''}. Open the email sent to ${email.trim()}, tap the confirm link, then come back here and tap Sign In.`,
        ok: true,
      });
    else if (err) setMsg({ text: err, ok: false });
    else setPassword('');
  };

  return (
    <>
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
            {scan ? (
              <Pressable onPress={openPlans} accessibilityRole="button" style={styles.planRow}>
                <Text style={styles.body}>
                  ⚡ {scan.plan === 'staff' ? 'Staff · unlimited bet uploads' : `${findPlan(scan.plan).name} plan · ${scan.left} bet upload${scan.left === 1 ? '' : 's'} left`}
                </Text>
                <Text style={styles.planLink}>See plans ›</Text>
              </Pressable>
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
            {pendingReferral() && mode === 'signUp' ? (
              <View style={styles.refBox}>
                <Text style={styles.refTitle}>🎁 Your friend gave you {REFERRAL_BONUS} free bet uploads</Text>
                <Text style={styles.body}>
                  Create your account and confirm your email to claim them. Your friend gets{' '}
                  {REFERRAL_BONUS} too.
                </Text>
              </View>
            ) : (
              <BetaSignupPitch />
            )}
            {sync.signedOutNote ? (
              <Text style={[styles.body, { color: colors.push, fontWeight: '700' }]}>
                {sync.signedOutNote}
              </Text>
            ) : null}
            <Text style={styles.body}>
              Sign in so your bets are saved online and show up everywhere — Home Screen app,
              Safari, Chrome or a new phone.
            </Text>
            {mode === 'signUp' ? (
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full name"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                style={styles.input}
              />
            ) : null}
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
            {mode === 'signUp' ? (
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Mobile number (optional)"
                placeholderTextColor={colors.textFaint}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                style={styles.input}
              />
            ) : null}
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'signUp' ? 'Create a password (6+ characters)' : 'Password'}
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signUp' ? 'new-password' : 'password'}
              style={styles.input}
            />
            {mode === 'signUp' ? (
              <View style={{ gap: space.sm }}>
                <Check
                  on={optEmail}
                  onPress={() => setOptEmail((v) => !v)}
                  label="Email me tips, offers and BetKeyper news"
                />
                <Check
                  on={!!phoneDigits && optSms}
                  disabled={!phoneDigits}
                  onPress={() => setOptSms((v) => !v)}
                  label={
                    phoneDigits
                      ? 'Text me offers and updates'
                      : 'Text me offers and updates (add a mobile number)'
                  }
                  fine="Message frequency varies. Msg & data rates may apply. Reply STOP to cancel anytime. Not required to sign up."
                />
              </View>
            ) : null}
            <Button
              title={busy ? '…' : mode === 'signUp' ? 'Create Free Account' : 'Sign In'}
              onPress={() => run(mode)}
              disabled={busy}
            />
            <Text style={styles.switchText}>
              {mode === 'signUp' ? 'Already have an account? ' : 'New to BetKeyper? '}
              <Text
                style={styles.switchLink}
                onPress={() => {
                  setMode(mode === 'signUp' ? 'signIn' : 'signUp');
                  setMsg(null);
                }}
                accessibilityRole="button"
              >
                {mode === 'signUp' ? 'Sign in' : 'Create an account'}
              </Text>
            </Text>
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
  refBox: {
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 6,
    backgroundColor: colors.surface,
  },
  refTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planLink: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  signedIn: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  fine: { color: colors.textFaint, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', gap: space.sm },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tick: { color: colors.bg, fontSize: 14, fontWeight: '900', lineHeight: 16 },
  checkLabel: { color: colors.text, fontSize: 14, lineHeight: 20 },
  switchText: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  switchLink: { color: colors.accent, fontWeight: '800' },
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
