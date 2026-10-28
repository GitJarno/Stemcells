import { describe, expect, it } from "vite-plus/test";

import {
  diskFailure,
  diskPressure,
  lastDiskFailure,
  FOOT_TONE,
  freeFigure,
  FULL_BELOW,
  NOW_BELOW,
  SOON_BELOW,
} from "./pressure";

const GB = 1e9;

describe("the disk's pressure from its free space", () => {
  it("is calm from 20 GB free, soon below it, now below 10 GB", () => {
    expect(diskPressure(500 * GB)).toBe("calm");
    expect(diskPressure(SOON_BELOW)).toBe("calm");
    expect(diskPressure(SOON_BELOW - 1)).toBe("soon");
    expect(diskPressure(NOW_BELOW)).toBe("soon");
    expect(diskPressure(NOW_BELOW - 1)).toBe("now");
    expect(diskPressure(0)).toBe("now");
  });

  it("keeps the foot quiet while there is room, then amber, then red", () => {
    expect(FOOT_TONE[diskPressure(48 * GB)]).toBe("");
    expect(FOOT_TONE[diskPressure(15 * GB)]).toBe("text-warning-foreground");
    expect(FOOT_TONE[diskPressure(4 * GB)]).toBe("text-error-foreground");
  });
});

describe("the foot's figure", () => {
  it("says whole gigabytes, a decimal only under one", () => {
    expect(freeFigure(48.4 * GB)).toBe("48 GB");
    expect(freeFigure(8.6 * GB)).toBe("9 GB");
    expect(freeFigure(1234 * GB)).toBe("1234 GB");
    expect(freeFigure(0.94 * GB)).toBe("0.9 GB");
    expect(freeFigure(0.05 * GB)).toBe("<0.1 GB");
    expect(freeFigure(0)).toBe("0 GB");
  });
});

describe("a failed turn and the disk", () => {
  it("is the disk's while under 2 GB are free, and stays so once there's room again", () => {
    expect(diskFailure("turn-a", FULL_BELOW - 1)).toBe("full");
    expect(diskFailure("turn-a", 0)).toBe("full");
    expect(diskFailure("turn-a", 40 * GB)).toBe("freed");
  });

  it("is never the disk's when it was never seen full", () => {
    expect(diskFailure("turn-b", FULL_BELOW)).toBeNull();
    expect(diskFailure("turn-b", 3 * GB)).toBeNull();
  });

  // Aski's composer reads the cards outside React: "as recommended" must not
  // retry a Cell its card says the full disk stopped.
  it("is read again as the card last said it", () => {
    expect(lastDiskFailure("turn-c")).toBeNull();
    diskFailure("turn-c", 0);
    expect(lastDiskFailure("turn-c")).toBe("full");
    diskFailure("turn-c", 40 * GB);
    expect(lastDiskFailure("turn-c")).toBe("freed");
  });
});
