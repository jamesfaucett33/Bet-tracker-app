import jsQR from 'jsqr';
import { Platform } from 'react-native';
import { Bet } from './types';

/**
 * Reads the QR code on a bet slip photo. Retail tickets (e.g. Caesars) print a
 * QR that links to the sportsbook's own ticket tracker. Web only for now: it
 * needs a canvas to get at the pixels.
 */
export async function decodeSlipQr(jpegBase64: string): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  try {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${jpegBase64}`;
    await img.decode();
    // QR finders work best at a few sizes; small codes need more pixels.
    for (const size of [1000, 700, 1400, 500]) {
      const scale = size / Math.max(img.width, img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const code = jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (code?.data && /^https?:\/\//i.test(code.data)) return code.data;
    }
  } catch {
    // A missing QR is normal; scanning still works without it.
  }
  return null;
}

import { ticketDigits } from './dupes';
export { ticketDigits };

/**
 * Caesars tracker links are ".../tracker/<region>/ticket/<ticket digits>", so
 * once one ticket's QR has been read, other tickets from the same place can
 * get their link from the printed ticket number alone.
 */
export function deriveTrackerUrl(
  book: string,
  notes: string | undefined,
  existing: Bet[],
): string | undefined {
  const digits = ticketDigits({ notes });
  if (!digits) return undefined;
  const sameBook = existing.find(
    (b) =>
      b.trackerUrl &&
      b.book.toLowerCase() === book.toLowerCase() &&
      /\/ticket\//.test(b.trackerUrl),
  );
  if (!sameBook?.trackerUrl) return undefined;
  return sameBook.trackerUrl.replace(/\/ticket\/[^/?#]+/, `/ticket/${digits}`);
}
