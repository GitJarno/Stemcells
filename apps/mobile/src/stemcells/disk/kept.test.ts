import { describe, expect, it } from "vite-plus/test";

import { keptDisks } from "./kept";

const low = { free: 2e9, total: 5e11 };

describe("a machine's kept disk figures", () => {
  it("show on a mount while its machine is still reading, until its next answer", () => {
    const shown = keptDisks();
    expect(shown("mac", undefined)).toBeUndefined();
    expect(shown("mac", low)).toEqual(low);
    expect(shown("mac", undefined)).toEqual(low);
    const lower = { free: 1e9, total: 5e11, warnBelow: 2e9 };
    expect(shown("mac", lower)).toEqual(lower);
    expect(shown("mac", undefined)).toEqual(lower);
  });

  it("give way to an answer without figures, and are one machine's only", () => {
    const shown = keptDisks();
    shown("mac", low);
    expect(shown("studio", undefined)).toBeUndefined();
    expect(shown("mac", null)).toBeNull();
    expect(shown("mac", undefined)).toBeNull();
  });
});
