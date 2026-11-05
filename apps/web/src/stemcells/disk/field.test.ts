import { describe, expect, it } from "vite-plus/test";

import { fieldBands, fieldGrid, fieldLayout, hollowCells, roundUnit, shareCells } from "./field";

const BOX = { width: 640, height: 172 };
const GB = 1e9;

const reading = {
  total: 494 * GB,
  free: 47 * GB,
  scanning: false,
  counted: 0,
  buckets: [
    { kind: "caches", title: "Caches", bytes: 16 * GB, items: [] },
    {
      kind: "code",
      title: "Code",
      bytes: 63 * GB,
      items: [
        { name: "storefront", bytes: 25 * GB },
        { name: "site", bytes: 9 * GB },
      ],
    },
    { kind: "system", title: "macOS & other", bytes: 368 * GB, items: [] },
    { kind: "free", title: "Free", bytes: 47 * GB, items: [] },
  ],
};

describe("shareCells", () => {
  it.each([
    [[1, 1, 1], 10],
    [[63, 40, 30, 30, 16, 268, 47], 495],
    [[1e12, 1, 1], 400],
    [[0, 5], 7],
  ])("hands out exactly the cells there are: %j over %i", (values, total) => {
    expect(shareCells(values, total).reduce((all, count) => all + count, 0)).toBe(total);
  });

  it("hands out nothing when there's nothing to split", () => {
    expect(shareCells([0, 0], 8)).toEqual([0, 0]);
  });
});

describe("fieldLayout", () => {
  it.each([
    ["a half-gigabyte stick", 0.5 * GB],
    ["an 8 GB stick", 8 * GB],
    ["a phone's 64 GB", 64 * GB],
    ["this Mac's 494 GB", 494 * GB],
    ["a 1 TB drive", 1e12],
    ["a 4 TB drive", 4e12],
    ["a 22 TB array", 22e12],
  ])("draws %s as a full rectangle near the box, at a nice unit", (_name, total) => {
    const { rows, cols, pitch } = fieldGrid(total, BOX, 600);
    expect(rows * cols).toBeGreaterThanOrEqual(150);
    expect(rows * cols).toBeLessThanOrEqual(700);
    expect(rows * pitch).toBeLessThanOrEqual(BOX.height);
    expect(cols * pitch).toBeCloseTo(BOX.width);
  });

  it.each([
    ["a stick", 0.5 * GB],
    ["a 4 TB drive", 4e12],
  ])("keeps %s inside a shelf tile's box, however narrow", (_name, total) => {
    for (const width of [70, 120, 300]) {
      const { rows, pitch } = fieldGrid(total, { width, height: 24 }, 200);
      expect(rows * pitch).toBeLessThanOrEqual(24);
    }
  });

  it("gives every cell one band, in order, and each band its items' cells", () => {
    const layout = fieldLayout({ total: reading.total, bands: fieldBands(reading) }, BOX);
    expect(layout.bands.map((band) => band.kind)).toEqual(["code", "caches", "system", "free"]);
    expect(layout.bands.reduce((sum, band) => sum + band.count, 0)).toBe(layout.cells);
    for (const [index, band] of layout.bands.entries()) {
      for (let cell = band.start; cell < band.start + band.count; cell += 1) {
        expect(layout.bandOf[cell]).toBe(index);
      }
    }
    const code = layout.bands[0]!;
    const inFirstItem = Array.from(layout.itemOf.slice(code.start, code.start + code.count)).filter(
      (item) => item === 0,
    ).length;
    expect(inFirstItem).toBeCloseTo(25, -1);
  });

  it("keeps one cell lit for the last of the room, however small", () => {
    const layout = fieldLayout(
      {
        total: 4e12,
        bands: fieldBands({ ...reading, total: 4e12, free: 0.3 * GB, buckets: null }),
      },
      BOX,
    );
    expect(layout.bands.at(-1)?.count).toBe(1);
  });

  it("says nothing is free when nothing is", () => {
    const layout = fieldLayout(
      { total: 494 * GB, bands: fieldBands({ ...reading, free: 0, buckets: null }) },
      BOX,
    );
    expect(layout.bands.at(-1)?.count).toBe(0);
  });

  it("stays whole when a measurement outgrew the disk it measured", () => {
    const layout = fieldLayout(
      {
        total: 100 * GB,
        bands: fieldBands({
          ...reading,
          total: 100 * GB,
          free: 10 * GB,
          buckets: [{ kind: "code", title: "Code", bytes: 500 * GB, items: [] }],
        }),
      },
      BOX,
    );
    expect(layout.bands.reduce((sum, band) => sum + band.count, 0)).toBe(layout.cells);
    expect(layout.bands.find((band) => band.kind === "system")?.bytes).toBe(0);
    expect(layout.bands.at(-1)!.count / layout.cells).toBeCloseTo(0.1, 1);
    expect(layout.bands[0]!.bytes).toBe(500 * GB);
  });
});

describe("fieldBands", () => {
  it("counts what isn't measured against the disk now, not the walk's figure", () => {
    const bands = fieldBands({ ...reading, free: 40 * GB });
    expect(bands.find((band) => band.kind === "system")?.bytes).toBe((494 - 40 - 79) * GB);
  });

  it("lights the used cells as a first walk counts them", () => {
    const bands = fieldBands({ ...reading, buckets: null, scanning: true, counted: 66 * GB });
    expect(bands.map((band) => [band.kind, band.bytes / GB])).toEqual([
      ["counting", 66],
      ["system", 381],
      ["free", 47],
    ]);
  });
});

describe("hollowCells", () => {
  const layout = fieldLayout({ total: reading.total, bands: fieldBands(reading) }, BOX);

  it("takes a finding's cells from the end of its band", () => {
    const caches = layout.bands.find((band) => band.kind === "caches")!;
    const hollow = hollowCells(layout, [{ kind: "caches", bytes: 3 * layout.unit }]);
    expect([...hollow].sort((a, b) => a - b)).toEqual([
      caches.start + caches.count - 3,
      caches.start + caches.count - 2,
      caches.start + caches.count - 1,
    ]);
  });

  it("stacks findings in one band and never leaves that band", () => {
    const code = layout.bands.find((band) => band.kind === "code")!;
    const hollow = hollowCells(layout, [
      { kind: "buildOutput", bytes: 500 * GB },
      { kind: "worktrees", bytes: 500 * GB },
    ]);
    expect(hollow.size).toBe(code.count);
    for (const cell of hollow) expect(layout.bandOf[cell]).toBe(0);
  });

  it("shows nothing for a finding with no band on this map", () => {
    expect(hollowCells(layout, [{ kind: "trash", bytes: 3 * GB }]).size).toBe(0);
  });
});

it("rounds what a cell holds to something a person would say", () => {
  expect(roundUnit(0.998 * GB)).toBe(1 * GB);
  expect(roundUnit(1.96 * GB)).toBe(2 * GB);
});
