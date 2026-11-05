import { describe, expect, it } from "vite-plus/test";

import { fieldBands, fieldLayout } from "./field";
import { DARK_FIELD, type Rgb } from "./fieldColors";
import { cellColor, FieldMotion } from "./fieldMotion";

const GB = 1e9;
const TONE: Rgb = [16, 185, 129];
const layout = fieldLayout(
  {
    total: 494 * GB,
    bands: fieldBands({
      total: 494 * GB,
      free: 47 * GB,
      scanning: false,
      counted: 0,
      buckets: [
        { kind: "code", title: "Code", bytes: 63 * GB, items: [{ name: "site", bytes: 9 * GB }] },
        { kind: "caches", title: "Caches", bytes: 16 * GB, items: [] },
      ],
    }),
  },
  { width: 640, height: 172 },
);

const fills = (motion: FieldMotion, now: number) => {
  const seen: Array<Rgb> = [];
  const busy = motion.frame(now, (look) => seen.push(look.fill));
  return { busy, seen };
};
const targets = Array.from({ length: layout.cells }, (_, cell) =>
  cellColor(DARK_FIELD, TONE, layout, cell),
);

describe("FieldMotion", () => {
  it("lands every cell in one wave, then wants no frame", () => {
    const motion = new FieldMotion(false);
    motion.update({ layout, colors: DARK_FIELD, tone: TONE, entrance: true }, 0);
    const start = fills(motion, 0);
    expect(start.busy).toBe(true);
    expect(new Set(start.seen.map(String))).toEqual(new Set([String(DARK_FIELD.socket)]));
    expect(fills(motion, 3_000).busy).toBe(true);
    const rested = fills(motion, 3_016);
    expect(rested.busy).toBe(false);
    expect(rested.seen).toEqual(targets);
  });

  it("stands at once with reduced motion, and only a real change lands, only its own cells", () => {
    const motion = new FieldMotion(true);
    motion.update({ layout, colors: DARK_FIELD, tone: TONE, entrance: true }, 0);
    expect(fills(motion, 0)).toEqual({ busy: false, seen: targets });

    const moving = new FieldMotion(false);
    moving.update({ layout, colors: DARK_FIELD, tone: TONE, entrance: true }, 0);
    fills(moving, 3_000);
    expect(moving.update({ layout, colors: DARK_FIELD, tone: TONE, entrance: false }, 3_500)).toBe(
      false,
    );
    expect(fills(moving, 3_500).busy).toBe(false);
    expect(
      moving.update({ layout, colors: DARK_FIELD, tone: [251, 191, 36], entrance: false }, 4_000),
    ).toBe(true);
    const changing = fills(moving, 4_000);
    expect(changing.busy).toBe(true);
    const free = layout.bands.findIndex((band) => band.kind === "free");
    changing.seen.forEach((fill, cell) => {
      if (layout.bandOf[cell] !== free) expect(fill).toEqual(targets[cell]);
    });
  });
});
