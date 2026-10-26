import { describe, expect, it } from "vite-plus/test";

import { bettersOf } from "./changes";

describe("bettersOf", () => {
  it("reads each change back into its title and number, newest first, each once", () => {
    const betters = bettersOf({
      releaseNotes: [
        { items: ["Older today (#301)", "Newest (#303)"] },
        { items: ["Yesterday (#299)", "Older today (#301)", "Fix the dock"] },
      ],
    });
    expect(betters).toEqual([
      { title: "Newest", number: 303 },
      { title: "Older today", number: 301 },
      { title: "Fix the dock", number: null },
      { title: "Yesterday", number: 299 },
    ]);
  });
});
