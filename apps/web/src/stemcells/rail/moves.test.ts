import { describe, expect, it } from "vite-plus/test";

import type { CellStanding } from "../needs/wire";
import { hopsOf, standingsOf } from "./moves";

const at = (threadId: string, stage: CellStanding["stage"]): CellStanding => ({
  threadId,
  projectId: "project-shop",
  title: threadId,
  stage,
  line: "",
  createdAt: "2026-10-26T10:00:00.000Z",
});

describe("the hops along the column's line", () => {
  it("hops an answered Cell into Awake, and a slept one into Asleep", () => {
    const before = standingsOf([at("waffle", "needs-you"), at("pancake", "done")], []);
    const after = standingsOf([at("waffle", "working")], [{ threadId: "pancake" }]);
    expect(hopsOf(before, after, () => true)).toEqual([
      { threadId: "waffle", from: "needs", to: "awake" },
      { threadId: "pancake", from: "awake", to: "asleep" },
    ]);
    // A move the person didn't make only changes the counts.
    expect(hopsOf(before, after, (threadId) => threadId === "pancake")).toEqual([
      { threadId: "pancake", from: "awake", to: "asleep" },
    ]);
  });

  it("hops an asleep Cell back up when it's woken or written to", () => {
    const before = standingsOf([], [{ threadId: "waffle" }]);
    const after = standingsOf([at("waffle", "working")], []);
    expect(hopsOf(before, after, () => true)).toEqual([
      { threadId: "waffle", from: "asleep", to: "awake" },
    ]);
  });

  it("leaves a Cell that lands, one that's new, and one that's gone", () => {
    const before = standingsOf([at("waffle", "working"), at("toast", "done")], []);
    const after = standingsOf([at("waffle", "done"), at("crumb", "working")], []);
    expect(hopsOf(before, after, () => true)).toEqual([]);
  });
});
