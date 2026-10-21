import { describe, expect, it } from "vite-plus/test";

import { EMPTY_NUMBERING, renumber, type Numbering } from "./numbers.ts";

const numbersOf = (numbering: Numbering) => Object.fromEntries(numbering.byKey);
const item = (key: string, since: number) => ({ key, since });

describe("card numbers, so 'for 2' lands on the same Cell however long the person spoke", () => {
  it("numbers arrivals in the order they arrived", () => {
    const numbering = renumber(EMPTY_NUMBERING, [
      item("pip", 30),
      item("floof", 10),
      item("bongo", 20),
    ]);
    expect(numbersOf(numbering)).toEqual({ floof: 1, bongo: 2, pip: 3 });
  });

  it("never moves a number when another card leaves, and never gives a gone one out again", () => {
    const first = renumber(EMPTY_NUMBERING, [
      item("floof", 10),
      item("bongo", 20),
      item("pip", 30),
    ]);
    const bongoAnswered = renumber(first, [item("floof", 10), item("pip", 30)]);
    expect(numbersOf(bongoAnswered)).toEqual({ floof: 1, pip: 3 });
    const otterArrives = renumber(bongoAnswered, [
      item("floof", 10),
      item("pip", 30),
      item("otter", 5),
    ]);
    expect(numbersOf(otterArrives)).toEqual({ floof: 1, pip: 3, otter: 4 });
  });

  it("starts again at 1 only once the list empties", () => {
    const first = renumber(EMPTY_NUMBERING, [item("floof", 10), item("bongo", 20)]);
    const cleared = renumber(first, []);
    expect(renumber(cleared, [item("pip", 30)]).byKey.get("pip")).toBe(1);
  });
});
