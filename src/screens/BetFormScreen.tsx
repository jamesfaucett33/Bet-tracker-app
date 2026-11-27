import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { formatAmount, formatDate, isValidISODate, parseNumber, todayISO, uid } from '../format';
import { daysAgoISO } from '../recap';
import {
  formatOdds,
  americanToDecimal,
  decimalToAmerican,
  isValidAmerican,
  parlayOdds,
  betToWin,
  potentialProfit,
} from '../odds';
import { canReadOnDevice } from '../ocr';
import { deriveTrackerUrl } from '../qr';
import { duplicateMessage, findDuplicate, sameTicket } from '../dupes';
import { cheer } from '../cheer';
import { canScanInCloud } from '../cloudScan';
import { openPlans, refreshScanStatus, useScanStatus } from '../scanStatus';
import { readSlip, SlipRead } from '../readSlip';
import { PickedImage, PickSource, pickSlipImages, ScanError, ScannedBet } from '../scan';
import { useStore } from '../store';
import { colors, radius, space, statusColor } from '../theme';
import { Bet, BetStatus, BetType, GameRef, Market, ParlayLeg } from '../types';

interface LegDraft {
  id: string;
  pick: string;
  odds: string;
  /** Marked void (e.g. the player was inactive). */
  voided?: boolean;
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
    // The winning amount is fixed when the ticket is saved: the printed amount,
    // or (when the slip doesn't show one) the amount at the ticket's odds.
    toWin: sb.toWin ?? Math.round(potentialProfit(sb.stake, sb.odds) * 100) / 100,
    book: sb.book,
    status: sb.status,
    notes: sb.notes || undefined,
    legs: sb.legs.length ? sb.legs : undefined,
    game: sb.game,
    market: sb.market,
  };
}

export type AddMode = 'scan' | 'manual';

