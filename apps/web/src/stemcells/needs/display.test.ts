import { describe, expect, it } from "vite-plus/test";

import { clearedLine, nextEpisode, nextShown, type Shown } from "./display";
import { needFixture } from "./fixtures";

const LINGER = 1_200;
const floof = needFixture({ key: "floof", number: 1 });
const bongo = needFixture({ key: "bongo", number: 2, threadId: "thread-bongo" });
const pip = needFixture({ key: "pip", number: 3, threadId: "thread-pip" });
const keys = (shown: ReadonlyArray<Shown>) =>
  shown.map((each) => `${each.need.key}${each.goneAt === null ? "" : " (gone)"}`);

describe("the cards hold still while the person works", () => {
  it("adds new cards at the bottom and never re-sorts", () => {
    const first = nextShown([], [bongo, floof], { frozen: false, now: 0, linger: LINGER });
    expect(keys(first)).toEqual(["floof", "bongo"]);
    const reset = needFixture({ key: "otter", number: 1, threadId: "thread-otter" });
    const later = nextShown(first, [reset, bongo, floof], {
      frozen: false,
      now: 0,
      linger: LINGER,
    });
    expect(keys(later)).toEqual(["floof", "bongo", "otter"]);
  });

  it("greys a gone card in place, and keeps it while frozen however long", () => {
    const shown = nextShown([], [floof, bongo, pip], { frozen: false, now: 0, linger: LINGER });
    const gone = nextShown(shown, [floof, pip], { frozen: true, now: 100, linger: LINGER });
    expect(keys(gone)).toEqual(["floof", "bongo (gone)", "pip"]);
    expect(
      keys(nextShown(gone, [floof, pip], { frozen: true, now: 60_000, linger: LINGER })),
    ).toEqual(["floof", "bongo (gone)", "pip"]);
  });

  it("lets a gone card leave a beat after, once the page unfreezes", () => {
    const shown = nextShown([], [floof, bongo], { frozen: false, now: 0, linger: LINGER });
    const gone = nextShown(shown, [floof], { frozen: false, now: 100, linger: LINGER });
    expect(
      keys(nextShown(gone, [floof], { frozen: false, now: 100 + LINGER - 1, linger: LINGER })),
    ).toEqual(["floof", "bongo (gone)"]);
    expect(
      keys(nextShown(gone, [floof], { frozen: false, now: 100 + LINGER, linger: LINGER })),
    ).toEqual(["floof"]);
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
