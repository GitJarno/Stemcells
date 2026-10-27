import { describe, expect, it, vi } from "vite-plus/test";

import { parseColumnStage, parseColumnWidth, startingWidth } from "./column";

describe("the left column", () => {
  it("is the Cells' column unless the person chose the rail or upstream's list", () => {
    expect(parseColumnWidth(null)).toBe("cells");
    expect(parseColumnWidth("rail")).toBe("rail");
    expect(parseColumnWidth("list")).toBe("list");
    expect(parseColumnWidth("something else")).toBe("cells");
  });

  it("takes a column widened to upstream's list before as the Cells' column", () => {
    expect(parseColumnWidth("wide")).toBe("cells");
  });

  it("starts on the rail in a window torn off or opened beside the lead one", () => {
    expect(startingWidth("cells", false)).toBe("rail");
    expect(startingWidth("list", false)).toBe("rail");
    expect(startingWidth(null, false)).toBe("rail");
    expect(startingWidth("list", true)).toBe("list");
    expect(startingWidth(null, true)).toBe("cells");
  });

  it("in a window that doesn't lead, never changes the width the lead window remembers", async () => {
    const stored = new Map([["stemcells.leftColumn", "cells"]]);
    vi.stubGlobal("window", { stemcellsWindows: { boot: { lead: false } } });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    });
    vi.resetModules();
    try {
      const { useColumnStore } = await import("./column");
      expect(useColumnStore.getState().width).toBe("rail");
      useColumnStore.getState().setWidth("list");
      expect(useColumnStore.getState().width).toBe("list");
      expect(stored.get("stemcells.leftColumn")).toBe("cells");
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it("opens on what needs you unless the person opened another stage", () => {
    expect(parseColumnStage(null)).toBe("needs");
    expect(parseColumnStage("landed")).toBe("landed");
    expect(parseColumnStage("snoozed")).toBe("needs");
  });
});
