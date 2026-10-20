/**
 * The title upstream gives a thread it has nothing to name it by. The line
 * over a Cell's composer shows no one-liner for it; if this fails after a
 * sync, `UNTITLED_THREAD` follows upstream's new word.
 */
import { deriveThreadTitleSeed } from "@t3tools/client-runtime/operations";
import { describe, expect, it } from "vite-plus/test";

import { UNTITLED_THREAD } from "./titles";

describe("upstream's untitled thread", () => {
  it("is what a first message with no words is titled", () => {
    expect(deriveThreadTitleSeed({ text: "  ", attachments: [] })).toBe(UNTITLED_THREAD);
  });
});
