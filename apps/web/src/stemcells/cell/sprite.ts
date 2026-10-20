// The Cell's art as grids of role letters ('.' clear), and the compositor
// that dresses a body: every layer stamped with its hotspot on one of the
// body's anchors, back to front by depth. A pose carries its anchors, so a
// hat rides the crown and a tool the hand however the body moves. Letters
// are roles, not colours: a palette paints them (`kit/palette.json`).

/** The named points a layer attaches to, measured on each frame of the body. */
export type Anchor =
  | "headTop"
  | "eyes"
  | "mouth"
  | "torso"
  | "handL"
  | "handR"
  | "hold"
  | "ground"
  | "back";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A piece of art on an anchor: `hotspot` lands on it, `z` orders it against the body (0). */
export interface Layer {
  readonly art: readonly string[];
  readonly attach: Anchor;
  readonly hotspot: Point;
  readonly z: number;
  /** The drawn miniature and its hotspot; without them the art is halved. */
  readonly mini?: readonly string[] | undefined;
  readonly miniHotspot?: Point | undefined;
  /** Worn on the body (a hat, a lens, a wrap): it follows a body drawn narrower than at rest. */
  readonly worn: boolean;
}

/** A body frame: its grid and the anchors measured on it. */
export interface Body {
  readonly rows: readonly string[];
  readonly anchors: Readonly<Partial<Record<Anchor, Point>>>;
  /** Lifted limbs drawn again in front of what the head wears; empty while they rest. */
  readonly front: readonly string[];
  /** The face and arms the rig drew, drawn again over a wrap; empty for a drawn body. */
  readonly features: readonly string[];
  /** How a body drawn narrower than at rest stands, for what it wears. */
  readonly narrowed?: Narrowed | undefined;
}

/** A narrower body's columns by grid row, against its half-widths at rest and the rows its anchors rest on. */
export interface Narrowed {
  readonly spans: ReadonlyMap<number, readonly [left: number, right: number]>;
  readonly rest: readonly number[];
  readonly heights: Readonly<Partial<Record<Anchor, number>>>;
}

/** Rounds half away from zero, as the original art's arithmetic does. */
export const round = (value: number): number => Math.sign(value) * Math.round(Math.abs(value));

const width = (rows: readonly string[]): number =>
  rows.reduce((most, row) => Math.max(most, row.length), 0);

const CLEAR = ".".charCodeAt(0);
const LETTERS = Array.from({ length: 128 }, (_, code) => String.fromCharCode(code));

/** A grid of role letters that clips what falls outside it. Roles are ASCII, held as bytes. */
export class Grid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height).fill(CLEAR);
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
      ? String.fromCharCode(this.cells[y * this.width + x]!)
      : ".";
  }
  put(x: number, y: number, role: string): void {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height)
      this.cells[y * this.width + x] = role.charCodeAt(0);
  }
  rows(): string[] {
    const out: string[] = [];
    for (let y = 0, i = 0; y < this.height; y++) {
      let row = "";
      for (let x = 0; x < this.width; x++, i++) row += LETTERS[this.cells[i]!];
      out.push(row);
    }
    return out;
  }
  /** This grid's cells where `marks` has one, clear elsewhere; nothing when nothing is marked. */
  marked(marks: Grid): string[] {
    const kept = new Grid(this.width, this.height);
    let any = false;
    for (let i = 0; i < marks.cells.length; i++) {
      if (marks.cells[i] === CLEAR) continue;
      kept.cells[i] = this.cells[i]!;
      any = true;
    }
    return any ? kept.rows() : [];
  }
  /** Stamps `art` with `hotspot` on `at`, its halves moved `apart` cells further apart, where `keep` allows. */
  stamp(
    art: readonly string[],
    hotspot: Point,
    at: Point,
    keep: (x: number, y: number) => boolean,
    apart = 0,
  ): void {
    const w = width(art);
    art.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const role = row[rx]!;
        if (role === ".") continue;
        const x = at.x - hotspot.x + rx + (rx < Math.trunc(w / 2) ? -apart : apart);
        const y = at.y - hotspot.y + ry;
        if (keep(x, y)) this.put(x, y, role);
      }
    });
  }
}

/** Where `anchor` stands on `body`; the grid's middle when it has none. */
export function anchorOf(body: Body, anchor: Anchor): Point {
  return (
    body.anchors[anchor] ?? {
      x: Math.trunc((body.rows[0]?.length ?? 0) / 2),
      y: Math.trunc(body.rows.length / 2),
    }
  );
}

/**
 * Where a worn cell lands on a narrower body: drawn for the body at rest at
 * column `x`, row `y`, of a piece on `anchor` (standing at `at`). Over the
 * body it narrows with it; past its edge it keeps its distance from the
 * edge, which came in. Rows past the body take its nearest.
 */
