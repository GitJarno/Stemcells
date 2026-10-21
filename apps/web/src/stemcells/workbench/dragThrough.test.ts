import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

class ElementStub {
  constructor(private readonly separator: boolean) {}
  closest(): unknown {
    return this.separator ? {} : null;
  }
}

let listeners: Map<string, (event: unknown) => void>;
let marked: boolean[];

beforeEach(() => {
  vi.resetModules();
  listeners = new Map();
  marked = [];
  vi.stubGlobal("Element", ElementStub);
  vi.stubGlobal("document", {
    addEventListener: (type: string, listener: (event: unknown) => void) =>
      listeners.set(type, listener),
    documentElement: { toggleAttribute: (_: string, on: boolean) => marked.push(on) },
  });
});

const over = (separator: boolean) => ({ type: "pointerover", target: new ElementStub(separator) });

describe("a drag reaches the app wherever its pointer goes", () => {
  it("lets the pointer through the browser from the moment it is over a separator", async () => {
    // The workbench's edge dragged toward the browser stopped as the pointer crossed it.
    const { letDragsThrough } = await import("./dragThrough");
    letDragsThrough();
    listeners.get("pointerover")!(over(true));
    expect(marked.at(-1)).toBe(true);
    listeners.get("pointerover")!(over(false));
    expect(marked.at(-1)).toBe(false);
  });

  it("keeps letting it through while the drag holds the pointer, wherever it goes", async () => {
    const { letDragsThrough } = await import("./dragThrough");
    letDragsThrough();
    listeners.get("pointerover")!(over(true));
    listeners.get("gotpointercapture")!({ type: "gotpointercapture", pointerId: 1 });
    listeners.get("pointerover")!(over(false));
    expect(marked.at(-1)).toBe(true);
    listeners.get("lostpointercapture")!({ type: "lostpointercapture", pointerId: 1 });
    expect(marked.at(-1)).toBe(false);
  });
});
