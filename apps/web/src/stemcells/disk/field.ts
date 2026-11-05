// The drive as a field of Cells: one cell is a fixed slice of the disk, filled left to right, top
// to bottom, in bands (what's on it, biggest first, then what wasn't measured, then what's free).
// Pure, so what each cell stands for can be tested; `fieldPainter.ts` draws it.

export interface FieldItem {
  readonly name: string;
  readonly bytes: number;
  readonly path?: string;
}

export interface FieldBandInput {
  readonly id: string;
  /** A disk kind, `folder`, `system` (what wasn't measured), `counting` or `free`. */
  readonly kind: string;
  readonly title: string;
  readonly bytes: number;
  readonly items: ReadonlyArray<FieldItem>;
}

export interface FieldBand extends FieldBandInput {
  /** The index of its first cell. */
  readonly start: number;
  readonly count: number;
  /** Its place among bands of its `kind`: which colour a folder wears. */
  readonly rank: number;
}

export interface FieldLayout {
  readonly rows: number;
  readonly cols: number;
  /** Cell plus gap, in CSS pixels. */
  readonly pitch: number;
  readonly cells: number;
  /** What one cell holds. */
  readonly unit: number;
  readonly bands: ReadonlyArray<FieldBand>;
  /** Per cell: its band's index, and its item's in that band (`items.length` for the rest). */
  readonly bandOf: Uint16Array;
  readonly itemOf: Uint16Array;
}

const FIELD_MOST_CELLS = 600;
export const SHELF_MOST_CELLS = 200;

const UNITS_GB = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

/**
 * Splits `total` whole cells in proportion to `values`: every value keeps its floor, and the cells
 * left over go to the largest remainders, so the counts always add up to `total`.
 */
export function shareCells(values: ReadonlyArray<number>, total: number): Array<number> {
  const sum = values.reduce((all, value) => all + Math.max(0, value), 0);
  if (sum <= 0 || total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (Math.max(0, value) / sum) * total);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((all, count) => all + count, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (left <= 0) break;
    counts[index] = (counts[index] ?? 0) + 1;
    left -= 1;
  }
  return counts;
}

/**
 * A nice unit first, so a drive's cell count stays near `most` at any size; a tiny drive still gets
 * enough cells to read as a field. As many rows as fit: always the box's width, never past its
 * height, and a full rectangle.
 */
export function fieldGrid(
  total: number,
  box: { readonly width: number; readonly height: number },
  most: number,
) {
  const unitGb = UNITS_GB.find((gb) => total / (gb * 1e9) <= most) ?? UNITS_GB.at(-1) ?? 1;
  const wanted = Math.min(most, Math.max(most / 4, total / (unitGb * 1e9)));
  const colsFor = (rows: number) => Math.ceil(wanted / rows);
  let rows = 1;
  while (colsFor(rows) > 1 && (rows + 1) * (box.width / colsFor(rows + 1)) <= box.height) {
    rows += 1;
  }
  const cols = colsFor(rows);
  return { rows, cols, pitch: box.width / cols };
}

const FREE_KIND = "free";

/** Lays the bands into the grid; while any room is left, at least one cell stands free. */
export function fieldLayout(
  input: {
    readonly total: number;
    readonly bands: ReadonlyArray<FieldBandInput>;
  },
  box: { readonly width: number; readonly height: number },
  most: number = FIELD_MOST_CELLS,
): FieldLayout {
  const { rows, cols, pitch } = fieldGrid(input.total, box, most);
  const cells = rows * cols;
  // The free band always holds its true share: a measurement that outgrew the disk it measured (a
  // hard link counted twice, a walk older than the disk's figures) shrinks only the used bands.
  const free = input.bands.find((band) => band.kind === FREE_KIND)?.bytes ?? 0;
  const room = Math.max(0, input.total - free);
  const held = input.bands.reduce(
    (sum, band) => (band.kind === FREE_KIND ? sum : sum + band.bytes),
    0,
  );
  const scale = held > room ? room / held : 1;
  const counts = shareCells(
    input.bands.map((band) => (band.kind === FREE_KIND ? band.bytes : band.bytes * scale)),
    cells,
  );
  const freeIndex = input.bands.findIndex((band) => band.kind === FREE_KIND);
  if (freeIndex >= 0 && (input.bands[freeIndex]?.bytes ?? 0) > 0 && counts[freeIndex] === 0) {
    const largest = counts.indexOf(Math.max(...counts));
    if (largest >= 0) {
      counts[largest] = (counts[largest] ?? 0) - 1;
      counts[freeIndex] = 1;
    }
  }
  const bandOf = new Uint16Array(cells);
  const itemOf = new Uint16Array(cells);
  const ranks = new Map<string, number>();
  const bands: Array<FieldBand> = [];
  let start = 0;
  input.bands.forEach((band, bandIndex) => {
    const count = counts[bandIndex] ?? 0;
    const rank = ranks.get(band.kind) ?? 0;
    ranks.set(band.kind, rank + 1);
    bands.push({ ...band, start, count, rank });
    const itemBytes = band.items.reduce((sum, item) => sum + item.bytes, 0);
    const itemCounts = shareCells(
      [...band.items.map((item) => item.bytes), Math.max(0, band.bytes - itemBytes)],
      count,
    );
    let at = start;
    itemCounts.forEach((itemCount, itemIndex) => {
      for (let offset = 0; offset < itemCount && at < cells; offset += 1) {
        bandOf[at] = bandIndex;
        itemOf[at] = itemIndex;
        at += 1;
      }
    });
    start += count;
  });
  return { rows, cols, pitch, cells, unit: input.total / cells, bands, bandOf, itemOf };
}

