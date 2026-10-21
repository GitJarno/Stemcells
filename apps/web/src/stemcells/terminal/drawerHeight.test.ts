/**
 * The terminal drawer opens at about ten rows (it opened at 280px, a third
 * of a pane and half of a short one), within 30% of the pane, at least six.
 */
import { describe, expect, it } from "vite-plus/test";

import { defaultDrawerHeight } from "./drawerHeight";

const chrome = 41;
const rowHeight = 18;

describe("the terminal drawer's opening height", () => {
  it("holds ten rows in a tall pane", () => {
    expect(defaultDrawerHeight({ rowHeight, chrome, paneHeight: 856 })).toBe(chrome + 10 * 18);
  });

  it("takes no more than 30% of a pane too short for ten rows", () => {
    expect(defaultDrawerHeight({ rowHeight, chrome, paneHeight: 600 })).toBe(180);
  });

  it("keeps six rows however short the pane", () => {
    expect(defaultDrawerHeight({ rowHeight, chrome, paneHeight: 300 })).toBe(chrome + 6 * 18);
  });

  it("follows the terminal's font", () => {
    expect(defaultDrawerHeight({ rowHeight: 24, chrome, paneHeight: 2000 })).toBe(chrome + 240);
  });

  it("holds ten rows outside a pane", () => {
    expect(defaultDrawerHeight({ rowHeight, chrome, paneHeight: null })).toBe(chrome + 180);
  });
});
