import {
  cellShape,
  DARK_FIELD,
  FieldMotion,
  type FieldColors,
  type FieldFocus,
  type FieldLayout,
  LIGHT_FIELD,
  rgbCss,
  type Rgb,
} from "./kit";
import { useDiskTheme } from "../upstream/disk";
import { parseRgb } from "./rgb";

// The phone's field: the web's motion (`fieldMotion.ts`), drawn as one SVG path per colour, so
// hundreds of cells are a handful of shapes. A frame is asked for only while a cell moves.

/** A stepped shuffle reads the same at half the display's rate, for half the SVG's work. */
const FRAME_MS = 33;

export interface CellGroup {
  readonly key: string;
  readonly fill: string;
  readonly fillOpacity: number;
  readonly stroke: string | null;
  readonly d: string;
}

const rounded = (channel: number) => Math.round(channel / 24) * 24;

const at = (value: number) => (Math.round(value * 10) / 10).toString();

function roundedSquare(x: number, y: number, size: number, radius: number): string {
  const side = at(size - 2 * radius);
  const r = at(radius);
  return (
    `M${at(x + radius)} ${at(y)}h${side}a${r} ${r} 0 0 1 ${r} ${r}v${side}` +
    `a${r} ${r} 0 0 1 -${r} ${r}h-${side}a${r} ${r} 0 0 1 -${r} -${r}v-${side}` +
    `a${r} ${r} 0 0 1 ${r} -${r}z`
  );
}

export class FieldPicture {
  private frame = 0;
  private drawnAt = -Infinity;
  private readonly motion: FieldMotion;
  private focus: FieldFocus | null = null;
  private hollow: ReadonlySet<number> = new Set();
  private hollowTone: Rgb = [0, 0, 0];
  private warnCells = 0;
  private warnTone: Rgb = [0, 0, 0];

  constructor(
    reduced: boolean,
    private readonly show: (groups: ReadonlyArray<CellGroup>) => void,
  ) {
    this.motion = new FieldMotion(reduced);
  }

