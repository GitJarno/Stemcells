/**
 * Stemcells' mark, SC█, in each file upstream ships a T3 mark in. Upstream
 * names its brand files in `scripts/lib/brand-assets.ts`; that list runs
 * through `withStemcellsBrand` (one seam), so every build that reads it (the
 * desktop app's icon, the web icons the server and desktop builds copy in,
 * the phone's icon and splash) takes ours. Stemcells has one mark, so each
 * channel (dev, nightly, prod) gets the same file.
 *
 * The source is `app-icon.icon`, the Swift app's icon copied as it is. The
 * rest are rendered from it by Apple's tools, never drawn by hand
 * (`stemcells/brand/README.md`).
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
