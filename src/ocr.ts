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

/** Reads the text on a JPEG (base64). */
export async function readTextOnDevice(jpegBase64: string): Promise<string> {
  if (!canReadOnDevice()) throw new Error('On-device reading is only available in the web app.');
  const worker = await getWorker();
  const { data } = await worker.recognize(`data:image/jpeg;base64,${jpegBase64}`);
  return data.text ?? '';
}
