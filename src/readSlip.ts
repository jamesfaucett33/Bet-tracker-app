import { canScanInCloud, scanInCloud } from './cloudScan';
import { decodeSlipQr } from './qr';
import { readBetSlip, ScanError, ScannedBet } from './scan';

export interface SlipRead {
  bets: ScannedBet[];
  /** The slip's QR link (sportsbook ticket tracker), when one was readable. */
  qr: string | null;
  usedAI: boolean;
  /** Read with the free AI credit (owner's key, via the cloud). */
  usedCloud?: boolean;
  /** This account's free AI credit ran out; the phone read the slip instead. */
  limitReached?: boolean;
  /** A screenshot the phone read by itself (free, no AI). */
  freeScreenshot?: boolean;
}

/**
 * Reads one slip photo. With an AI key, Claude reads it; without one, the
 * phone reads it itself, up to three ways (as-is, shadow-removed, high
 * contrast), checks player names against the real rosters and combines the
 * reads. Throws ScanError asking for a new picture rather than returning a
 * ticket with a dropped leg.
 */
export async function readSlip(
  image: string,
  apiKey: string,
  screenshot = false,
): Promise<SlipRead> {
  const qr = await decodeSlipQr(image);

  if (apiKey.trim()) {
    return { bets: await readBetSlip(apiKey, image), qr, usedAI: true };
  }

  // Signed in: Claude reads it on the app's key (counts as a bet upload).
  // The phone's own reader is no longer used: it could save wrong tickets.
  if (await canScanInCloud()) {
    try {
      return { bets: await scanInCloud(image), qr, usedAI: true, usedCloud: true };
    } catch (e) {
      if (!(e instanceof ScanError) || !e.code) throw e; // a real read problem
      if (e.code === 'limit')
        throw new ScanError(
          "You're out of bet uploads this month. Upgrade or grab an upload pack, or enter the bet manually.",
          'limit',
        );
    }
  }
  throw new ScanError(
    "Photo reading isn't available right now. Enter the bet manually for now, or try again in a little while.",
  );
}