  dispose() {
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  update(input: {
    readonly layout: FieldLayout;
    readonly colors: FieldColors;
    readonly tone: Rgb;
    readonly entrance: boolean;
  }) {
    // A poll with the same figures draws nothing: hundreds of paths rebuilt for no change.
    if (this.motion.update(input, performance.now())) this.request();
  }

  setFocus(focus: FieldFocus | null) {
    if (focus?.band === this.focus?.band && focus?.item === this.focus?.item) return;
    this.focus = focus;
    this.motion.setFocus(focus);
    this.request();
  }

  setHollow(cells: ReadonlySet<number>, tone: Rgb) {
    const same =
      cells.size === this.hollow.size &&
      [...cells].every((cell) => this.hollow.has(cell)) &&
      (cells.size === 0 || String(tone) === String(this.hollowTone));
    if (same) return;
    this.hollow = cells;
    this.hollowTone = tone;
    this.motion.setHollow(cells, tone);
    this.request();
  }

  setWarn(cells: number, tone: Rgb) {
    if (cells === this.warnCells && (cells === 0 || String(tone) === String(this.warnTone))) return;
    this.warnCells = cells;
    this.warnTone = tone;
    this.motion.setWarn(cells, tone);
    this.request();
  }

  setPointer(pointer: { readonly col: number; readonly row: number } | null) {
    this.motion.setPointer(pointer);
    this.request();
  }

  cellAt(x: number, y: number) {
    return this.motion.cellAt(x, y);
  }

  private request() {
    if (this.frame === 0) this.frame = requestAnimationFrame(() => this.draw());
  }

  private draw() {
    this.frame = 0;
    // React Native's frame time isn't `performance.now()`'s clock, which `update` reads.
    const now = performance.now();
    if (now - this.drawnAt < FRAME_MS) {
      this.request();
      return;
    }
    this.drawnAt = now;
    const { motion } = this;
    const layout = motion.layout;
    if (layout === null) return;
    const { pitch } = layout;
    const { gap, size, radius } = cellShape(pitch);
    const hollowFill = rgbCss(motion.hollowTone);
    const hollowStroke = rgbCss(motion.hollowTone, 0.95);
    const warnStroke = rgbCss(motion.warnTone);
    const groups = new Map<
      string,
      { fill: string; fillOpacity: number; stroke: string | null; d: Array<string> }
    >();
    const busy = motion.frame(now, (look) => {
      const drawn = size * look.scale;
      const inset = (size - drawn) / 2;
      // A moving cell's colour is rounded, so a landing wave is tens of shapes, not hundreds.
      const fill = look.hollow
        ? hollowFill
        : rgbCss(
            look.moving
              ? [rounded(look.fill[0]), rounded(look.fill[1]), rounded(look.fill[2])]
              : look.fill,
          );
      const stroke = look.hollow ? hollowStroke : look.warned ? warnStroke : null;
      const key = `${look.hollow ? "hollow" : fill}|${stroke ?? ""}`;
      let group = groups.get(key);
      if (group === undefined) {
        group = { fill, fillOpacity: look.hollow ? 0.14 : 1, stroke, d: [] };
        groups.set(key, group);
      }
      group.d.push(
        roundedSquare(
          look.col * pitch + gap / 2 + inset,
          look.row * pitch + gap / 2 + inset,
          drawn,
          radius * look.scale,
        ),
      );
    });
    this.show(Array.from(groups, ([key, group]) => ({ key, ...group, d: group.d.join("") })));
    if (busy) this.request();
  }
}

/** A drive at rest, small: how full, in one grey and the headline's colour (a tile on the shelf). */
export function shelfGroups(
  layout: FieldLayout,
  colors: FieldColors,
  tone: Rgb,
): ReadonlyArray<CellGroup> {
  const gap = Math.max(1, layout.pitch * 0.18);
  const size = layout.pitch - gap;
  const radius = Math.min(1.5, size * 0.25);
  const used: Array<string> = [];
  const free: Array<string> = [];
  for (let cell = 0; cell < layout.cells; cell += 1) {
    const isFree = layout.bands[layout.bandOf[cell] ?? 0]?.kind === "free";
    (isFree ? free : used).push(
      roundedSquare(
        Math.floor(cell / layout.rows) * layout.pitch,
        (cell % layout.rows) * layout.pitch,
        size,
        radius,
      ),
    );
  }
  return [
    { key: "used", fill: rgbCss(colors.system[0]), fillOpacity: 1, stroke: null, d: used.join("") },
    { key: "free", fill: rgbCss(tone), fillOpacity: 1, stroke: null, d: free.join("") },
  ];
}

/** The web's `--success-foreground`: Tailwind's emerald 700 in light, 400 in dark. */
const CALM: Readonly<Record<"light" | "dark", Rgb>> = {
  light: [0, 122, 85],
  dark: [0, 212, 146],
};

function resolveFieldTheme(dark: boolean, warning: string | undefined, danger: string | undefined) {
  return {
    colors: dark ? DARK_FIELD : LIGHT_FIELD,
    tones: {
      calm: dark ? CALM.dark : CALM.light,
      soon: parseRgb(warning, [251, 191, 36]),
      now: parseRgb(danger, [248, 113, 113]),
    },
  };
}

const fieldThemes = new Map<string, ReturnType<typeof resolveFieldTheme>>();

/** One answer per theme: it stands behind every effect that hands the field new figures. */
function fieldThemeOf(dark: boolean, warning: string | undefined, danger: string | undefined) {
  const key = `${dark}|${warning}|${danger}`;
  const known = fieldThemes.get(key);
  if (known !== undefined) return known;
  const resolved = resolveFieldTheme(dark, warning, danger);
  fieldThemes.set(key, resolved);
  return resolved;
}

/** The field's colours and each status's, as the phone's theme draws them. */
export function useFieldTheme() {
  const { dark, warning, danger } = useDiskTheme();
  return fieldThemeOf(dark, warning, danger);
}