export function BetFormScreen({
  bet,
  onClose,
  mode,
}: {
  bet?: Bet;
  onClose: () => void;
  /** New bets: 'scan' opens on the photo step, 'manual' on the form. */
  mode?: AddMode;
}) {
  const { settings, saveBet, deleteBet, bets } = useStore();
  const lastSaved = useRef<Bet | null>(null);
  const isEdit = !!bet;
  const [formMode, setFormMode] = useState<AddMode | undefined>(bet ? undefined : mode);

  const [date, setDate] = useState(bet?.date ?? todayISO());
  const [sport, setSport] = useState(bet?.sport ?? settings.sports[0] ?? 'Other');
  const [betType, setBetType] = useState<BetType>(bet?.betType ?? 'Spread');
  const [pick, setPick] = useState(bet?.pick ?? '');
  const [odds, setOddsRaw] = useState(bet ? formatOdds(bet.odds) : '');
  const setOdds = (v: string) => {
    setOddsRaw(v);
    if (bet && !toWinTyped.current) setToWinInputRaw('');
  };
  const [stakeMode, setStakeMode] = useState<'$' | 'u'>('$');
  const [stake, setStakeRaw] = useState(bet ? String(bet.stake) : '');
  const setStake = (v: string) => {
    setStakeRaw(v);
    if (bet && !toWinTyped.current) setToWinInputRaw('');
  };
  // Exact "to win" printed on the ticket (optional; overrides the odds math).
  const [toWinInput, setToWinInputRaw] = useState(bet?.toWin ? bet.toWin.toFixed(2) : '');
  // The saved to-win belongs to the saved wager/odds: if those change during an
  // edit and to-win wasn't retyped, work it out again.
  const toWinTyped = useRef(false);
  const setToWinInput = (v: string) => {
    toWinTyped.current = true;
    setToWinInputRaw(v);
  };
  const [book, setBook] = useState(bet?.book ?? settings.books[0] ?? '');
  const [status, setStatus] = useState<BetStatus>(bet?.status ?? 'pending');
  const [notes, setNotes] = useState(bet?.notes ?? '');
  const [decidedBy, setDecidedBy] = useState(bet?.decidedBy ?? '');
  const [legs, setLegs] = useState<LegDraft[]>(
    bet?.legs?.map((l) => ({
      id: l.id,
      pick: l.pick,
      odds: l.odds === null ? '' : formatOdds(l.odds),
      voided: l.voided,
    })) ?? [
      { id: uid(), pick: '', odds: '' },
      { id: uid(), pick: '', odds: '' },
    ],
  );
  // Parlays: either compute total odds from each leg's odds, or type the total
  // odds printed on the slip (same game parlays usually only show the total).
  const [oddsFromLegs, setOddsFromLegs] = useState<boolean>(
    bet
      ? !!bet.legs?.length &&
          bet.legs.every((l) => l.odds !== null) &&
          parlayOdds(bet.legs.map((l) => l.odds as number)) === bet.odds
      : false, // new parlays: total odds / to-win straight from the ticket
  );
  const [moreOpen, setMoreOpen] = useState(isEdit);
  const [pickDate, setPickDate] = useState(false);
  const [otherBook, setOtherBook] = useState(false);
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
  const scanStatus = useScanStatus();
  const credit = settings.anthropicApiKey.trim() ? null : scanStatus;
  const [capHit, setCapHit] = useState(false);
  const showCap = capHit || (credit ? credit.left <= 0 : false);
  const setShowCap = setCapHit;
  const refreshCredit = () => {
    if (!settings.anthropicApiKey.trim()) refreshScanStatus();
  };
  useEffect(() => {
    if (!bet) refreshCredit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [batch, setBatch] = useState<{ total: number; done: number; items: BatchItem[] } | null>(
    null,
  );

  const multiLegType = MULTI_LEG.includes(betType);
  // A ticket that has legs keeps them whatever bet type is picked.
  const showLegs = multiLegType || legs.some((l) => l.pick.trim());
  const multiLeg = multiLegType && oddsFromLegs;
  // Every leg row with odds counts toward the parlay price, typed pick or not
  // (handy for pricing a parlay quickly); fully blank rows are skipped.
  const legOdds = legs
    .filter((l) => l.pick.trim() || l.odds.trim())
    .map((l) => parseNumber(l.odds));
  const computedParlay = multiLeg ? parlayOdds(legOdds) : NaN;
  const stakeInput = parseNumber(stake);
  const stakeNum = stakeMode === 'u' ? stakeInput * settings.unitSize : stakeInput;
  const printedRaw = parseNumber(toWinInput);
  const printedToWin =
    Number.isFinite(printedRaw) && printedRaw > 0 ? Math.round(printedRaw * 100) / 100 : null;
  // Odds left blank: work them out from the wager and to-win on the ticket.
  const typedOdds = parseNumber(odds);
  const derivedOdds =
    printedToWin !== null && Number.isFinite(stakeNum) && stakeNum > 0
      ? Math.round(decimalToAmerican(1 + printedToWin / stakeNum))
      : NaN;
  const oddsNum = multiLeg
    ? computedParlay
    : isValidAmerican(typedOdds)
      ? typedOdds
      : derivedOdds;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!isValidISODate(date)) e.date = 'Use YYYY-MM-DD';
    if (betType === 'Future' && decidedBy.trim()) {
      if (!isValidISODate(decidedBy.trim())) e.decidedBy = 'Use YYYY-MM-DD, e.g. 2027-02-14';
      else if (decidedBy.trim() < date) e.decidedBy = "Can't be before the day you placed it";
    }
    if (!isValidAmerican(oddsNum))
      e.odds = multiLeg
        ? 'Every leg needs valid odds (e.g. -110 or +150)'
        : odds.trim()
          ? 'Odds look like -110 or +150'
          : 'Enter the "to win" from your ticket (or the odds)';
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) e.stake = 'Enter how much you bet';
    if (!multiLegType && !pick.trim()) e.pick = 'What did you bet on?';
    if (multiLegType && legs.filter((l) => l.pick.trim()).length < 2)
      e.legs = 'Add at least 2 legs';
    return e;
  }, [date, oddsNum, stakeNum, pick, multiLeg, multiLegType, odds, legs, betType, decidedBy]);

  const valid = Object.keys(errors).length === 0;
  // Parlay priced from its legs: pay it like the book does, from the exact leg
  // odds multiplied together (not from the rounded total, which loses cents).
  const exactLegsToWin =
    multiLeg && legOdds.length && legOdds.every(isValidAmerican)
      ? Math.round(stakeNum * (legOdds.reduce((acc, o) => acc * americanToDecimal(o), 1) - 1) * 100) /
        100
      : null;
  const toWin = valid ? (printedToWin ?? exactLegsToWin ?? potentialProfit(stakeNum, oddsNum)) : 0;

  const ticketLine = (b: Bet) =>
    `${b.pick} · ${formatAmount(b.stake, settings)} to win ${formatAmount(betToWin(b), settings)}`;

  /**
   * The game this bet is linked to. If the pick was edited, drop the old
   * match (it gets looked up again), and drop the game entirely when the new
   * pick no longer mentions either team.
   */
  const keptGame = (): GameRef | undefined => {
    if (!gameRef || multiLegType) return gameRef;
    if (pick.trim() === (bet?.pick ?? scannedPick).trim()) return gameRef;
    const lastWord = (t: string) => t.trim().split(/\s+/).pop()?.toLowerCase() ?? '';
    const p = pick.toLowerCase();
    const mentions = [gameRef.away, gameRef.home].some((t) => t && p.includes(lastWord(t)));
    return mentions ? { league: gameRef.league, away: gameRef.away, home: gameRef.home } : undefined;
  };

  const save = (quiet = false): boolean => {
    setSubmitted(true);
    if (!valid) return false;
    // Same-game parlay: every original leg is on one game, so an edited leg is too.
    const legGamesBefore = sourceLegs.map((l) => l.game).filter(Boolean) as GameRef[];
    const sgpGame =
      legGamesBefore.length === sourceLegs.length &&
      legGamesBefore.length > 0 &&
      legGamesBefore.every(
        (g) => g.away === legGamesBefore[0].away && g.home === legGamesBefore[0].home,
      )
        ? legGamesBefore[0]
        : undefined;
    const keptLegs = showLegs
      ? legs
          // Keep legs with a pick; in "odds from legs" mode also legs priced without
          // a name (they make up the price). Untouched rows in total-odds mode are dropped.
          .filter((l) => l.pick.trim() || (oddsFromLegs && l.odds.trim()))
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
              ...(same?.game
                ? { game: same.game }
                : sgpGame
                  ? { game: sgpGame } // edited leg on a same-game parlay: still that game
                  : {}),
              ...(same?.result && !l.voided ? { result: same.result } : {}),
              ...(l.voided ? { voided: true, result: 'void' as const } : {}),
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
      // Fixed at save: printed amount, else the leg math, else the ticket's odds.
      toWin: printedToWin ?? exactLegsToWin ?? Math.round(potentialProfit(stakeNum, oddsNum) * 100) / 100,
      book: book.trim(),
      status,
      ...(bet?.settledBy && status === bet.status ? { settledBy: bet.settledBy } : {}),
      notes: notes.trim() || undefined,
      decidedBy: betType === 'Future' && decidedBy.trim() ? decidedBy.trim() : undefined,
      legs: finalLegs,
      game: keptGame(),
      trackerUrl,
      market:
        !multiLegType && pick.trim() === (bet?.pick ?? scannedPick)
          ? (bet?.market ?? scannedMarket)
          : undefined,
    };
    // Fixing the legs (or voiding one) on an auto-settled ticket: grade it again.
    const legText = (ls?: { pick: string; voided?: boolean }[]) =>
      (ls ?? []).map((l) => `${l.pick.trim().toLowerCase()}|${!!l.voided}`).join('||');
    const legsChanged = !!bet && legText(bet.legs) !== legText(finalLegs);
    if (legsChanged && bet?.settledBy === 'auto' && status === bet.status) {
      next.status = 'pending';
      next.settledAt = undefined;
      next.toWin = printedToWin ?? undefined;
    }
    // The same ticket can never be logged twice.
    const dupe = findDuplicate(next, bets, bet?.id);
    if (dupe) {
      notify('Already logged', duplicateMessage(dupe));
      return false;
    }
    saveBet(next);
    onClose();
    if (!isEdit && !quiet) cheer({ title: 'Ticket saved!', lines: [ticketLine(next)] });
    lastSaved.current = next;
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
        'Add your Anthropic API key in Profile → Your own AI key, then try again.',
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
        res = await readSlip(images[0].data, settings.anthropicApiKey, images[0].screenshot);
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
          : res.freeScreenshot
            ? '📱 Screenshot read on your phone — free, no upload used. Check the details, then save.'
            : res.usedAI
            ? 'Slip read with AI. Check the details below, then save.'
            : res.limitReached
              ? 'Out of bet uploads this month — read on your phone instead. Double-check every field.'
              : 'Slip read on your phone. Double-check every field — sign in (Profile) for free bet uploads.',
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
  const scanBatch = async (images: PickedImage[]) => {
    setBatch({ total: images.length, done: 0, items: [] });
    const items: BatchItem[] = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const res = await readSlip(images[i].data, settings.anthropicApiKey, images[i].screenshot);
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
    if (saved)
      cheer({
        title: saved === 1 ? 'Ticket saved!' : `${saved} tickets saved!`,
        lines: kept.map(ticketLine),
        note: extra.length ? `Skipped: ${extra.join(', ')}.` : undefined,
      });
    else notify('Nothing saved', extra.length ? `Skipped: ${extra.join(', ')}.` : 'No tickets to save.');
    setBatch(null);
    onClose();
  };

  const saveAllScanned = () => {
    setSubmitted(true);
    if (!valid) return;
    const others = extraScans.map(scannedToBet);
    const ok = others.filter((b): b is Bet => b !== null);
    if (!save(true)) return;
    const kept: Bet[] = [];
    let dupes = 0;
    for (const b of ok) {
      if (findDuplicate(b, [...bets, ...kept])) dupes++;
      else kept.push(b);
    }
    kept.forEach(saveBet);
    const skipped = others.length - ok.length;
    const all = [lastSaved.current, ...kept].filter((b): b is Bet => !!b);
    cheer({
      title: all.length === 1 ? 'Ticket saved!' : `${all.length} tickets saved!`,
      lines: all.map(ticketLine),
      note:
        [
          dupes ? `${dupes} already in your bets (not saved again)` : '',
          skipped ? `${skipped} missing odds or wager — add ${skipped === 1 ? 'it' : 'them'} by hand` : '',
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
    });
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
            hitSlop={16}
            accessibilityRole="button"
            disabled={reading}
            style={styles.headerPill}
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
                    {ok ? (
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
        <Pressable onPress={onClose} hitSlop={16} accessibilityRole="button" style={styles.headerPill}>
          <Text style={styles.headerBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Bet' : formMode === 'scan' ? 'Scan Bet Slip' : 'New Bet'}
        </Text>
        {formMode === 'scan' && !scanNote ? (
          <View style={{ width: 70 }} />
        ) : (
          <Pressable
            onPress={() => save()}
            hitSlop={16}
            accessibilityRole="button"
            style={[styles.headerPill, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.headerBtn, { color: colors.bg, fontWeight: '900' }]}>Save</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {!isEdit && formMode === 'manual' ? (
          <Pressable onPress={() => setFormMode('scan')} style={styles.modeLink} accessibilityRole="button">
            <Text style={styles.modeLinkText}>📷 Have a photo or screenshot? Scan it instead ›</Text>
          </Pressable>
        ) : null}
        {!isEdit && formMode !== 'manual' ? (
          <View style={[styles.scanBox, formMode === 'scan' && styles.scanBoxBig]}>
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
                <Text style={styles.scanTitle}>
                  {formMode === 'scan' ? '📷 Scan photo(s)' : '📷 Scan a bet slip'}
                </Text>
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
                    {credit.plan === 'staff'
                      ? '✨ Bet uploads · unlimited'
                      : credit.left <= 0
                        ? 'Out of bet uploads this month. Photos now read on your phone.'
                        : `✨ ${credit.left} bet upload${credit.left === 1 ? '' : 's'} left`}
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
              <Text style={styles.capTitle}>You're out of bet uploads this month</Text>
              <Text style={styles.capText}>
                {
                  'Scans now read on your phone instead — double-check each field. Upgrade or grab an upload pack for more.'
                }
              </Text>
              <Button title="See plans" onPress={openPlans} style={{ marginTop: space.md }} />
            </View>
          </View>
        ) : null}

        {formMode === 'scan' && !scanNote ? (
          <Pressable
            onPress={() => setFormMode('manual')}
            style={styles.modeLink}
            accessibilityRole="button"
          >
            <Text style={styles.modeLinkText}>✍️ Rather type it in? Enter the bet manually ›</Text>
          </Pressable>
        ) : (
          <>
        {/* 1. Sportsbook */}
        <Text style={styles.step}>Sportsbook</Text>
        <ChipRow
          options={[...bookOptions, 'Other']}
          value={otherBook ? 'Other' : book}
          onChange={(v) => {
            if (v === 'Other') {
              setOtherBook(true);
              setBook('');
            } else {
              setOtherBook(false);
              setBook(v);
            }
          }}
        />
        {otherBook ? (
          <TextInput
            value={book}
            onChangeText={setBook}
            placeholder="Which sportsbook?"
            placeholderTextColor={colors.textFaint}
            autoFocus
            style={[styles.legInput, { marginTop: space.sm }]}
          />
        ) : null}

        {/* 2. Single or parlay */}
        <Text style={[styles.step, { marginTop: space.lg }]}>Bet type</Text>
        <Segmented<'single' | 'parlay'>
          value={multiLegType ? 'parlay' : 'single'}
          onChange={(k) => setBetType(k === 'parlay' ? 'Parlay' : 'Spread')}
          options={[
            { value: 'single', label: 'Single bet' },
            { value: 'parlay', label: 'Parlay' },
          ]}
        />
        <View style={{ marginTop: space.sm }}>
          <ChipRow
            options={multiLegType ? MULTI_LEG : ['Spread', 'Moneyline', 'Total', 'Prop', 'Future', 'Other']}
            value={betType}
            onChange={(v) => setBetType(v as BetType)}
          />
        </View>

        {/* 3. The bet */}
        <View style={{ height: space.lg }} />
        {multiLegType ? null : (
          <Field
            label="What did you bet on?"
            value={pick}
            onChangeText={setPick}
            placeholder={
              betType === 'Future' ? 'e.g. Chiefs to win the Super Bowl' : 'e.g. Chiefs -3.5 vs Bills'
            }
            error={showErr('pick')}
          />
        )}
        {betType === 'Future' ? (
          <Field
            label="When is it decided? (optional)"
            value={decidedBy}
            onChangeText={setDecidedBy}
            placeholder="YYYY-MM-DD, e.g. 2027-02-14"
            autoCapitalize="none"
            error={showErr('decidedBy')}
            hint="Futures stay open until this date (Super Bowl, end of season…), then we'll ask you how it went."
          />
        ) : null}
        {showLegs ? (
          <View style={styles.legsBox}>
            <Text style={styles.legsTitle}>Your legs</Text>
            <Text style={styles.legHint}>One line per leg, the way it's written on your ticket.</Text>
            <>
              {legs.map((leg, i) => (
                <View key={leg.id} style={styles.legRow}>
                  <TextInput
                    value={leg.pick}
                    onChangeText={(t) =>
                      setLegs((ls) => ls.map((l) => (l.id === leg.id ? { ...l, pick: t } : l)))
                    }
                    placeholder={i === 0 ? 'Leg 1  e.g. Chiefs ML' : i === 1 ? 'Leg 2  e.g. Kelce 50+ rec yds' : `Leg ${i + 1}`}
                    placeholderTextColor={colors.textFaint}
                    style={[styles.legInput, { flex: 1, minWidth: 0 }]}
                  />
                  {oddsFromLegs || leg.odds.trim() ? (
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
                  ) : null}
                  {isEdit && leg.pick.trim() ? (
                    <Pressable
                      onPress={() =>
                        setLegs((ls) =>
                          ls.map((l) => (l.id === leg.id ? { ...l, voided: !l.voided } : l)),
                        )
                      }
                      style={[styles.voidBtn, leg.voided && styles.voidBtnOn]}
                      accessibilityRole="button"
                      accessibilityLabel={`${leg.voided ? 'Un-void' : 'Void'} leg ${i + 1}`}
                    >
                      <Text style={[styles.voidText, leg.voided && { color: colors.bg }]}>
                        {leg.voided ? 'Void' : 'Void?'}
                      </Text>
                    </Pressable>
                  ) : null}
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
                onPress={() => setLegs((ls) => [...ls, { id: uid(), pick: '', odds: '' }])}
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
              {showErr('legs') ? <Text style={styles.err}>{errors.legs}</Text> : null}
            </>
          </View>
        ) : null}


        {/* 4. Money, straight from the ticket */}
        <View style={styles.ticketBox}>
          <Text style={styles.ticketTitle}>From your ticket</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label={stakeMode === 'u' ? 'Wager (units)' : 'Wager $'}
                value={stake}
                onChangeText={setStake}
                placeholder={stakeMode === '$' ? '25.00' : '1'}
                keyboardType="decimal-pad"
                error={showErr('stake')}
                hint={
                  stakeMode === 'u' && Number.isFinite(stakeNum)
                    ? `= $${stakeNum.toFixed(2)}`
                    : undefined
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="To win $"
                value={toWinInput}
                onChangeText={setToWinInput}
                placeholder={
                  isValidAmerican(typedOdds) && Number.isFinite(stakeNum) && stakeNum > 0
                    ? potentialProfit(stakeNum, typedOdds).toFixed(2)
                    : '22.73'
                }
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          {!multiLeg ? (
            <Field
              label={multiLegType ? 'Total odds (optional)' : 'Odds (optional)'}
              value={odds}
              onChangeText={setOdds}
              placeholder={isValidAmerican(derivedOdds) ? formatOdds(derivedOdds) : '-110'}
              keyboardType="numbers-and-punctuation"
              error={showErr('odds')}
              hint={
                !odds.trim() && isValidAmerican(derivedOdds)
                  ? `We worked it out: ${formatOdds(derivedOdds)}`
                  : 'Skip it if you entered "To win"'
              }
            />
          ) : null}
          <Text style={styles.payLine}>
            {valid
              ? `Pays ${formatAmount(toWin + stakeNum, settings)} total if it hits`
              : 'Enter your wager and "to win" from the ticket'}
          </Text>
        </View>

        {/* 5. Sport (for live tracking) */}
        <Text style={styles.step}>Sport</Text>
        <ChipRow options={sportOptions} value={sport} onChange={setSport} />

        {/* When it was placed: matters when logging an old ticket */}
        <View style={styles.placedRow}>
          <Text style={styles.placedLabel}>Placed</Text>
          {[
            { label: 'Today', value: todayISO() },
            { label: 'Yesterday', value: daysAgoISO(1) },
          ].map((o) => {
            const on = !pickDate && date === o.value;
            return (
              <Pressable
                key={o.label}
                onPress={() => {
                  setPickDate(false);
                  setDate(o.value);
                }}
                style={[styles.placedChip, on && styles.placedChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.placedText, on && styles.placedTextOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
          {(() => {
            const other = pickDate || (date !== todayISO() && date !== daysAgoISO(1));
            return (
              <Pressable
                onPress={() => setPickDate(true)}
                style={[styles.placedChip, other && styles.placedChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: other }}
              >
                <Text style={[styles.placedText, other && styles.placedTextOn]}>
                  {other && !pickDate && isValidISODate(date) ? formatDate(date) : 'Pick a date'}
                </Text>
              </Pressable>
            );
          })()}
        </View>
        {pickDate ? (
          <Field
            label="Date placed"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD, e.g. 2026-11-23"
            error={showErr('date')}
            autoCapitalize="none"
            hint="The day you placed the bet. We look for the game that day and the week after."
          />
        ) : showErr('date') ? (
          <Text style={styles.err}>{errors.date}</Text>
        ) : null}

        {/* More options */}
        <Pressable
          onPress={() => setMoreOpen((v) => !v)}
          style={styles.moreBtn}
          accessibilityRole="button"
        >
          <Text style={styles.moreText}>
            {moreOpen ? 'Hide options ▲' : 'More options: result, notes ▼'}
          </Text>
        </Pressable>
        {moreOpen ? (
          <>
            {multiLegType ? (
              <>
                <Field
                  label="Name this parlay (optional)"
                  value={pick}
                  onChangeText={setPick}
                  placeholder="e.g. Sunday NFL parlay"
                />
                <Pressable
                  onPress={() => setOddsFromLegs((v) => !v)}
                  style={{ marginBottom: space.lg }}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>
                    {oddsFromLegs
                      ? 'Use the total odds from my ticket instead'
                      : "Enter each leg's odds instead"}
                  </Text>
                </Pressable>
              </>
            ) : null}
            <Text style={styles.label}>Result</Text>
            <Segmented<BetStatus>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'pending', label: 'Open' },
                { value: 'won', label: 'Won' },
                { value: 'lost', label: 'Lost' },
                { value: 'push', label: 'Push' },
              ]}
            />
            <View style={[styles.statusBar, { backgroundColor: statusColor[status] }]} />
            {settings.unitSize > 0 ? (
              <Pressable
                onPress={() => {
                  const m = stakeMode === '$' ? 'u' : '$';
                  const n = parseNumber(stake);
                  if (Number.isFinite(n)) {
                    const conv = m === 'u' ? n / settings.unitSize : n * settings.unitSize;
                    setStakeRaw(String(Math.round(conv * 100) / 100));
                  }
                  setStakeMode(m);
                }}
                style={{ marginBottom: space.lg }}
                accessibilityRole="button"
              >
                <Text style={styles.link}>
                  {stakeMode === '$'
                    ? `Enter wager in units instead (1u = $${settings.unitSize})`
                    : 'Enter wager in dollars instead'}
                </Text>
              </Pressable>
            ) : null}
            <Field
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything you want to remember"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </>
        ) : null}

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
          </>
        )}
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
  headerBtn: { color: colors.text, fontSize: 16, fontWeight: '700' },
  headerPill: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  scanBoxBig: { paddingVertical: space.xl },
  step: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: space.sm },
  ticketBox: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.md,
    marginBottom: space.lg,
  },
  ticketTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: space.md },
  payLine: { color: colors.money, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  moreBtn: { paddingVertical: space.lg, alignItems: 'center' },
  placedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.lg,
    marginBottom: space.md,
  },
  placedLabel: { color: colors.text, fontSize: 15, fontWeight: '800', marginRight: 2 },
  placedChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  placedChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  placedText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  placedTextOn: { color: colors.bg },
  moreText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  modeLink: {
    paddingVertical: 12,
    paddingHorizontal: space.md,
    marginBottom: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeLinkText: { color: colors.accent, fontSize: 14, fontWeight: '700', textAlign: 'center' },
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
  batchPay: { color: colors.money, fontSize: 14, fontWeight: '700', marginTop: 4 },
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
    borderWidth: 1.5,
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
  voidBtn: {
    borderWidth: 1,
    borderColor: colors.push,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  voidBtnOn: { backgroundColor: colors.push },
  voidText: { color: colors.push, fontSize: 12, fontWeight: '800' },
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
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  toWinLabel: { color: colors.textDim, fontSize: 13 },
  toWinValue: { color: colors.money, fontSize: 28, fontWeight: '800', marginVertical: 2 },
  statusBar: { height: 3, borderRadius: 2, marginTop: 6, marginBottom: space.lg, opacity: 0.8 },
});
