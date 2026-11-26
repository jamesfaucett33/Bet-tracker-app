import { canScanInCloud, scanInCloud } from './cloudScan';
import { readTextOnDevice } from './ocr';
import { decodeSlipQr } from './qr';
import { verifyPlayers } from './roster';
import { readBetSlip, ScanError, ScannedBet } from './scan';
import { mergeReads, parseSlipText, slipProblems } from './slipParser';

export interface SlipRead {
  bets: ScannedBet[];
  /** The slip's QR link (sportsbook ticket tracker), when one was readable. */
  qr: string | null;
  usedAI: boolean;
  /** Read with the free AI credit (owner's key, via the cloud). */
  usedCloud?: boolean;
  /** This account's free AI credit ran out; the phone read the slip instead. */
  limitReached?: boolean;
}

/**
 * Reads one slip photo. With an AI key, Claude reads it; without one, the
 * phone reads it itself, up to three ways (as-is, shadow-removed, high
 * contrast), checks player names against the real rosters and combines the
 * reads. Throws ScanError asking for a new picture rather than returning a
 * ticket with a dropped leg.
 */
export async function readSlip(image: string, apiKey: string): Promise<SlipRead> {
  const qr = await decodeSlipQr(image);
  if (apiKey.trim()) {
    return { bets: await readBetSlip(apiKey, image), qr, usedAI: true };
  }

  // Signed in: AI scanning on the free credit. When it's used up (or the
  // service is down), fall through to reading on the phone.
  let limitReached = false;
  if (await canScanInCloud()) {
    try {
      return { bets: await scanInCloud(image), qr, usedAI: true, usedCloud: true };
    } catch (e) {
      if (!(e instanceof ScanError) || !e.code) throw e; // a real read problem
      limitReached = e.code === 'limit';
    }
  }

  const reads: ScannedBet[] = [];
  let read: ScannedBet | null = null;
  for (const mode of ['plain', 'shadowfree', 'contrast'] as const) {
    const parsed = parseSlipText(await readTextOnDevice(image, mode), qr);
    reads.push(await verifyPlayers(parsed, parsed.game ?? reads.find((r) => r.game)?.game));
    read = mergeReads(reads);
    if (!slipProblems(read).length) break;
  }
  const problems = slipProblems(read!);
  if (problems.length) {
    throw new ScanError(
      `Couldn't read ${problems.join(', ')} clearly. Retake it straight on, filling the screen, in good light with no shadow or glare across the print.`,
    );
  }
  return { bets: [read!], qr, usedAI: false, limitReached };
}
