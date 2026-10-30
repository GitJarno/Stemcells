import { parseThreadLinkHref } from "@t3tools/shared/threadLinks";
import { describe, expect, it } from "vite-plus/test";

import { cellPill, cellsLinked, linkCells } from "./cellLinks";

describe("another Cell named in a chat's words, on the phone", () => {
  const names = new Map([["Manatee", "thread-m"]]);

  it("is upstream's thread link to it, which a tap opens, drawn as its pill: its still, then its name", () => {
    const linked = linkCells("Manatee is hiding the third.", "env-1", names);
    const href = /\]\(([^)]+)\)/.exec(linked)![1]!;
    expect(parseThreadLinkHref(href)).toEqual({ environmentId: "env-1", threadId: "thread-m" });
    expect(cellsLinked(linked, "env-1", names)).toEqual(new Set(["thread-m"]));
    const still = "data:image/png;base64,iVBORw0KGgo=";
    const pill = cellPill(href, "env-1", names, new Map([["thread-m", still]]));
    expect(pill?.label).toBe("Manatee");
    // Untinted: a tint would draw the Cell as a silhouette.
    expect(pill?.icon).toEqual({ uri: still });
    expect(pill?.chip.tintsIcon).toBe(false);
    expect(cellPill("t3-thread://v2/env-1/thread-x", "env-1", names, new Map())).toBeUndefined();
  });
});
