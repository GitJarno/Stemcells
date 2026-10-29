import { describe, expect, it } from "vite-plus/test";

import { normalizeDesktopUpdateReleaseNotes } from "../../updates/releaseNotes.ts";
import { resolveDefaultDesktopUpdateChannel } from "../../updates/updateChannels.ts";
import { buildPercentOf, nightlyNotesOf, nightlyVersionOf, readChanges } from "./changes.ts";

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

  it("makes each day's merges a nightly, as upstream's notes show T3's", () => {
    // Ten merged on the 23rd, two on the 22nd: commits 7268 back to 7257.
    const changes = [
      ...Array.from({ length: 10 }, (_, index) => ({
        title: `Today ${index}`,
        number: 300 - index,
        day: "20261023",
      })),
      { title: "Yesterday", number: 200, day: "20261022" },
      { title: "Yesterday too", number: 199, day: "20261022" },
    ];
    const tip = nightlyVersionOf({ base: "0.1.1", day: "20261023", count: 7268 });
    const { releaseNotes } = normalizeDesktopUpdateReleaseNotes(
      nightlyNotesOf(changes, { base: "0.1.1", count: 7268 }),
      tip,
      "nightly",
    );

    expect(releaseNotes.map((note) => [note.version, note.totalItems])).toEqual([
      [tip, 10],
      ["0.1.1-nightly.20261022.7258", 2],
    ]);
    // Upstream lists a nightly's 8 newest, and links the rest.
    expect(releaseNotes[0]?.items).toHaveLength(8);
    expect(releaseNotes[0]?.items[0]).toBe("Today 0 (#300)");
    expect(releaseNotes[1]?.items).toEqual(["Yesterday (#200)", "Yesterday too (#199)"]);
  });

  it("files a main build under upstream's Nightly, and a release under its Stable", () => {
    expect(
      resolveDefaultDesktopUpdateChannel(
        nightlyVersionOf({ base: "0.1.1", day: "20261023", count: 7268 }),
      ),
    ).toBe("nightly");
    expect(resolveDefaultDesktopUpdateChannel("0.2.0")).toBe("latest");
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