/** Where a finding's bytes sit on the map, so "what could come back" can show them there. */
const FINDING_BANDS: Readonly<Record<string, string>> = {
  caches: "caches",
  temporary: "caches",
  buildData: "tools",
  simulators: "tools",
  deviceSupport: "tools",
  buildOutput: "code",
  dependencies: "code",
  worktrees: "code",
  trash: "trash",
  oldDownloads: "documents",
};

export interface FieldFinding {
  readonly kind: string;
  readonly bytes: number;
}

/**
 * The cells that would come back if `findings` went: taken from the end of each one's band, and
 * never more than the band holds, since a finding is a measurement of its own. They stand hollow.
 */
export function hollowCells(
  layout: FieldLayout,
  findings: ReadonlyArray<FieldFinding>,
): ReadonlySet<number> {
  const taken = new Map<number, number>();
  const hollow = new Set<number>();
  for (const finding of findings) {
    const kind = FINDING_BANDS[finding.kind];
    const index = layout.bands.findIndex((band) => band.kind === kind);
    const band = layout.bands[index];
    if (band === undefined) continue;
    const already = taken.get(index) ?? 0;
    const wanted = Math.max(1, Math.round(finding.bytes / layout.unit));
    const count = Math.min(wanted, band.count - already);
    for (let offset = 0; offset < count; offset += 1) {
      hollow.add(band.start + band.count - 1 - already - offset);
    }
    taken.set(index, already + count);
  }
  return hollow;
}

/** "1 GB": what a cell holds, said roundly, since a full rectangle bends the unit a little. */
export function roundUnit(unit: number): number {
  return Number(unit.toPrecision(1));
}

export interface FieldReading {
  readonly total: number;
  readonly free: number;
  readonly scanning: boolean;
  readonly counted: number;
  readonly buckets: ReadonlyArray<{
    readonly kind: string;
    readonly title: string;
    readonly bytes: number;
    readonly items: ReadonlyArray<FieldItem>;
  }> | null;
}

/**
 * The bands of a drive. Measured ones biggest first; `system` is always the used bytes the
 * measurement didn't reach, against the disk now. With no measurement yet, a walk's progress lights
 * the used cells as it counts them.
 */
export function fieldBands(reading: FieldReading): ReadonlyArray<FieldBandInput> {
  const used = Math.max(0, reading.total - reading.free);
  const free: FieldBandInput = {
    id: FREE_KIND,
    kind: FREE_KIND,
    title: "Free",
    bytes: reading.free,
    items: [],
  };
  if (reading.buckets === null) {
    const counted = reading.scanning ? Math.min(used, reading.counted) : 0;
    return [
      ...(counted > 0
        ? [{ id: "counting", kind: "counting", title: "Counted", bytes: counted, items: [] }]
        : []),
      { id: "system", kind: "system", title: "Used", bytes: used - counted, items: [] },
      free,
    ];
  }
  const measured = reading.buckets
    .filter((bucket) => bucket.kind !== "system" && bucket.kind !== FREE_KIND)
    .sort((a, b) => b.bytes - a.bytes);
  const known = measured.reduce((sum, bucket) => sum + bucket.bytes, 0);
  const system = reading.buckets.find((bucket) => bucket.kind === "system");
  return [
    ...measured.map((bucket, index) => ({
      id: `${bucket.kind}:${index}`,
      kind: bucket.kind,
      title: bucket.title,
      bytes: bucket.bytes,
      items: bucket.items,
    })),
    {
      id: "system",
      kind: "system",
      title: system?.title ?? "Used",
      bytes: Math.max(0, used - known),
      items: [],
    },
    free,
  ];
}
