# BetKeyper brand

- **Logo:** a sports shield with a keyhole. Neon lime `#7BEA2B` (highlight `#A6F55F`), on deep navy `#061733`. Card blue `#0D2650`.
- **Wordmark:** "Bet" in navy `#0B2A5B` (white on dark backgrounds, including the app), "Keyper" in neon lime `#7BEA2B`, heavy weight.
- **Tagline:** "Bet anywhere. Keep it here."
- `badge.html` is the vector source (SVG drawn in the page). `node brand/make-icons.js` (needs Playwright) re-renders every app icon size from it.
- Don't use team names or logos in BetKeyper marketing.
- **Transparent logo files** (for marketing, social, video, the website):
  - `betkeyper-badge.png`: the shield alone
  - `betkeyper-logo-horizontal.png`: shield + wordmark side by side
  - `betkeyper-logo-stacked.png`: shield over the wordmark
  - `betkeyper-wordmark.png`: the word alone
  - `*-on-dark.png`: the same with "Bet" in white, for dark backgrounds
  Re-render with `node brand/make-lockups.js` (from `lockups.html`).
- App icons keep the solid navy square: iOS and Android don't allow transparent app icons.
