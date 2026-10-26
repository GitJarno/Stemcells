/**
 * Stemcells' mark, SC█, in each file upstream ships a T3 mark in: upstream's list in
 * `scripts/lib/brand-assets.ts` runs through `withStemcellsBrand` (one seam), so every build
 * that reads it takes ours, the same file for each channel. All are rendered from
 * `app-icon.icon` by Apple's tools, never drawn by hand (`stemcells/brand/README.md`).
 */

/** Our brand files, from the repository's root. */
export const STEMCELLS_BRAND_DIR = "stemcells/brand";

/** The kind of brand file an upstream path names, by its ending, and ours. */
const OURS_BY_ENDING: ReadonlyArray<readonly [ending: RegExp, file: string]> = [
  [/\.icon$/, "app-icon.icon"],
  [/-ios-1024\.png$/, "ios-1024.png"],
  [/-macos-1024\.png$/, "macos-1024.png"],
  [/-universal-1024\.png$/, "universal-1024.png"],
  [/-windows\.ico$/, "windows.ico"],
  [/-web-favicon\.ico$/, "web-favicon.ico"],
  [/-web-favicon-16x16\.png$/, "web-favicon-16x16.png"],
  [/-web-favicon-32x32\.png$/, "web-favicon-32x32.png"],
  [/-web-apple-touch-180\.png$/, "web-apple-touch-180.png"],
];

/**
 * Ours for the brand file upstream names (`assets/prod/black-macos-1024.png`
 * gives `stemcells/brand/macos-1024.png`). A kind we have no file for throws,
 * so a new upstream brand file stops every build until it has ours.
 */
export function stemcellsBrandAsset(upstreamPath: string): string {
  const match = OURS_BY_ENDING.find(([ending]) => ending.test(upstreamPath));
  if (match === undefined) {
    throw new Error(`Stemcells has no brand file in place of ${upstreamPath}.`);
  }
  return `${STEMCELLS_BRAND_DIR}/${match[1]}`;
}

/** Upstream's list of brand files, each replaced by ours. */
export function withStemcellsBrand<Paths extends Record<string, string>>(
  paths: Paths,
): { readonly [Name in keyof Paths]: string } {
  return Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [name, stemcellsBrandAsset(path)]),
  ) as { readonly [Name in keyof Paths]: string };
}

/** The colour our mark sits on, the `.icon`'s fill. */
const MARK_GROUND = "#000000";
/** The mark's ink, the layers' fill. */
const MARK_INK = "#EDE9E0";

/**
 * The phone's channel (`app.config.ts`) with our Android art, which upstream names there rather
 * than in its list (rendered by `stemcells/scripts/render-phone-art`), and the mark's own colours
 * in place of each channel's. `fromRepoRoot` turns our path into one the config can use.
 */
export function withStemcellsPhoneArt<Channel extends { readonly assets: object }>(
  channel: Channel,
  fromRepoRoot: (path: string) => string,
) {
  const ours = (file: string) => fromRepoRoot(`${STEMCELLS_BRAND_DIR}/${file}`);
  return {
    ...channel,
    assets: {
      ...channel.assets,
      androidAdaptiveForeground: ours("android-foreground.png"),
      androidAdaptiveBackgroundColor: MARK_GROUND,
      androidAdaptiveBackgroundImage: undefined,
      androidMonochromeIcon: ours("android-foreground.png"),
      androidSplashIcon: ours("android-splash.png"),
      androidNotificationIcon: ours("android-notification.png"),
      androidNotificationColor: MARK_INK,
    },
  };
}
