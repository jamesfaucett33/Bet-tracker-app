// Copies the on-device text recognition (Tesseract) files into public/ocr so
// the web app can read bet slips without any API key. Runs after npm install.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'public', 'ocr');
const files = [
  ['node_modules/tesseract.js/dist/tesseract.min.js', 'tesseract.min.js'],
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];

fs.mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  const src = path.join(root, from);
  if (!fs.existsSync(src)) {
    if (!to.includes('relaxedsimd')) console.warn(`[ocr] missing ${from}`);
    continue;
  }
  fs.copyFileSync(src, path.join(out, to));
}
console.log('[ocr] assets copied to public/ocr');
