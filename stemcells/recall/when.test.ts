// @effect-diagnostics globalDate:off - windows are told on the reader's own calendar, as `when.ts` reads them.
import { describe, expect, it } from "vite-plus/test";

import { readWhen } from "./when.ts";

/** Friday 27 November 2026, three in the afternoon, on the reader's own clock. */
const NOW = new Date(2026, 10, 27, 15, 0).getTime();
const day = (month: number, date: number, hour = 0) => new Date(2026, month, date, hour).getTime();

const window = (text: string) => {
  const when = readWhen(text, NOW);
  return when === null ? null : [when.from, when.to, when.heard];
};

describe("the time a question names", () => {
  it.each([
    // The day named and the one before it: memory rounds toward now.
    [
      "where was that chat about the film page two days ago",
      day(10, 24),
      day(10, 26),
      "two days ago",
    ],
    ["what happened yesterday", day(10, 26), day(10, 27), "yesterday"],
    ["what did we ship today?", day(10, 27), day(10, 28), "today"],
    // Monday to Monday: the week before this one.
    ["what did we do in Harbor last week", day(10, 16), day(10, 23), "last week"],
    ["what did we do in Harbor this week", day(10, 23), day(10, 28), "this week"],
    ["the one from on Tuesday", day(10, 24), day(10, 25), "on Tuesday"],
    // Said on a Friday, Friday is the one a week back.
    ["what did we finish last Friday", day(10, 20), day(10, 21), "last Friday"],
    ["what did Atlas get in March", day(2, 1), day(3, 1), "in March"],
    // December hasn't come this year: the last one that has.
    [
      "the work from back in December",
      new Date(2025, 11, 1).getTime(),
      day(0, 1),
      "back in December",
    ],
    ["anything in the last 3 days", day(10, 24), day(10, 28), "the last 3 days"],
    ["what changed since Monday", day(10, 23), day(10, 28), "since Monday"],
    ["a couple of weeks ago we fixed login", day(10, 10), day(10, 17), "a couple of weeks ago"],
  ])("%s", (text, from, to, heard) => {
    expect(window(text)).toEqual([from, to, heard]);
  });

  it("reads none from words that only look like a time", () => {
    // "may" and "march" are words of their own without a lead-in.
    expect(window("may I see the march of the Cells")).toBeNull();
    expect(window("where is the settings page")).toBeNull();
  });
});
