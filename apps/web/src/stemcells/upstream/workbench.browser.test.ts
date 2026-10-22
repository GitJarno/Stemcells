import { describe, expect, it } from "vite-plus/test";

import { escapeHeldElsewhere } from "./workbench";

/** An element on the page for the test's length, gone once it ends. */
function onPage(attributes: Record<string, string>): HTMLElement & Disposable {
  const element = document.createElement("div");
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return Object.assign(element, { [Symbol.dispose]: () => element.remove() });
}

describe("what holds Esc in Look", () => {
  it("a popover kept mounted while closed doesn't; an open one does", () => {
    // The Cell's line keeps its "where it runs" popover mounted (`LineEnv`).
    using popover = onPage({ "data-slot": "popover-popup", "data-closed": "" });
    expect(escapeHeldElsewhere()).toBe(false);

    popover.removeAttribute("data-closed");
    popover.setAttribute("data-open", "");
    expect(escapeHeldElsewhere()).toBe(true);
  });

  it("the right panel's sheet holds it only while open", () => {
    using sheet = onPage({ "data-slot": "sheet-popup", "data-closed": "" });
    expect(escapeHeldElsewhere()).toBe(false);

    sheet.setAttribute("data-open", "");
    expect(escapeHeldElsewhere()).toBe(true);
  });

  it("a chat's find bar holds it while it's on the page", () => {
    using _findBar = onPage({ "data-thread-find-bar": "" });
    expect(escapeHeldElsewhere()).toBe(true);
  });
});
