import { Platform } from 'react-native';

/**
 * On-device text recognition (Tesseract) for reading bet slips without an AI
 * key. The engine and English model (~7 MB) are served from this site's
 * /ocr folder and cached by the browser after the first scan. Web only.
 */

interface TesseractWorker {
  recognize(image: string): Promise<{ data: { text: string } }>;
}
interface TesseractGlobal {
  createWorker(
    lang: string,
    oem: number,
    options: Record<string, unknown>,
  ): Promise<TesseractWorker>;
}

let workerPromise: Promise<TesseractWorker> | null = null;

function basePath(): string {
  // "/Bet-tracker-app/" on GitHub Pages, "/" elsewhere.
  return (globalThis.location?.pathname ?? '/').replace(/[^/]*$/, '');
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the text reader.'));
    document.head.appendChild(s);
  });
}

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const base = `${globalThis.location.origin}${basePath()}ocr/`;
      const g = globalThis as unknown as { Tesseract?: TesseractGlobal };
      if (!g.Tesseract) await loadScript(`${base}tesseract.min.js`);
      if (!g.Tesseract) throw new Error('Could not load the text reader.');
      return g.Tesseract.createWorker('eng', 1, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: base.replace(/\/$/, ''),
        gzip: true,
        workerBlobURL: false,
      });
    })().catch((e) => {
      workerPromise = null; // allow a retry
      throw e;
    });
  }
  return workerPromise;
}

export const canReadOnDevice = () => Platform.OS === 'web' && typeof document !== 'undefined';

/**
 * A high-contrast, enlarged copy of the photo: grayscale, then stretch the
 * darkest/brightest 2% to black/white. Helps with shadows and faded print.
 */
async function enhance(jpegBase64: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${jpegBase64}`;
  await img.decode();
  const scale = Math.min(1.5, 2400 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const hist = new Array(256).fill(0);
  const gray = new Uint8ClampedArray(px.length / 4);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    gray[j] = g;
    hist[g]++;
  }
  const cut = gray.length * 0.02;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < cut; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < cut; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, ((gray[j] - lo) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Shadow-proof black & white copy: each pixel is compared with the average
 * brightness around it (Bradley adaptive threshold), so text stays dark even
 * where a shadow or glare falls across the ticket.
 */
async function binarize(jpegBase64: string): Promise<HTMLCanvasElement> {
  const canvas = await enhance(jpegBase64);
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += px[(y * w + x) * 4];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + row;
    }
  }
  const half = Math.max(8, Math.round(w / 24));
  const t = 0.15;
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(w, x + half + 1);
      const sum =
        integral[y2 * (w + 1) + x2] -
        integral[y1 * (w + 1) + x2] -
        integral[y2 * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1];
      const mean = sum / ((x2 - x1) * (y2 - y1));
      const i = (y * w + x) * 4;
      const v = px[i] < mean * (1 - t) ? 0 : 255;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export type ReadMode = 'plain' | 'shadowfree' | 'contrast';

/** Reads the text on a JPEG (base64), optionally from a cleaned-up copy. */
export async function readTextOnDevice(
  jpegBase64: string,
  mode: ReadMode = 'plain',
): Promise<string> {
  if (!canReadOnDevice()) throw new Error('On-device reading is only available in the web app.');
  const worker = await getWorker();
  const input =
    mode === 'shadowfree'
      ? await binarize(jpegBase64)
      : mode === 'contrast'
        ? await enhance(jpegBase64)
        : `data:image/jpeg;base64,${jpegBase64}`;
  const { data } = await worker.recognize(input as unknown as string);
  return data.text ?? '';
}
