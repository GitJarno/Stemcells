/**
 * The light in a Cell's composer, as numbers: its wash, band and bloom, the band's travel and the
 * iris, ported from the Swift app's glow. The DOM side is `motion.ts`, the state it says `glow.ts`;
 * plain numbers, so the phone draws the same light (`apps/mobile/src/stemcells/glow/kit.ts`).
 */
import { CREST_REACH } from "../motion/beat";
import { brandTokenOf } from "../tokens/providers";

/** A provider's brand token (`tokens/providers.ts`); any other wears the accent. */
export function toneTokenOf(driver: string | null): string {
  return brandTokenOf(driver) ?? "--sc-accent";
}

// MARK: - Colour

/** sRGB channels, 0–255. */
export type Rgb = readonly [number, number, number];

/** The light the band's core adds to dark glass, as relative luminance: set by the words over it, not by taste. */
export const LIGHT = 0.015;
/** The glass that rule was set on: the Swift app's near-black plate, in sRGB. */
const RULE_GLASS = 0.1;
/** The hue drift at the band's edges, a turn of the colour wheel either way. */
export const DRIFT = 0.05;
/**
 * The stained glass, anchor end first: deepest where the light comes from,
 * thinnest across the middle, turned a little round its hue by the far end.
 */
export const WASH = [
  { at: 0, alpha: 0.15, lift: 0.12, turn: 0.02 },
  { at: 0.55, alpha: 0.08, lift: 0.04, turn: 0 },
  { at: 1, alpha: 0.1, lift: 0.06, turn: -0.02 },
] as const;
/** The bloom's alpha at its heart, and its reach as a multiple of the anchor's inset. */
export const BLOOM = 0.45;
export const BLOOM_REACH = 2.6;
/** The band: half the glass wide, never under 36 pixels, leaning 24° into its travel. */
export const BAND_SPAN = 0.5;
export const BAND_LEAST = 36;
export const BAND_LEAN = (24 * Math.PI) / 180;
/** The iris holds its light to this share of its radius, then feathers out. */
export const IRIS_SOLID = 0.78;

function hsb([r, g, b]: Rgb): [number, number, number] {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue / 6 + 1) % 1;
  }
  return [hue, max === 0 ? 0 : delta / max, max];
}

