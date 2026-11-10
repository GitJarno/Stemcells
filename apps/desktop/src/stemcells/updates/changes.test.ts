import { describe, expect, it } from "vite-plus/test";

import { buildPercentOf, readChanges } from "./changes.ts";

describe("an update's changes", () => {
  it("reads each squashed pull request's title and number, a sync of T3's work, and a plain commit", () => {
    const log = [
      "20261023\t⌘W in Aski's tab no longer closes the window: Aski says it stays, in a toast (#260)",
      "20261023\tMerge pull request #217 from owner/sync/upstream-3b95e7831",
      "20261022\tMerge pull request #12 from someone/their-branch",
      "20261022\tA commit pushed straight to main",
      "",
    ].join("\n");

    expect(readChanges(log)).toEqual([
      {
        title: "⌘W in Aski's tab no longer closes the window: Aski says it stays, in a toast",
        number: 260,
        day: "20261023",
      },
      { title: "T3's latest work", number: 217, day: "20261023" },
      { title: "their-branch", number: 12, day: "20261022" },
      { title: "A commit pushed straight to main", number: null, day: "20261022" },
    ]);
  });
});

describe("a build's progress", () => {
  it("only moves forward, through the steps install-app prints, to done", () => {
    const lines = [
      "==> Installing dependencies",
      "Progress: resolved 28, reused 25",
      "==> Building Stemcells 0.1.1-nightly.20261023.7268 for arm64 (a few minutes)",
      "[desktop-artifact] Building desktop/server/web artifacts...",
      "vite v8.0.0 building client environment for production...",
      "[desktop-artifact] Staging release app...",
      "[desktop-artifact] Building mac/dmg (arch=arm64, version=0.1.1-nightly.20261023.7268)...",
      "    '/repo/release/Stemcells-0.1.1-nightly.20261023.7268-arm64.zip',",
      "Stemcells is built at /tmp/stage/Stemcells.app.",
    ];
    const seen: number[] = [];
    for (const line of lines) seen.push(buildPercentOf(line, seen.at(-1) ?? 0));

    expect(seen).toEqual([5, 5, 10, 15, 15, 45, 55, 92, 100]);
  });
});
