// @effect-diagnostics globalDate:off - a fixed moment on the reader's own calendar.
import { describe, expect, it } from "vite-plus/test";

import { asksAboutPast, freeWords, recallAskOf } from "./question.ts";

const NOW = new Date(2026, 10, 27, 15, 0).getTime();

describe("a question about the past", () => {
  it.each([
    "where was that chat about the film detail page two days ago, what came of it?",
    "what did we do in Harbor this week",
    "what happened with the login work",
    "summarise the checkout work",
    "which cell fixed the tokens",
    "did we ever ship the export",
    "find me that chat about the sidebar",
    // Dictated: a time and a question's opening, no question mark.
    "anything on the film page yesterday",
    "Start these three, turn the sounds off, and what happened in Harbor yesterday?",
  ])("%s", (text) => {
    expect(asksAboutPast(text, NOW)).toBe(true);
  });

  it.each([
    // Work to start, with a time in it: no question.
    "fix the bug I introduced yesterday in the film page",
    "a Fable Cell on high for the product page",
    "turn the sounds off",
    "hey there",
    // What stands now, not what was done.
    "what needs me?",
    "where are the sound settings",
    "tell Otter to rebase",
  ])("not: %s", (text) => {
    expect(asksAboutPast(text, NOW)).toBe(false);
  });

  it("asks recall with the window its own clock reads", () => {
    expect(recallAskOf("what did we do in Harbor yesterday", NOW)).toEqual({
      query: "what did we do in Harbor yesterday",
      from: new Date(2026, 10, 26).getTime(),
      to: new Date(2026, 10, 27).getTime(),
    });
    expect(recallAskOf("turn the sounds off", NOW)).toBeNull();
  });

  it("keeps the words a question is about, and drops what it is built from", () => {
    expect(freeWords("where was that chat about the film detail page  , what came of it?")).toEqual(
      ["film", "detail", "page"],
    );
    expect(freeWords("what did we do in  this week")).toEqual([]);
  });
});
