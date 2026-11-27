import { Platform } from 'react-native';
import { formatDate } from './format';
import { betProfit, betToWin, formatOdds } from './odds';
import { colors } from './theme';
import { Bet } from './types';

/**
 * Shareable win / bad-beat card: a 1080x1350 image (Instagram portrait) of a
 * settled ticket, drawn on a canvas in the app's current colors. Web only.
 */

export type CardKind = 'win' | 'beat';

export function cardKind(bet: Bet): CardKind | null {
  if (bet.status === 'won') return 'win';
  if (bet.status === 'lost') return 'beat';
  return null;
}

const W = 1080;
const H = 1350;
const FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

const money = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cut text to fit a width, adding "…". */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

/** The BetKeyper shield (same shape as the app icon), drawn at (x, y). */
function shield(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 210;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-18, -4);
  const outer = new Path2D('M105 10 l80 28 v62 c0 52 -36 86 -80 100 c-44 -14 -80 -48 -80 -100 v-62z');
  ctx.fillStyle = colors.surface;
  ctx.fill(outer);
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colors.brand;
  ctx.stroke(outer);
  ctx.fillStyle = colors.brand;
  ctx.fill(new Path2D('M105 32 l60 21 v47 c0 40 -27 66 -60 77 c-33 -11 -60 -37 -60 -77 v-47z'));
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.arc(105, 92, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fill(new Path2D('M96 104 h18 l7 40 h-32z'));
  ctx.restore();
}

/** Draws the card and returns it as a PNG blob. */
export async function drawCard(bet: Bet, inviteCode?: string | null): Promise<Blob> {
  const kind = cardKind(bet) ?? 'win';
  const win = kind === 'win';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const hot = win ? colors.money : colors.loss;

  // Background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, colors.surface);
  g.addColorStop(1, colors.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = hot;
  ctx.lineWidth = 14;
  roundRect(ctx, 22, 22, W - 44, H - 44, 48);
  ctx.stroke();

  // Header: shield + wordmark
  shield(ctx, 80, 70, 96);
  ctx.textBaseline = 'middle';
  ctx.font = `900 64px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Bet', 196, 120);
  const betW = ctx.measureText('Bet').width;
  ctx.fillStyle = colors.brand;
  ctx.fillText('Keyper', 196 + betW, 120);

  // Headline
  const legs = bet.legs ?? [];
  const missed = legs.filter((l) => l.result === 'miss').length;
  const hits = legs.filter((l) => l.result === 'hit').length;
  const headline = win ? 'CASHED!' : missed === 1 && hits > 0 ? 'ONE LEG AWAY' : 'BAD BEAT';
  const emoji = win ? '💰' : missed === 1 && hits > 0 ? '😩' : '💀';
  ctx.textAlign = 'center';
  ctx.fillStyle = hot;
  let size = 120;
  ctx.font = `900 ${size}px ${FONT}`;
  while (size > 60 && ctx.measureText(`${headline} ${emoji}`).width > W - 180) {
    size -= 4;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  ctx.fillText(`${headline} ${emoji}`, W / 2, 300);

  // Big number
  const amount = win ? betProfit(bet) : betToWin(bet);
  const big = win ? `+${money(amount)}` : money(amount);
  let bigSize = 170;
  ctx.font = `900 ${bigSize}px ${FONT}`;
  while (bigSize > 80 && ctx.measureText(big).width > W - 180) {
    bigSize -= 6;
    ctx.font = `900 ${bigSize}px ${FONT}`;
  }
  ctx.fillStyle = win ? colors.money : '#FFFFFF';
  ctx.fillText(big, W / 2, 470);
  ctx.font = `700 40px ${FONT}`;
  ctx.fillStyle = colors.textDim;
  ctx.fillText(
    win ? `on a ${money(bet.stake)} bet` : `would have paid on a ${money(bet.stake)} bet`,
    W / 2,
    575,
  );

  // Ticket box
  const top = 650;
  const rows = legs.length ? legs.slice(0, 7) : [{ pick: bet.pick, result: win ? 'hit' : 'miss' }];
  const boxH = 120 + rows.length * 74 + (legs.length > 7 ? 60 : 0);
  ctx.fillStyle = colors.surfaceAlt;
  roundRect(ctx, 80, top, W - 160, boxH, 36);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = `800 36px ${FONT}`;
  ctx.fillStyle = colors.sky;
  const title = legs.length
    ? `${legs.length}-LEG ${bet.betType.toUpperCase()} · ${formatOdds(bet.odds)}`
    : `${bet.betType.toUpperCase()} · ${formatOdds(bet.odds)}`;
  ctx.fillText(fit(ctx, title, W - 240), 120, top + 60);
  rows.forEach((l, i) => {
    const y = top + 130 + i * 74;
    const r = (l as { result?: string }).result;
    const mark = r === 'hit' ? '✓' : r === 'miss' ? '✗' : r === 'push' || r === 'void' ? '–' : '•';
    ctx.font = `900 44px ${FONT}`;
    ctx.fillStyle = r === 'hit' ? colors.win : r === 'miss' ? colors.loss : colors.textDim;
    ctx.fillText(mark, 120, y);
    ctx.font = `700 40px ${FONT}`;
    ctx.fillStyle = r === 'miss' ? '#FFFFFF' : colors.text;
    ctx.fillText(fit(ctx, l.pick || bet.pick, W - 330), 180, y);
  });
  if (legs.length > 7) {
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = colors.textDim;
    ctx.fillText(`+ ${legs.length - 7} more legs`, 180, top + 130 + 7 * 74);
  }

  // Footer line
  const foot = [bet.book, bet.date ? formatDate(bet.date) : ''].filter(Boolean).join(' · ');
  ctx.textAlign = 'center';
  ctx.font = `700 34px ${FONT}`;
  ctx.fillStyle = colors.textDim;
  ctx.fillText(foot, W / 2, H - 150);
  const footText = inviteCode
    ? `🎁 Join free with code ${inviteCode}: we both get 25 bet uploads`
    : 'Every ticket. Every book. One place.';
  let footSize = 36;
  ctx.font = `800 ${footSize}px ${FONT}`;
  while (footSize > 24 && ctx.measureText(footText).width > W - 140) {
    footSize -= 2;
    ctx.font = `800 ${footSize}px ${FONT}`;
  }
  ctx.fillStyle = colors.brand;
  ctx.fillText(
    inviteCode
      ? `🎁 Join free with code ${inviteCode}: we both get 25 bet uploads`
      : 'Every ticket. Every book. One place.',
    W / 2,
    H - 90,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the card'))), 'image/png'),
  );
}

export function canMakeCards(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

/**
 * Opens the phone's share sheet with the card (Messages, Instagram, ...), or
 * downloads it where sharing files isn't supported. Call from a tap.
 */
export async function shareCard(
  blob: Blob,
  kind: CardKind,
  text?: string,
): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], kind === 'win' ? 'betkeyper-win.png' : 'betkeyper-bad-beat.png', {
    type: 'image/png',
  });
  const nav = globalThis.navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav?.canShare?.({ files: [file] })) {
    try {
      const lead = kind === 'win' ? 'Cashed 💰' : 'Bad beat 💀';
      await nav.share({ files: [file], text: text ? `${lead} ${text}` : `${lead} #BetKeyper` });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}
