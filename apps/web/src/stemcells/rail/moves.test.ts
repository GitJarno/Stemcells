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
  it("hops an answered Cell down to Working, and a settled one to Settled", () => {
    const before = standingsOf([at("waffle", "needs-you"), at("pancake", "done")], []);
    const after = standingsOf([at("waffle", "working")], [{ threadId: "pancake" }]);
    expect(hopsOf(before, after)).toEqual([
      { threadId: "waffle", from: "needs", to: "working" },
      { threadId: "pancake", from: "landed", to: "settled" },
    ]);
  });

  it("hops a settled Cell back up when it's written to", () => {
    const before = standingsOf([], [{ threadId: "waffle" }]);
    const after = standingsOf([at("waffle", "working")], []);
    expect(hopsOf(before, after)).toEqual([{ threadId: "waffle", from: "settled", to: "working" }]);
  });

  it("leaves a Cell that stays put, one that's new, and one that's gone", () => {
    const before = standingsOf([at("waffle", "working"), at("toast", "done")], []);
    const after = standingsOf([at("waffle", "working"), at("crumb", "working")], []);
    expect(hopsOf(before, after)).toEqual([]);
  });
});
