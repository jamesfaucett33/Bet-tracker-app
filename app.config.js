// Expo reads app.json, then this file. On Cloudflare Pages (betkeyper.com) the
// app lives at the site root, so the build sets EXPO_ROOT=1; GitHub Pages keeps
// the /Bet-tracker-app path from app.json.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_ROOT === '1' ? '' : config.experiments?.baseUrl,
  },
});