function place(narrowed: Narrowed, x: number, y: number, anchor: Anchor, at: Point): number {
  const height = narrowed.heights[anchor];
  const keys = [...narrowed.spans.keys()];
  if (height === undefined || narrowed.rest.length === 0 || keys.length === 0) return x;
  const span = narrowed.spans.get(Math.min(Math.max(y, Math.min(...keys)), Math.max(...keys)));
  if (span === undefined) return x;
  const was =
    narrowed.rest[Math.min(Math.max(height + at.y - y, 0), narrowed.rest.length - 1)] ?? 0;
  const [left, right] = span;
  const centre = (left + right + 1) / 2;
  const half = Math.min((right - left + 1) / 2, was);
  const d = x + 0.5 - centre;
  const moved = Math.abs(d) <= was ? (d * half) / was : d + (d < 0 ? 1 : -1) * (was - half);
  return round(centre + moved - 0.5);
}

/** Halves a grid: each 2 × 2 block keeps its most telling cell (a face or prop over the body, the body over nothing). */
function downscale2(rows: readonly string[]): string[] {
  const salience = (cell: string) => (cell === "." ? 0 : "BbLO".includes(cell) ? 1 : 2);
  const out: string[] = [];
  const w = rows[0]?.length ?? 0;
  for (let y = 0; y + 1 < rows.length; y += 2) {
    let line = "";
    for (let x = 0; x + 1 < w; x += 2) {
      const quad = [rows[y]![x]!, rows[y]![x + 1]!, rows[y + 1]![x]!, rows[y + 1]![x + 1]!];
      line += quad.reduce((best, cell) => (salience(cell) > salience(best) ? cell : best));
    }
    out.push(line);
  }
  return out;
}

/** `w` × `h` cells of a grid from (`x`, `y`), clear past its edges. */
export function crop(
  rows: readonly string[],
  x: number,
  y: number,
  w: number,
  h: number,
): string[] {
  return Array.from({ length: h }, (_, r) => {
    const row = rows[y + r] ?? "";
    let line = "";
    for (let c = 0; c < w; c++) line += row[x + c] ?? ".";
    return line;
  });
}

/** A layer as the miniature draws it: its drawn miniature, or its art halved with nothing at its edges dropped. */
export function miniOf(layer: Layer): Layer {
  let art = layer.mini;
  if (art === undefined) {
    const w = Math.trunc((width(layer.art) + 1) / 2) * 2;
    const padded = layer.art.map((row) => row.padEnd(w, "."));
    if (padded.length % 2 !== 0) padded.push(".".repeat(w));
    art = downscale2(padded);
  }
  const hotspot = layer.miniHotspot ?? {
    x: Math.floor(layer.hotspot.x / 2),
    y: Math.floor(layer.hotspot.y / 2),
  };
  return { art, attach: layer.attach, hotspot, z: layer.z, worn: layer.worn };
}

/**
 * Stamps `layers` on `body`, back to front: by depth (the body at 0, its
 * features at 2, lifted limbs at 4), then in the order given. A layer's
 * cells overwrite what is under them; what falls off the grid is clipped.
 */
export function compose(body: Body, layers: readonly Layer[]): string[] {
  const h = body.rows.length;
  const w = body.rows[0]?.length ?? 0;
  if (w === 0 || h === 0) return [...body.rows];
  interface Op {
    readonly z: number;
    readonly seq: number;
    readonly art: readonly string[];
    readonly ox: number;
    readonly oy: number;
    readonly layer?: Layer;
    readonly at?: Point;
  }
  const ops: Op[] = [{ z: 0, seq: -1, art: body.rows, ox: 0, oy: 0 }];
  if (body.front.length > 0) ops.push({ z: 4, seq: -1, art: body.front, ox: 0, oy: 0 });
  if (body.features.length > 0) ops.push({ z: 2, seq: -1, art: body.features, ox: 0, oy: 0 });
  layers.forEach((layer, seq) => {
    const at = anchorOf(body, layer.attach);
    ops.push({
      z: layer.z,
      seq,
      art: layer.art,
      ox: at.x - layer.hotspot.x,
      oy: at.y - layer.hotspot.y,
      layer,
      at,
    });
  });
  ops.sort((a, b) => a.z - b.z || a.seq - b.seq);
  const grid = new Grid(w, h);
  for (const op of ops) {
    const narrowed = op.layer?.worn ? body.narrowed : undefined;
    op.art.forEach((row, ry) => {
      const cy = op.oy + ry;
      if (cy < 0 || cy >= h) return;
      for (let rx = 0; rx < row.length; rx++) {
        const cell = row.charCodeAt(rx);
        if (cell === CLEAR) continue;
        const cx =
          narrowed !== undefined && op.layer !== undefined && op.at !== undefined
            ? place(narrowed, op.ox + rx, cy, op.layer.attach, op.at)
            : op.ox + rx;
        if (cx >= 0 && cx < w) grid.cells[cy * w + cx] = cell;
      }
    });
  }
  return grid.rows();
}
