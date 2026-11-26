import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, ChipRow, confirm, Field, notify, Segmented } from '../components/ui';
import { formatAmount, isValidISODate, parseNumber, todayISO, uid } from '../format';
import {
  formatOdds,
  impliedProbability,
  isValidAmerican,
  parlayOdds,
  potentialProfit,
} from '../odds';
import { canReadOnDevice } from '../ocr';
import { decodeSlipQr, deriveTrackerUrl } from '../qr';
import { duplicateMessage, findDuplicate, sameTicket } from '../dupes';
import { canScanInCloud, fetchScanCredit, ScanCredit, scansLeft } from '../cloudScan';
import { readSlip, SlipRead } from '../readSlip';
import { PickSource, pickSlipImages, ScanError, ScannedBet } from '../scan';
import { useStore } from '../store';
import { colors, radius, space, statusColor } from '../theme';
import { Bet, BET_TYPES, BetStatus, BetType, GameRef, Market, ParlayLeg } from '../types';

interface LegDraft {
  id: string;
  pick: string;
  odds: string;
}

const MULTI_LEG: BetType[] = ['Parlay', 'Teaser'];

interface BatchItem {
  photo: number;
  bet?: ScannedBet;
  trackerUrl?: string;
  error?: string;
}

function scannedToBet(sb: ScannedBet): Bet | null {
  if (sb.odds === null || sb.stake === null) return null;
  return {
    id: uid(),
    createdAt: Date.now(),
    date: sb.date,
    sport: sb.sport,
    betType: sb.betType,
    pick: sb.pick || `${sb.legs.length}-leg ${sb.betType.toLowerCase()}`,
    odds: sb.odds,
    stake: sb.stake,
    toWin: sb.toWin ?? undefined,
    book: sb.book,
    status: sb.status,
    notes: sb.notes || undefined,
    legs: sb.legs.length ? sb.legs : undefined,
    game: sb.game,
    market: sb.market,
  };
}

