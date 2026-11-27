// Render the BetKeeper badge to every icon file the app uses.
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = 'file://' + path.join(__dirname, 'badge.html');
const NAVY = '#061733';

const jobs = [
  // [file, size, opts, transparent]
  ['assets/icon.png', 1024, { bg: NAVY, scale: 0.78 }, false],
  ['assets/splash-icon.png', 1024, { scale: 0.6 }, true],
  ['assets/favicon.png', 48, { bg: NAVY, scale: 0.92 }, false],
  ['assets/android-icon-foreground.png', 512, { scale: 0.58 }, true],
  ['assets/android-icon-monochrome.png', 432, { scale: 0.58, mono: true }, true],
  ['public/apple-touch-icon.png', 180, { bg: NAVY, scale: 0.78 }, false],
  ['public/icon-192.png', 192, { bg: NAVY, scale: 0.78 }, false],
  ['public/icon-512.png', 512, { bg: NAVY, scale: 0.78 }, false],
  // header mark (transparent, tight)
  ['assets/badge.png', 256, { scale: 0.96 }, true],
];

(async () => {
  const b = await chromium.launch();
  for (const [file, size, opts, transparent] of jobs) {
    const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: size / 1024 });
    await p.goto(HTML);
    await p.evaluate((o) => window.render(o), opts);
    await p.screenshot({ path: path.join(ROOT, file), omitBackground: transparent, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
    await p.close();
    console.log('wrote', file, size);
  }
  await b.close();
})();
