import { parseThreadLinkHref } from "@t3tools/shared/threadLinks";
import { describe, expect, it } from "vite-plus/test";

import { cellPill, linkCells } from "./cellLinks";

describe("another Cell named in a chat's words, on the phone", () => {
  const names = new Map([["Manatee", "thread-m"]]);

  it("is upstream's thread link to it, which a tap opens, drawn as its pill", () => {
    const linked = linkCells("Manatee is hiding the third.", "env-1", names);
    const href = /\]\(([^)]+)\)/.exec(linked)![1]!;
    expect(parseThreadLinkHref(href)).toEqual({ environmentId: "env-1", threadId: "thread-m" });
    expect(cellPill(href, "env-1", names)?.label).toBe("Manatee");
    expect(cellPill("t3-thread://v2/env-1/thread-x", "env-1", names)).toBeUndefined();
  });
});
