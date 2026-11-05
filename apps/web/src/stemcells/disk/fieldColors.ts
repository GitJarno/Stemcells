// What the field wears. Kinds keep one colour on every drive and every machine; each set is checked
// for colour-blind separation on all pairs, since bands sort by size and any two can touch. Only
// what's free is lighter than these, in the headline's colour, so the room reads first.

export type Rgb = readonly [number, number, number];

export interface FieldColors {
  readonly socket: Rgb;
  /** Two close greys, in a weave: what wasn't measured stands back as the bedrock. */
  readonly system: readonly [Rgb, Rgb];
  readonly counting: Rgb;
  readonly other: Rgb;
  /** The flash a cell lands with. */
  readonly flash: Rgb;
  readonly kinds: Readonly<Record<string, Rgb>>;
  /** A drive with no kinds wears these by folder, biggest first; more than this fold into Other. */
  readonly folders: ReadonlyArray<Rgb>;
  /** Whether lightening means towards white. */
  readonly dark: boolean;
}

const hex = (value: string): Rgb => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
];

const DARK_SET = ["#06a6c9", "#7068ff", "#eb5985", "#ad2db0", "#a8551a"].map(hex);
const LIGHT_SET = ["#00a9c8", "#9b69fd", "#f8467b", "#910191", "#974a03"].map(hex);

const kindsFrom = (set: ReadonlyArray<Rgb>, other: Rgb): Record<string, Rgb> => ({
  code: set[0] ?? other,
  agents: set[1] ?? other,
  apps: set[2] ?? other,
  tools: set[3] ?? other,
  caches: set[4] ?? other,
  media: other,
  documents: other,
  appData: other,
  trash: other,
});

const DARK_OTHER = hex("#7a8596");
const LIGHT_OTHER = hex("#8a94a6");

export const DARK_FIELD: FieldColors = {
  socket: hex("#1a1a1a"),
  system: [hex("#303030"), hex("#2c2c2c")],
  counting: hex("#5b5b5b"),
  other: DARK_OTHER,
  flash: hex("#ffffff"),
  kinds: kindsFrom(DARK_SET, DARK_OTHER),
  folders: DARK_SET,
  dark: true,
};

export const LIGHT_FIELD: FieldColors = {
  socket: hex("#efefef"),
  system: [hex("#d4d4d4"), hex("#d9d9d9")],
  counting: hex("#a3a3a3"),
  other: LIGHT_OTHER,
  flash: hex("#000000"),
  kinds: kindsFrom(LIGHT_SET, LIGHT_OTHER),
  folders: LIGHT_SET,
  dark: false,
};

export const bandColor = (
  colors: FieldColors,
  band: { readonly kind: string; readonly rank: number },
): Rgb => {
  if (band.kind === "system") return colors.system[0];
  if (band.kind === "counting") return colors.counting;
  if (band.kind === "folder") return colors.folders[band.rank] ?? colors.other;
  return colors.kinds[band.kind] ?? colors.other;
};

export const rgbCss = (rgb: Rgb, alpha = 1) =>
  `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${alpha})`;

export const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

/** A theme token's colour as sRGB, whatever its CSS spelling (`oklch`, `var`, `color-mix`). */
export function resolveTokenRgb(token: string, fallback: Rgb): Rgb {
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (context === null) return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (value === "") return fallback;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
  return alpha === 0 ? fallback : [red, green, blue];
}
