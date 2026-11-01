import { describe, expect, it, vi } from "vite-plus/test";

import { tabChoice } from "./state";

describe("tabChoice", () => {
  it("shows a tab chosen after a slide once it has slid, the last one chosen by then", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const tabs = tabChoice<"input" | "working" | "landed">();
      tabs.choose("landed");
      tabs.choose("working", 300);
      vi.advanceTimersByTime(200);
      expect(tabs.shown()).toBe("landed");
      tabs.choose("input", 300);
      vi.advanceTimersByTime(200);
      expect(tabs.shown()).toBe("landed");
      vi.advanceTimersByTime(100);
      expect(tabs.shown()).toBe("input");
      tabs.choose("working", 300);
      tabs.choose("input", 300);
      vi.runAllTimers();
      expect(tabs.shown()).toBe("input");
    } finally {
      vi.useRealTimers();
    }
  });
});