export function BetFormScreen({ bet, onClose }: { bet?: Bet; onClose: () => void }) {
  const { settings, saveBet, deleteBet, bets } = useStore();
  const isEdit = !!bet;

  const [date, setDate] = useState(bet?.date ?? todayISO());
  const [sport, setSport] = useState(bet?.sport ?? settings.sports[0] ?? 'Other');
  const [betType, setBetType] = useState<BetType>(bet?.betType ?? 'Spread');
  const [pick, setPick] = useState(bet?.pick ?? '');
  const [odds, setOdds] = useState(bet ? formatOdds(bet.odds) : '-110');
  const [stakeMode, setStakeMode] = useState<'$' | 'u'>('$');
  const [stake, setStake] = useState(bet ? String(bet.stake) : '');
  // Exact "to win" printed on the ticket (optional; overrides the odds math).
  const [toWinInput, setToWinInput] = useState(bet?.toWin ? bet.toWin.toFixed(2) : '');
  const [book, setBook] = useState(bet?.book ?? settings.books[0] ?? '');
  const [status, setStatus] = useState<BetStatus>(bet?.status ?? 'pending');
  const [notes, setNotes] = useState(bet?.notes ?? '');
  const [legs, setLegs] = useState<LegDraft[]>(
    bet?.legs?.map((l) => ({
      id: l.id,
      pick: l.pick,
      odds: l.odds === null ? '' : formatOdds(l.odds),
    })) ?? [
      { id: uid(), pick: '', odds: '-110' },
      { id: uid(), pick: '', odds: '-110' },
    ],
  );
  // Parlays: either compute total odds from each leg's odds, or type the total
  // odds printed on the slip (same game parlays usually only show the total).
  const [oddsFromLegs, setOddsFromLegs] = useState<boolean>(
    bet
      ? !!bet.legs?.length &&
          bet.legs.every((l) => l.odds !== null) &&
          parlayOdds(bet.legs.map((l) => l.odds as number)) === bet.odds
      : true,
  );
  const [submitted, setSubmitted] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [extraScans, setExtraScans] = useState<ScannedBet[]>([]);
  const [scanNote, setScanNote] = useState('');
  // Structured data from a scan, kept so live tracking doesn't depend on re-parsing text.
  const [sourceLegs, setSourceLegs] = useState<ParlayLeg[]>(bet?.legs ?? []);
  const [gameRef, setGameRef] = useState<GameRef | undefined>(bet?.game);
  const [scannedMarket, setScannedMarket] = useState<Market | undefined>(undefined);
  const [scannedPick, setScannedPick] = useState('');
  const [trackerUrl, setTrackerUrl] = useState<string | undefined>(bet?.trackerUrl);
  // Free AI scanning credit (signed-in users without their own key).
  const [credit, setCredit] = useState<ScanCredit | null>(null);
  const [showCap, setShowCap] = useState(false);
  const refreshCredit = () => {
    if (settings.anthropicApiKey.trim()) return;
    fetchScanCredit().then((c) => {
      setCredit(c);
      if (c && c.spent >= c.limit) setShowCap(true);
    });
  };
  useEffect(() => {
    if (!bet) refreshCredit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [batch, setBatch] = useState<{ total: number; done: number; items: BatchItem[] } | null>(
    null,
  );

  const multiLegType = MULTI_LEG.includes(betType);
  const multiLeg = multiLegType && oddsFromLegs;
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
    if (!multiLegType && !pick.trim()) e.pick = 'Describe your pick';
    return e;
  }, [date, oddsNum, stakeNum, pick, multiLeg, multiLegType]);

  const valid = Object.keys(errors).length === 0;
  const printedRaw = parseNumber(toWinInput);
  const printedToWin =
    Number.isFinite(printedRaw) && printedRaw > 0 ? Math.round(printedRaw * 100) / 100 : null;
  const toWin = valid ? (printedToWin ?? potentialProfit(stakeNum, oddsNum)) : 0;
  const implied = impliedProbability(oddsNum);

  const save = (): boolean => {
    setSubmitted(true);
    if (!valid) return false;
    const keptLegs = multiLegType
      ? legs
          .filter((l) => l.pick.trim() || l.odds.trim())
          .map((l) => {
            const o = parseNumber(l.odds);
            // Keep a structured market (e.g. from a scan) while the leg text is unchanged.
            const orig = sourceLegs.find((x) => x.id === l.id);
            const same = orig && orig.pick.trim() === l.pick.trim() ? orig : undefined;
            return {
              id: l.id,
              pick: l.pick.trim(),
              odds: isValidAmerican(o) ? o : null,
              ...(same?.market ? { market: same.market } : {}),
              ...(same?.game ? { game: same.game } : {}),
              ...(same?.result ? { result: same.result } : {}),
            };
          })
      : [];
    const finalLegs = keptLegs.length ? keptLegs : undefined;
    const finalPick =
      pick.trim() || (finalLegs ? `${finalLegs.length}-leg ${betType.toLowerCase()}` : '');
    const next: Bet = {
      id: bet?.id ?? uid(),
      createdAt: bet?.createdAt ?? Date.now(),
      date,
      sport,
      betType,
      pick: finalPick,
      odds: oddsNum,
      stake: Math.round(stakeNum * 100) / 100,
      toWin: printedToWin ?? undefined,
      book: book.trim(),
      status,
      notes: notes.trim() || undefined,
      legs: finalLegs,
      game: gameRef,
      trackerUrl,
      market:
        !multiLegType && pick.trim() === (bet?.pick ?? scannedPick)
          ? (bet?.market ?? scannedMarket)
          : undefined,
    };
    // The same ticket can never be logged twice.
    const dupe = findDuplicate(next, bets, bet?.id);
    if (dupe) {
      notify('Already logged', duplicateMessage(dupe));
      return false;
    }
    saveBet(next);
    onClose();
    return true;
  };

  const remove = () =>
    confirm('Delete bet?', 'This cannot be undone.', () => {
      if (bet) deleteBet(bet.id);
      onClose();
    });

  const showErr = (k: string) => (submitted ? errors[k] : undefined);

  const applyScan = (sb: ScannedBet) => {
    setSport(sb.sport);
    setBetType(sb.betType);
    setPick(sb.pick);
    setOdds(sb.odds === null ? '' : formatOdds(sb.odds));
    setStakeMode('$');
    setStake(sb.stake === null ? '' : String(sb.stake));
    setToWinInput(sb.toWin ? sb.toWin.toFixed(2) : '');
    setBook(sb.book); // blank if unreadable, never a leftover default
    setDate(sb.date);
    setStatus(sb.status);
    setNotes(sb.notes);
    setSourceLegs(sb.legs);
    setGameRef(sb.game);
    setScannedMarket(sb.market);
    setScannedPick(sb.pick);
    if (sb.legs.length) {
      setLegs(
        sb.legs.map((l) => ({
          id: l.id,
          pick: l.pick,
          odds: l.odds === null ? '' : formatOdds(l.odds),
        })),
      );
      // Prefer the printed total; only compute from legs when no total is shown.
      setOddsFromLegs(sb.odds === null && sb.legs.every((l) => l.odds !== null));
    }
    setSubmitted(true); // highlight anything the scan couldn't read
  };

  const scan = async (source: PickSource) => {
    // With an AI key, Claude reads the slip; without one, the phone reads it
    // itself (free, less accurate) so a photo always does something.
    const useAI = !!settings.anthropicApiKey.trim();
    if (!useAI && !canReadOnDevice() && !(await canScanInCloud())) {
      notify(
        'Set up scanning',
        'Add your Anthropic API key in Settings → Bet Slip Scanning, then try again.',
      );
      return;
    }
    try {
      const images = await pickSlipImages(source);
      if (!images.length) return;
      if (images.length > 1) {
        await scanBatch(images);
        return;
      }
      setScanning(true);
      setScanNote('');
      let found: ScannedBet[];
      let qr: string | null;
      let res: SlipRead;
      try {
        res = await readSlip(images[0], settings.anthropicApiKey);
        found = res.bets;
        qr = res.qr;
      } catch (e) {
        refreshCredit();
        if (e instanceof ScanError) {
          // Never save a ticket with a dropped leg: ask for a better photo instead.
          notify('Take a new picture', e.message);
          return;
        }
        throw e;
      }
      applyScan(found[0]);
      // The slip's QR (when readable) links to the sportsbook's ticket tracker;
      // otherwise build that link from the printed ticket number.
      const first = found[0];
      setTrackerUrl(
        found.length === 1 && qr ? qr : deriveTrackerUrl(first.book, first.notes, bets),
      );
      setExtraScans(found.slice(1));
      if (res.limitReached) setShowCap(true);
      refreshCredit();
      setScanNote(
        found.length > 1
          ? `Found ${found.length} bets. Showing the first — check it, then save.`
          : res.usedAI
            ? 'Slip read with AI. Check the details below, then save.'
            : res.limitReached
              ? 'Beta AI scan cap reached — read on your phone instead. Double-check every field.'
              : 'Slip read on your phone. Double-check every field — sign in (Settings) for AI scanning.',
      );
    } catch (e) {
      notify(
        'Scan failed',
        e instanceof ScanError || e instanceof Error ? e.message : 'Something went wrong.',
      );
    } finally {
      setScanning(false);
    }
  };

  // ---- several photos at once ----
  const scanBatch = async (images: string[]) => {
    setBatch({ total: images.length, done: 0, items: [] });
    const items: BatchItem[] = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const res = await readSlip(images[i], settings.anthropicApiKey);
        if (res.limitReached) setShowCap(true);
        res.bets.forEach((b) =>
          items.push({
            photo: i + 1,
            bet: b,
            trackerUrl:
              (res.bets.length === 1 && res.qr) || deriveTrackerUrl(b.book, b.notes, bets),
          }),
        );
      } catch (e) {
        items.push({
          photo: i + 1,
          error: e instanceof Error ? e.message : 'Something went wrong.',
        });
      }
      setBatch({ total: images.length, done: i + 1, items: [...items] });
    }
    refreshCredit();
  };

  const saveBatch = () => {
    if (!batch) return;
    const kept: Bet[] = [];
    let saved = 0;
    let dupes = 0;
    let incomplete = 0;
    for (const item of batch.items) {
      if (!item.bet) continue;
      const b = scannedToBet(item.bet);
      if (!b) {
        incomplete++;
        continue;
      }
      if (findDuplicate(b, [...bets, ...kept])) {
        dupes++;
        continue;
      }
      kept.push(b);
      saveBet({ ...b, trackerUrl: item.trackerUrl || undefined });
      saved++;
    }
    const failed = batch.items.filter((i) => i.error).length;
    const extra = [
      dupes ? `${dupes} already logged` : '',
      incomplete ? `${incomplete} missing odds/stake` : '',
      failed ? `${failed} photo${failed === 1 ? '' : 's'} to retake` : '',
    ].filter(Boolean);
    notify(
      `Saved ${saved} bet${saved === 1 ? '' : 's'}`,
      extra.length ? `Skipped: ${extra.join(', ')}.` : 'All set.',
    );
    setBatch(null);
    onClose();
  };

  const saveAllScanned = () => {
    setSubmitted(true);
    if (!valid) return;
    const others = extraScans.map(scannedToBet);
    const ok = others.filter((b): b is Bet => b !== null);
    if (!save()) return;
    const kept: Bet[] = [];
    let dupes = 0;
    for (const b of ok) {
      if (findDuplicate(b, [...bets, ...kept])) dupes++;
      else kept.push(b);
    }
    kept.forEach(saveBet);
    if (dupes)
      notify('Already logged', `${dupes} bet${dupes === 1 ? ' was' : 's were'} already in your bets and weren't saved again.`);
    const skipped = others.length - ok.length;
    if (skipped > 0)
      notify(
        'Some bets need details',
        `${skipped} bet${skipped === 1 ? ' was' : 's were'} missing odds or stake and weren't saved. Add ${skipped === 1 ? 'it' : 'them'} manually.`,
      );
  };

  const sportOptions = settings.sports.includes(sport)
    ? settings.sports
    : [sport, ...settings.sports];
  const bookOptions =
    !book.trim() || settings.books.includes(book.trim())
      ? settings.books
      : [book.trim(), ...settings.books];

  if (batch) {
    // Which photos repeat a logged ticket or an earlier photo in this batch.
    const dupeNote = new Map<number, string>();
    const batchBets: Bet[] = [];
    batch.items.forEach((it, idx) => {
      const b = it.bet && scannedToBet(it.bet);
      if (!b) return;
      if (findDuplicate(b, bets)) dupeNote.set(idx, 'Already in your bets — won’t be saved');
      else {
        const j = batchBets.findIndex((x) => sameTicket(x, b));
        if (j >= 0) dupeNote.set(idx, 'Same ticket as an earlier photo — won’t be saved twice');
        else batchBets.push(b);
      }
    });
    const ready = batch.items.filter((i, idx) => i.bet && scannedToBet(i.bet) && !dupeNote.has(idx));
    const reading = batch.done < batch.total;
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable
            onPress={() => setBatch(null)}
            hitSlop={12}
            accessibilityRole="button"
            disabled={reading}
          >
            <Text style={styles.headerBtn}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {reading ? `Reading ${batch.done + 1} of ${batch.total}…` : 'Review Slips'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.container}>
          {reading ? (
            <View style={styles.scanning}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.scanText}>
                Reading photo {batch.done + 1} of {batch.total}…
              </Text>
            </View>
          ) : null}
          {batch.items.map((item, i) => {
            const ok = item.bet && scannedToBet(item.bet);
            const dupe = dupeNote.get(i);
            return (
              <View
                key={i}
                style={[styles.batchCard, (!ok || dupe) && { borderColor: colors.loss }]}
              >
                <Text style={styles.batchPhoto}>Photo {item.photo}</Text>
                {dupe ? <Text style={styles.batchDupe}>🚫 {dupe}</Text> : null}
                {item.bet ? (
                  <>
                    <Text style={styles.batchTitle}>
                      {dupe ? '🚫 ' : ok ? '✅ ' : '⚠️ '}
                      {item.bet.pick || item.bet.betType}
                    </Text>
                    <Text style={styles.batchMeta}>
                      {[
                        item.bet.book,
                        item.bet.odds !== null ? formatOdds(item.bet.odds) : 'odds ?',
                        item.bet.stake !== null ? `Bet $${item.bet.stake.toFixed(2)}` : 'bet amount ?',
                        item.bet.date,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {item.bet.stake !== null && (item.bet.toWin || item.bet.odds !== null) ? (
                      (() => {
                        const stake = item.bet.stake as number;
                        const win = item.bet.toWin
                          ? item.bet.toWin
                          : potentialProfit(stake, item.bet.odds as number);
                        return (
                          <Text style={styles.batchPay}>
                            To win ${win.toFixed(2)} · Payout ${(stake + win).toFixed(2)}
                            <Text style={styles.batchPayNote}>
                              {item.bet.toWin ? '  (from ticket)' : '  (from odds — check ticket)'}
                            </Text>
                          </Text>
                        );
                      })()
                    ) : null}
                    {item.bet.legs.map((l) => (
                      <Text key={l.id} style={styles.batchLeg}>
                        • {l.pick}
                        {l.odds !== null ? `  ${formatOdds(l.odds)}` : ''}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={[styles.batchMeta, { color: colors.loss }]}>❌ {item.error}</Text>
                )}
              </View>
            );
          })}
          {!reading ? (
            <>
              <Button
                title={
                  ready.length
                    ? `Save ${ready.length} bet${ready.length === 1 ? '' : 's'}`
                    : 'Nothing to save'
                }
                onPress={saveBatch}
                disabled={!ready.length}
              />
              <Text style={[styles.scanText, { textAlign: 'center', marginTop: space.sm }]}>
                Tickets marked ❌, ⚠️ or 🚫 aren't saved — retake those photos.
              </Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

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
        <Pressable onPress={() => save()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.headerBtn, { color: colors.accent, fontWeight: '800' }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {!isEdit ? (
          <View style={styles.scanBox}>
            {scanning ? (
              <View style={styles.scanning}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.scanText}>
                  Reading your bet slip…
                  {settings.anthropicApiKey ? '' : ' (the first scan takes a few extra seconds)'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.scanTitle}>📷 Scan a bet slip</Text>
                <Text style={styles.scanText}>
                  Snap a paper ticket, or choose one or more photos and screenshots at once.
                </Text>
                <View style={styles.scanBtns}>
                  <Button
                    title="Take Photo"
                    onPress={() => scan('camera')}
                    style={{ flex: 1, paddingVertical: 10 }}
                  />
                  <Button
                    title="Choose Photos"
                    variant="secondary"
                    onPress={() => scan('library')}
                    style={{ flex: 1, paddingVertical: 10 }}
                  />
                </View>
                {credit && !settings.anthropicApiKey ? (
                  <Text style={styles.creditLine}>
                    {credit.spent >= credit.limit
                      ? 'Beta AI scan cap reached — contact James for options. Scans now read on your phone.'
                      : `✨ AI scanning · about ${scansLeft(credit)} free scan${scansLeft(credit) === 1 ? '' : 's'} left`}
                  </Text>
                ) : null}
                {scanNote ? <Text style={styles.scanNote}>✓ {scanNote}</Text> : null}
                {extraScans.length ? (
                  <Button
                    title={`Save all ${extraScans.length + 1} bets`}
                    variant="secondary"
                    onPress={saveAllScanned}
                    style={{ marginTop: space.sm, paddingVertical: 10 }}
                  />
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {showCap && !isEdit ? (
          <View style={{ marginBottom: space.lg }}>
            <View style={styles.capBox}>
              <Text style={styles.capTitle}>Beta scan cap reached</Text>
              <Text style={styles.capText}>
                {
                  "You've reached your free AI scan cap for the beta. Contact James for options. Scans now read on your phone instead — double-check each field."
                }
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>Sport</Text>
        <ChipRow options={sportOptions} value={sport} onChange={setSport} />

        <Text style={[styles.label, { marginTop: space.lg }]}>Bet Type</Text>
        <ChipRow options={BET_TYPES} value={betType} onChange={(v) => setBetType(v as BetType)} />

        <View style={{ height: space.lg }} />

        {multiLegType ? (
          <View style={styles.legsBox}>
            <View style={styles.legsHeader}>
              <Text style={styles.legsTitle}>Legs</Text>
              <Pressable onPress={() => setOddsFromLegs((v) => !v)} accessibilityRole="button">
                <Text style={styles.link}>
                  {oddsFromLegs ? 'Enter total odds instead' : 'Calculate odds from legs'}
                </Text>
              </Pressable>
            </View>
            {!oddsFromLegs ? (
              <Text style={styles.legHint}>Leg odds are optional when you enter the total.</Text>
            ) : null}
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
                    style={[styles.legInput, { flex: 1, minWidth: 0 }]}
                  />
                  <TextInput
                    value={leg.odds}
                    onChangeText={(t) =>
                      setLegs((ls) => ls.map((l) => (l.id === leg.id ? { ...l, odds: t } : l)))
                    }
                    placeholder={oddsFromLegs ? '-110' : 'odds'}
                    placeholderTextColor={colors.textFaint}
                    keyboardType="numbers-and-punctuation"
                    style={[
                      styles.legInput,
                      { width: 76, textAlign: 'center' },
                      submitted &&
                        oddsFromLegs &&
                        !isValidAmerican(parseNumber(leg.odds)) && { borderColor: colors.loss },
                    ]}
                  />
                  {legs.length > (oddsFromLegs ? 2 : 1) ? (
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
              {oddsFromLegs ? (
                <Text style={styles.parlayOdds}>
                  Combined odds:{' '}
                  <Text style={{ color: colors.text, fontWeight: '800' }}>
                    {formatOdds(computedParlay)}
                  </Text>
                </Text>
              ) : null}
              {oddsFromLegs && showErr('odds') ? (
                <Text style={styles.err}>{errors.odds}</Text>
              ) : null}
            </>
          </View>
        ) : null}

        <Field
          label={multiLegType ? 'Description (optional)' : 'Pick'}
          value={pick}
          onChangeText={setPick}
          placeholder={multiLegType ? 'e.g. Sunday NFL parlay' : 'e.g. Chiefs -3.5 vs Bills'}
          error={showErr('pick')}
        />

        <View style={styles.row}>
          {!multiLeg ? (
            <View style={{ flex: 1 }}>
              <Field
                label={multiLegType ? 'Total Odds' : 'Odds'}
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
          <Text style={styles.toWinLabel}>
            {printedToWin !== null ? 'To win (from ticket)' : 'To win'}
          </Text>
          <Text style={styles.toWinValue}>{formatAmount(toWin, settings)}</Text>
          <Text style={styles.toWinLabel}>
            Payout {formatAmount(valid ? toWin + stakeNum : 0, settings)}
          </Text>
        </View>

        <Field
          label="To win as printed on ticket (optional)"
          value={toWinInput}
          onChangeText={setToWinInput}
          placeholder={valid ? potentialProfit(stakeNum, oddsNum).toFixed(2) : '84.55'}
          keyboardType="decimal-pad"
          hint="Books price parlays from exact leg odds, so their amount can differ by a few cents. Enter it to match your ticket."
        />

        <Text style={styles.label}>Sportsbook</Text>
        <ChipRow options={bookOptions} value={book} onChange={setBook} />
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

        <Button title={isEdit ? 'Save Changes' : 'Add Bet'} onPress={() => save()} />
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
  scanBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentDim,
    borderStyle: 'dashed',
    padding: space.lg,
    marginBottom: space.lg,
  },
  scanTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  scanText: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  scanBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  capBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.push,
    padding: space.md,
  },
  capTitle: { color: colors.push, fontSize: 15, fontWeight: '800' },
  capText: { color: colors.textDim, fontSize: 13, marginTop: 4, lineHeight: 18 },
  creditLine: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginTop: space.sm },
  scanNote: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: space.md },
  scanning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  batchCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.md,
  },
  batchPhoto: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  batchTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  batchMeta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  batchDupe: { color: colors.loss, fontSize: 14, fontWeight: '700', marginTop: 2 },
  batchPay: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
  batchPayNote: { color: colors.textDim, fontSize: 12, fontWeight: '400' },
  batchLeg: { color: colors.text, fontSize: 13, marginTop: 3 },
  legHint: { color: colors.textFaint, fontSize: 12, marginBottom: space.sm },
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
