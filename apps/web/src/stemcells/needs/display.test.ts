import { describe, expect, it } from "vite-plus/test";

import { clearedLine, nextEpisode, nextShown, type Shown } from "./display";
import { needFixture } from "./fixtures";

const FOLD = 240;
const floof = needFixture({ key: "floof", number: 1 });
const bongo = needFixture({ key: "bongo", number: 2, threadId: "thread-bongo" });
const pip = needFixture({ key: "pip", number: 3, threadId: "thread-pip" });
const keys = (shown: ReadonlyArray<Shown>) =>
  shown.map((each) => `${each.need.key}${each.goneAt === null ? "" : " (gone)"}`);

describe("the cards on the page", () => {
  it("adds new cards at the bottom and never re-sorts", () => {
    const first = nextShown([], [bongo, floof], { now: 0, linger: FOLD });
    expect(keys(first)).toEqual(["floof", "bongo"]);
    const reset = needFixture({ key: "otter", number: 1, threadId: "thread-otter" });
    const later = nextShown(first, [reset, bongo, floof], { now: 0, linger: FOLD });
    expect(keys(later)).toEqual(["floof", "bongo", "otter"]);
  });

  // The person: an answered card "stays there for a duration that feels random". It used to
  // stay greyed for as long as the pointer was over the list.
  it("keeps a gone card only while it folds, then lets it go", () => {
    const shown = nextShown([], [floof, bongo, pip], { now: 0, linger: FOLD });
    const gone = nextShown(shown, [floof, pip], { now: 100, linger: FOLD });
    expect(keys(gone)).toEqual(["floof", "bongo (gone)", "pip"]);
    expect(keys(nextShown(gone, [floof, pip], { now: 100 + FOLD - 1, linger: FOLD }))).toEqual([
      "floof",
      "bongo (gone)",
      "pip",
    ]);
    expect(keys(nextShown(gone, [floof, pip], { now: 100 + FOLD, linger: FOLD }))).toEqual([
      "floof",
      "pip",
    ]);
  });
});

describe("the line the column leaves when all is clear", () => {
  it("counts the needs since this page first saw one, and how long they took", () => {
    let state = nextEpisode(null, [floof], 1_000);
    state = nextEpisode(state.episode, [floof, bongo], 30_000);
    state = nextEpisode(state.episode, [], 73_000);
    expect(state.cleared).toEqual({ count: 2, ms: 72_000 });
    expect(clearedLine({ count: 2, ms: 72_000 })).toBe("All clear · 2 answered in 1 min 12 s");
  });
});
