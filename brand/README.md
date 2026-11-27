# BetKeeper brand

- **Logo:** a sports shield with a keyhole. Neon lime `#7BEA2B` (highlight `#A6F55F`), on deep navy `#061733`. Card blue `#0D2650`.
- **Wordmark:** "Bet" in sky blue `#3CC4FF`, "Keeper" in neon lime `#7BEA2B`, heavy weight.
- **Tagline:** "Bet anywhere. Keep it here."
- `badge.html` is the vector source (SVG drawn in the page). `node brand/make-icons.js` (needs Playwright) re-renders every app icon size from it.
- Don't use team names or logos in BetKeeper marketing.
- **Transparent logo files** (for marketing, social, video, the website):
  - `betkeeper-badge.png`: the shield alone
  - `betkeeper-logo-horizontal.png`: shield + wordmark side by side
  - `betkeeper-logo-stacked.png`: shield over the wordmark
  - `betkeeper-wordmark.png`: the word alone
  Re-render with `node brand/make-lockups.js` (from `lockups.html`).
- App icons keep the solid navy square: iOS and Android don't allow transparent app icons.
