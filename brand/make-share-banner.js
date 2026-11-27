// Renders brand/share-banner.html to public/og-image.png (the link-preview ad).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(__dirname, 'share-banner.html'));
  await p.waitForTimeout(300);
  await p.locator('#ad').screenshot({ path: path.join(__dirname, '..', 'public', 'og-image.png') });
  await b.close();
  console.log('wrote public/og-image.png');
})();