function rgbOf(hue: number, saturation: number, brightness: number): Rgb {
  const channel = (n: number) => {
    const k = (n + hue * 6) % 6;
    return brightness - brightness * saturation * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [channel(5) * 255, channel(3) * 255, channel(1) * 255];
}

/**
 * `tone` turned round the colour wheel and lifted toward white, at `alpha`:
 * every colour in the light stays in the tone's own family. A grey has no
 * hue to turn and simply brightens.
 */
export function variant(tone: Rgb, turn: number, lift: number, alpha: number): string {
  const [hue, saturation, brightness] = hsb(tone);
  const [r, g, b] = rgbOf(
    (hue + turn + 1) % 1,
    saturation * (1 - lift),
    brightness + (1 - brightness) * lift,
  );
  return rgba([r, g, b], alpha);
}

export function rgba([r, g, b]: Rgb, alpha: number): string {
  const round = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${Number(alpha.toFixed(4))})`;
}

const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Relative luminance of an sRGB colour given as 0–1 channels. */
function luminance(rgb: readonly number[]): number {
  return 0.2126 * linear(rgb[0]!) + 0.7152 * linear(rgb[1]!) + 0.0722 * linear(rgb[2]!);
}

/** Relative luminance of an sRGB colour. */
export const luminanceOf = (rgb: Rgb): number => luminance(rgb.map((c) => c / 255));

/** `tone` washed over `glass` at the wash's middle alpha, 0–1 channels. */
function washed(tone: Rgb, glass: Rgb): number[] {
  const alpha = WASH[1].alpha;
  return [0, 1, 2].map((c) => (alpha * tone[c]! + (1 - alpha) * glass[c]!) / 255);
}

/**
 * The alpha at which the band's core, `tone` over the washed glass, lights it by `LIGHT`; a pale
 * tone already tints the glass more, so its band is thinner. On dark glass (`lightInk`) the core
 * adds `LIGHT` to the luminance, as the Swift app's rule says; on light glass it takes the same
 * share of the words' contrast that rule takes on the Swift app's glass.
 */
export function strength(tone: Rgb, glass: Rgb, lightInk: boolean): number {
  const ground = washed(tone, glass);
  const core = tone.map((c) => c / 255);
  const at = (alpha: number) =>
    luminance([0, 1, 2].map((c) => alpha * core[c]! + (1 - alpha) * ground[c]!));
  const plain = at(0);
  let crest = plain + LIGHT;
  if (!lightInk) {
    const rule = luminance(washed(tone, [RULE_GLASS * 255, RULE_GLASS * 255, RULE_GLASS * 255]));
    crest = ((rule + 0.05) / (rule + 0.05 + LIGHT)) * (plain + 0.05) - 0.05;
  }
  const rising = crest > plain;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (rising ? at(mid) < crest : at(mid) > crest) low = mid;
    else high = mid;
  }
  return Math.min(low, 0.8);
}

/**
 * The band's colours left to right: a raised cosine, cubed, so no edge
 * anywhere and most of its light in the middle third, running from the tone
 * turned one way, through the tone, to the tone turned the other.
 */
export function bandStops(tone: Rgb, alpha: number): string[] {
  const steps = 12;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps;
    const bell = Math.cos(Math.PI * (u - 0.5)) ** 3;
    const colour = variant(tone, (u - 0.5) * 2 * DRIFT, 0, alpha * Math.max(0, bell));
    return `${colour} ${Number((u * 100).toFixed(3))}%`;
  });
}

/** The wash's three colours, anchor end first. */
export function washColours(tone: Rgb): string[] {
  return WASH.map((stop) => variant(tone, stop.turn, stop.lift, stop.alpha));
}

/** The bloom, heart outward: lifted toward white, then thinning to clear. */
export function bloomStops(tone: Rgb): string[] {
  return [
    `${variant(tone, 0, 0.4, BLOOM)} 0%`,
    `${variant(tone, 0, 0.15, BLOOM * 0.35)} 40%`,
    `${rgba(tone, 0)} 100%`,
  ];
}

// MARK: - Geometry, in CSS pixels with y down

export type Point = { readonly x: number; readonly y: number };
export type Size = { readonly width: number; readonly height: number };

/** How far the band's lean carries its top and foot past its middle, on glass `height` tall. */
function leanOf(height: number): number {
  return (height / 2) * Math.tan(BAND_LEAN);
}

/**
 * The band's width on glass of `size`: half the glass, no narrower than a
 * folded pill's, and narrow enough that, lean included, it waits clear of
 * the glass anywhere in its pane while the crest is `CREST_REACH` out.
 */
export function bandWidth(size: Size): number {
  const fits = 2 * (CREST_REACH - leanOf(size.height) - 1);
  return Math.max(BAND_LEAST, Math.min(size.width * BAND_SPAN, fits));
}

/** How far the band reaches either side of its crest, its lean included. */
export function bandReach(size: Size): number {
  return bandWidth(size) / 2 + leanOf(size.height) + 1;
}

/** The iris's radius fully open: past the glass's far corner from the anchor, rim included. */
export function irisRadius(size: Size, anchor: Point): number {
  const far = Math.max(
    Math.hypot(anchor.x, anchor.y),
    Math.hypot(size.width - anchor.x, anchor.y),
    Math.hypot(anchor.x, size.height - anchor.y),
    Math.hypot(size.width - anchor.x, size.height - anchor.y),
  );
  return far / IRIS_SOLID + 1;
}

/**
 * A linear gradient from `start` to `end` over a box of `size`, as CSS
 * draws one: an angle and stop offsets along its line, so the colours land
 * where an axial gradient between the two points puts them.
 */
export function axial(
  size: Size,
  start: Point,
  end: Point,
  stops: readonly (readonly [colour: string, at: number])[],
): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dx, -dy);
  const ux = Math.sin(angle);
  const uy = -Math.cos(angle);
  const line = Math.abs(size.width * ux) + Math.abs(size.height * uy);
  const offset = (start.x - size.width / 2) * ux + (start.y - size.height / 2) * uy + line / 2;
  const px = (v: number) => `${Number(v.toFixed(2))}px`;
  const degrees = Number(((angle * 180) / Math.PI).toFixed(3));
  return `linear-gradient(${degrees}deg, ${stops
    .map(([colour, at]) => `${colour} ${px(offset + at * length)}`)
    .join(", ")})`;
}

/** The wash's far end, and where it drifts to: from opposite the anchor toward the anchor's side, nearer the middle. */
export function washEnds(
  size: Size,
  anchor: Point,
): { readonly far: Point; readonly drift: Point } {
  const ax = anchor.x / size.width;
  const ay = anchor.y / size.height;
  return {
    far: { x: (1 - ax) * size.width, y: (1 - ay) * size.height },
    drift: { x: (1 - ax) * size.width, y: (ay + (0.5 - ay) * 0.4) * size.height },
  };
}

// MARK: - The provider's imprint

/** The mark's side on glass of `size`. */
export function imprintSide(size: Size): number {
  return Math.min(size.width * 0.4, size.height * 1.5, 150);
}

/** How far the mark hangs past the glass's trailing and bottom edges, as a share of its side. */
export const IMPRINT_OVERHANG = 0.15;

/**
 * Whether glass of `size` holds the mark clear of the send button in the
 * corner they share: the mark's middle stands beyond the button's far edge,
 * `clearing` from that corner. A plate too short draws none.
 */
export function imprintShows(size: Size, clearing: number): boolean {
  return imprintSide(size) * (0.5 - IMPRINT_OVERHANG) > clearing;
}

// MARK: - The working word's sheen

/** The sheen's band, the same on every word it lights: one band crossing the whole window on the glass's beat. */
export const SHEEN_BAND = 36;
/** The band's core over the word's ink: a light you find, not a flash. */
export const SHEEN_CORE = 0.8;

const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function oklab(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map((c) => linear(c / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([lightness, a, b]: readonly [number, number, number]): Rgb {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channel = (v: number) => Math.min(255, Math.max(0, gamma(v) * 255));
  return [
    channel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    channel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    channel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * The sheen's colour: `tone` lifted in OKLab to at least `floor`'s
 * lightness (the interface ink's), its hue and chroma kept, so the band is
 * always a light over the word, never a shade.
 */
export function sheenTone(tone: Rgb, floor: Rgb): Rgb {
  const [lightness, a, b] = oklab(tone);
  const least = oklab(floor)[0];
  return lightness >= least ? tone : fromOklab([least, a, b]);
}
