import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Crush of Roses — Android wrapper (Capacitor thin shell).
 *
 * The game is NOT bundled here. The wrapper loads the live site, so game
 * updates deploy to the site and the wrapper picks them up with no rebuild.
 *
 * Dev vs live is chosen by the CRUSH_SITE env var (default: dev):
 *   npm run sync:dev   -> https://crush-of-roses-dev.pages.dev/
 *   npm run sync:live  -> https://crushofroses.com/
 *
 * Capacitor sets window.Capacitor natively in the WebView, which is how the
 * game detects it is wrapped (see batch17-contracts.md §1: isWrappedApp()).
 */
const SITE_URLS = {
  dev: 'https://crush-of-roses-dev.pages.dev/',
  live: 'https://crushofroses.com/',
} as const;

const site = (process.env.CRUSH_SITE ?? 'dev') as keyof typeof SITE_URLS;
if (!(site in SITE_URLS)) {
  throw new Error(`CRUSH_SITE must be "dev" or "live", got "${process.env.CRUSH_SITE}"`);
}

const config: CapacitorConfig = {
  appId: 'com.slothgamelab.crushofroses',
  appName: 'Crush of Roses',
  // Local fallback only: the WebView loads server.url; www/ is copied into
  // the APK as a fallback and is required by `cap sync`. It contains no
  // game code — just an offline message.
  webDir: 'www',
  server: {
    url: SITE_URLS[site],
    // Allow navigation only within the game site (and its auth/payment
    // redirects). Everything else opens in the system browser.
    allowNavigation: [
      'crush-of-roses-dev.pages.dev',
      'crushofroses.com',
      'accounts.google.com',
      'checkout.stripe.com',
      'billing.stripe.com',
    ],
  },
  android: {
    // Keep the bundled fallback from ever being served instead of the site.
    allowMixedContent: false,
  },
};

export default config;
