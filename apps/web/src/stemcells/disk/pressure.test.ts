import { describe, expect, it } from "vite-plus/test";

import { diskPressure, FOOT_TONE, freeFigure, NOW_BELOW, SOON_BELOW } from "./pressure";

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

  it("colours the foot green, then yellow, then red", () => {
    expect(FOOT_TONE[diskPressure(48 * GB)]).toBe("text-success-foreground");
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
