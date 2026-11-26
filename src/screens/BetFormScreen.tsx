import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, ChipRow, confirm, Field, Segmented } from '../components/ui';
import { formatAmount, isValidISODate, parseNumber, todayISO, uid } from '../format';
import {
  formatOdds,
  impliedProbability,
  isValidAmerican,
  parlayOdds,
  potentialProfit,
} from '../odds';
import { useStore } from '../store';
import { colors, radius, space, statusColor } from '../theme';
import { Bet, BET_TYPES, BetStatus, BetType } from '../types';

interface LegDraft {
  id: string;
  pick: string;
  odds: string;
}

const MULTI_LEG: BetType[] = ['Parlay', 'Teaser'];

export function BetFormScreen({ bet, onClose }: { bet?: Bet; onClose: () => void }) {
  const { settings, saveBet, deleteBet } = useStore();
  const isEdit = !!bet;

  const [date, setDate] = useState(bet?.date ?? todayISO());
  const [sport, setSport] = useState(bet?.sport ?? settings.sports[0] ?? 'Other');
  const [betType, setBetType] = useState<BetType>(bet?.betType ?? 'Spread');
  const [pick, setPick] = useState(bet?.pick ?? '');
  const [odds, setOdds] = useState(bet ? formatOdds(bet.odds) : '-110');
  const [stakeMode, setStakeMode] = useState<'$' | 'u'>('$');
  const [stake, setStake] = useState(bet ? String(bet.stake) : '');
  const [book, setBook] = useState(bet?.book ?? settings.books[0] ?? '');
  const [status, setStatus] = useState<BetStatus>(bet?.status ?? 'pending');
  const [notes, setNotes] = useState(bet?.notes ?? '');
  const [legs, setLegs] = useState<LegDraft[]>(
    bet?.legs?.map((l) => ({ id: l.id, pick: l.pick, odds: formatOdds(l.odds) })) ?? [
      { id: uid(), pick: '', odds: '-110' },
      { id: uid(), pick: '', odds: '-110' },
    ],
  );
  const [useLegs, setUseLegs] = useState<boolean>(bet ? !!bet.legs?.length : true);
  const [submitted, setSubmitted] = useState(false);

  const multiLeg = MULTI_LEG.includes(betType) && useLegs;
  const legOdds = legs.map((l) => parseNumber(l.odds));
  const computedParlay = multiLeg ? parlayOdds(legOdds) : NaN;
  const oddsNum = multiLeg ? computedParlay : parseNumber(odds);
  const stakeInput = parseNumber(stake);
  const stakeNum = stakeMode === 'u' ? stakeInput * settings.unitSize : stakeInput;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!isValidISODate(date)) e.date = 'Use YYYY-MM-DD';
    if (!isValidAmerican(oddsNum))
      e.odds = multiLeg
        ? 'Every leg needs valid odds (e.g. -110 or +150)'
        : 'American odds, e.g. -110 or +150';
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) e.stake = 'Enter an amount greater than 0';
    if (!multiLeg && !pick.trim()) e.pick = 'Describe your pick';
    return e;
  }, [date, oddsNum, stakeNum, pick, multiLeg]);

  const valid = Object.keys(errors).length === 0;
  const toWin = valid ? potentialProfit(stakeNum, oddsNum) : 0;
  const implied = impliedProbability(oddsNum);

  const save = () => {
    setSubmitted(true);
    if (!valid) return;
    const finalLegs = multiLeg
      ? legs.map((l) => ({ id: l.id, pick: l.pick.trim(), odds: parseNumber(l.odds) }))
      : undefined;
    const finalPick =
      pick.trim() || (finalLegs ? `${finalLegs.length}-leg ${betType.toLowerCase()}` : '');
    saveBet({
      id: bet?.id ?? uid(),
      createdAt: bet?.createdAt ?? Date.now(),
      date,
      sport,
      betType,
      pick: finalPick,
      odds: oddsNum,
      stake: Math.round(stakeNum * 100) / 100,
      book: book.trim(),
      status,
      notes: notes.trim() || undefined,
      legs: finalLegs,
    });
    onClose();
  };

  const remove = () =>
    confirm('Delete bet?', 'This cannot be undone.', () => {
      if (bet) deleteBet(bet.id);
      onClose();
    });

  const showErr = (k: string) => (submitted ? errors[k] : undefined);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Text style={styles.headerBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Bet' : 'New Bet'}</Text>
        <Pressable onPress={save} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.headerBtn, { color: colors.accent, fontWeight: '800' }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Sport</Text>
        <ChipRow options={settings.sports} value={sport} onChange={setSport} />

        <Text style={[styles.label, { marginTop: space.lg }]}>Bet Type</Text>
        <ChipRow options={BET_TYPES} value={betType} onChange={(v) => setBetType(v as BetType)} />

        <View style={{ height: space.lg }} />

        {MULTI_LEG.includes(betType) ? (
          <View style={styles.legsBox}>
            <View style={styles.legsHeader}>
              <Text style={styles.legsTitle}>Legs</Text>
              <Pressable onPress={() => setUseLegs((v) => !v)} accessibilityRole="button">
                <Text style={styles.link}>
                  {useLegs ? 'Enter total odds instead' : 'Enter each leg'}
                </Text>
              </Pressable>
            </View>
            {useLegs ? (
              <>
                {legs.map((leg, i) => (
                  <View key={leg.id} style={styles.legRow}>
                    <TextInput
                      value={leg.pick}
                      onChangeText={(t) =>
                        setLegs((ls) => ls.map((l) => (l.id === leg.id ? { ...l, pick: t } : l)))
                      }
                      placeholder={`Leg ${i + 1} (e.g. Chiefs ML)`}
                      placeholderTextColor={colors.textFaint}
                      style={[styles.legInput, { flex: 1 }]}
                    />
                    <TextInput
                      value={leg.odds}
                      onChangeText={(t) =>
                        setLegs((ls) => ls.map((l) => (l.id === leg.id ? { ...l, odds: t } : l)))
                      }
                      placeholder="-110"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="numbers-and-punctuation"
                      style={[
                        styles.legInput,
                        { width: 76, textAlign: 'center' },
                        submitted &&
                          !isValidAmerican(parseNumber(leg.odds)) && { borderColor: colors.loss },
                      ]}
                    />
                    {legs.length > 2 ? (
                      <Pressable
                        onPress={() => setLegs((ls) => ls.filter((l) => l.id !== leg.id))}
                        hitSlop={8}
                        accessibilityLabel={`Remove leg ${i + 1}`}
                      >
                        <Text style={styles.removeLeg}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                <Pressable
                  onPress={() => setLegs((ls) => [...ls, { id: uid(), pick: '', odds: '-110' }])}
                  style={styles.addLeg}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>+ Add leg</Text>
                </Pressable>
                <Text style={styles.parlayOdds}>
                  Combined odds:{' '}
                  <Text style={{ color: colors.text, fontWeight: '800' }}>
                    {formatOdds(computedParlay)}
                  </Text>
                </Text>
                {showErr('odds') ? <Text style={styles.err}>{errors.odds}</Text> : null}
              </>
            ) : null}
          </View>
        ) : null}

        <Field
          label={multiLeg ? 'Description (optional)' : 'Pick'}
          value={pick}
          onChangeText={setPick}
          placeholder={multiLeg ? 'e.g. Sunday NFL parlay' : 'e.g. Chiefs -3.5 vs Bills'}
          error={showErr('pick')}
        />

        <View style={styles.row}>
          {!multiLeg ? (
            <View style={{ flex: 1 }}>
              <Field
                label="Odds"
                value={odds}
                onChangeText={setOdds}
                placeholder="-110"
                keyboardType="numbers-and-punctuation"
                error={showErr('odds')}
                hint={
                  Number.isFinite(implied) ? `Implied ${(implied * 100).toFixed(1)}%` : undefined
                }
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Field
              label="Stake"
              labelRight={
                <View style={styles.miniToggle}>
                  {(['$', 'u'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => {
                        if (m === stakeMode) return;
                        const n = parseNumber(stake);
                        if (Number.isFinite(n) && settings.unitSize > 0) {
                          const conv = m === 'u' ? n / settings.unitSize : n * settings.unitSize;
                          setStake(String(Math.round(conv * 100) / 100));
                        }
                        setStakeMode(m);
                      }}
                      style={[styles.miniBtn, stakeMode === m && styles.miniBtnOn]}
                    >
                      <Text style={[styles.miniText, stakeMode === m && { color: colors.text }]}>
                        {m === '$' ? '$' : 'Units'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              }
              value={stake}
              onChangeText={setStake}
              placeholder={stakeMode === '$' ? '25.00' : '1'}
              keyboardType="decimal-pad"
              error={showErr('stake')}
              hint={
                stakeMode === 'u' && Number.isFinite(stakeNum)
                  ? `= $${stakeNum.toFixed(2)} (1u = $${settings.unitSize})`
                  : undefined
              }
            />
          </View>
        </View>

        <View style={styles.toWinBox}>
          <Text style={styles.toWinLabel}>To win</Text>
          <Text style={styles.toWinValue}>{formatAmount(toWin, settings)}</Text>
          <Text style={styles.toWinLabel}>
            Payout {formatAmount(valid ? toWin + stakeNum : 0, settings)}
          </Text>
        </View>

        <Text style={styles.label}>Sportsbook</Text>
        <ChipRow options={settings.books} value={book} onChange={setBook} />
        <TextInput
          value={book}
          onChangeText={setBook}
          placeholder="Or type a sportsbook"
          placeholderTextColor={colors.textFaint}
          style={[styles.legInput, { marginTop: space.sm, marginBottom: space.lg }]}
        />

        <Field
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          error={showErr('date')}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Result</Text>
        <Segmented<BetStatus>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'won', label: 'Won' },
            { value: 'lost', label: 'Lost' },
            { value: 'push', label: 'Push' },
          ]}
        />
        <View style={[styles.statusBar, { backgroundColor: statusColor[status] }]} />

        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Reasoning, line movement, etc."
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Button title={isEdit ? 'Save Changes' : 'Add Bet'} onPress={save} />
        {submitted && !valid ? (
          <Text style={[styles.err, { textAlign: 'center', marginTop: space.sm }]}>
            Fix the highlighted fields above.
          </Text>
        ) : null}
        {isEdit ? (
          <Button
            title="Delete Bet"
            variant="danger"
            onPress={remove}
            style={{ marginTop: space.md }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  headerBtn: { color: colors.textDim, fontSize: 16 },
  container: { padding: space.lg, paddingBottom: 60 },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', gap: space.md },
  legsBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  legsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm },
  legsTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  legRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginBottom: space.sm },
  legInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  removeLeg: { color: colors.textFaint, fontSize: 16, paddingHorizontal: 4 },
  addLeg: { paddingVertical: space.sm },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  parlayOdds: { color: colors.textDim, marginTop: space.xs },
  err: { color: colors.loss, fontSize: 12, marginTop: 4 },
  miniToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 6 },
  miniBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  miniBtnOn: { backgroundColor: colors.surfaceAlt },
  miniText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  toWinBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
    marginBottom: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toWinLabel: { color: colors.textDim, fontSize: 13 },
  toWinValue: { color: colors.accent, fontSize: 28, fontWeight: '800', marginVertical: 2 },
  statusBar: { height: 3, borderRadius: 2, marginTop: 6, marginBottom: space.lg, opacity: 0.8 },
});
