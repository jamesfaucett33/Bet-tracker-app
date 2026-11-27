// Render transparent BetKeeper logo files from lockups.html (badge + wordmark).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'lockups.html'));
  await p.waitForTimeout(300);
  for (const [id, file] of [['h', 'betkeeper-logo-horizontal.png'], ['v', 'betkeeper-logo-stacked.png'], ['w', 'betkeeper-wordmark.png']]) {
    await p.locator('#' + id).screenshot({ path: path.join(__dirname, file), omitBackground: true });
    console.log('wrote brand/' + file);
  }
  await b.close();
})();
