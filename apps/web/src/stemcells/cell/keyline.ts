// How a Cell's art reads on the frame behind it. On black every piece reads;
// on the light canvas a pale piece's edge melts into the page, so a light
// frame draws a one-cell keyline in charcoal outside every pale piece cell
// that faces the void. No piece is redrawn: the pass is the compositor's.

/** The frames a Cell is drawn on: the dark canvas and the light one. */
export const FRAMES = { black: "#08090B", light: "#FCFCFC" } as const;

export type Ground = keyof typeof FRAMES;

/** The keyline's ink: charcoal (`4` in `kit/palette.json`). */
export const KEYLINE = "4";

/** The least contrast an edge needs against its frame to read. */
export const MIN_CONTRAST = 1.6;

/** The body's own roles: the body is the provider's colour and is never keylined. */
export const BODY_ROLES: ReadonlySet<string> = new Set(["B", "b", "L", "O"]);

const channels = (hex: string): [number, number, number, number] => {
  const value = hex.replace("#", "");
  const at = (i: number) => Number.parseInt(value.slice(i, i + 2), 16);
  return [at(0), at(2), at(4), value.length >= 8 ? at(6) / 255 : 1];
};

/** `ink` as it shows over `ground`: its alpha blended in. */
function over(ink: string, ground: string): [number, number, number] {
  const [r, g, b, a] = channels(ink);
  const [gr, gg, gb] = channels(ground);
  return [r * a + gr * (1 - a), g * a + gg * (1 - a), b * a + gb * (1 - a)];
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: readonly [number, number, number]) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** The contrast ratio (WCAG's, 1 to 21) of `ink` shown over `ground` against `ground`. */
export function contrast(ink: string, ground: string): number {
  const a = luminance(over(ink, ground));
  const b = luminance(over(ground, ground));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Whether the cell at (`x`, `y`) of `rows` is set and touches the void (a clear cell or the grid's edge). */
export function facesVoid(rows: readonly string[], x: number, y: number): boolean {
  if ((rows[y]?.[x] ?? ".") === ".") return false;
  return NEIGHBOURS.some(([dx, dy]) => (rows[y + dy]?.[x + dx] ?? ".") === ".");
}

/**
 * `rows` as a light frame draws them: a keyline in every clear cell beside a
 * piece cell (any role but the body's) too pale to read against `ground`.
 */
export function keylined(
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
  ground: string = FRAMES.light,
): string[] {
  const pale = (cell: string | undefined) =>
    cell !== undefined &&
    cell !== "." &&
    !BODY_ROLES.has(cell) &&
    palette[cell] !== undefined &&
    contrast(palette[cell], ground) < MIN_CONTRAST;
  return rows.map((row, y) =>
    [...row]
      .map((cell, x) =>
        cell === "." && NEIGHBOURS.some(([dx, dy]) => pale(rows[y + dy]?.[x + dx]))
          ? KEYLINE
          : cell,
      )
      .join(""),
  );
}
