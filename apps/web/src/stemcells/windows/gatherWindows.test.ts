import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { carryStarts } from "./carrying";
import { gatherOrPutBack } from "./gatherWindows";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pressing Gather", () => {
  it("does nothing while a carry is in the hand, or another press is on its way", async () => {
    const snapshot = vi.fn(() => new Promise<never>(() => undefined));
    vi.stubGlobal("window", {
      dispatchEvent: () => true,
      stemcellsWindows: { boot: { id: "a" }, snapshot },
    });
    const carried = carryStarts();
    expect(await gatherOrPutBack()).toBe(false);
    expect(snapshot).not.toHaveBeenCalled();
    carried();

    // A press that hasn't landed yet: the windows it reads never answer here.
    void gatherOrPutBack();
    expect(await gatherOrPutBack()).toBe(false);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});
