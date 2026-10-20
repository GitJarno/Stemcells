import { describe, expect, it } from "vite-plus/test";

import { UNTITLED_THREAD } from "../upstream/titles";
import { oneLinerOf } from "./oneLiner";

const names = ["Harbor", "Falcon"];

describe("the one-liner over a Cell's composer", () => {
  it("is the thread's title as upstream wrote it", () => {
    expect(oneLinerOf("Tab-based workspace on the fork", names)).toBe(
      "Tab-based workspace on the fork",
    );
    expect(oneLinerOf("  Composer line spacing ", names)).toBe("Composer line spacing");
  });

  it("is none before the chat has a title, or while upstream has nothing to name it by", () => {
    expect(oneLinerOf(null, names)).toBeNull();
    expect(oneLinerOf("   ", names)).toBeNull();
    expect(oneLinerOf(UNTITLED_THREAD, names)).toBeNull();
  });

  it("is none when the title only repeats the names beside it, in any order or case", () => {
    expect(oneLinerOf("harbor", names)).toBeNull();
    expect(oneLinerOf("Falcon", names)).toBeNull();
    expect(oneLinerOf("Harbor - Falcon", names)).toBeNull();
    expect(oneLinerOf("falcon: HARBOR", names)).toBeNull();
    expect(oneLinerOf("Harbor app", ["Harbor app", "Falcon"])).toBeNull();
  });

  it("keeps a title that says more than the names", () => {
    expect(oneLinerOf("Harbor checkout fixes", names)).toBe("Harbor checkout fixes");
    expect(oneLinerOf("Falcon 9 telemetry", names)).toBe("Falcon 9 telemetry");
    expect(oneLinerOf("Harbor", [])).toBe("Harbor");
  });
});
