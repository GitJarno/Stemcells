import { describe, expect, it } from "vite-plus/test";

import { closesOnLeave } from "./searchOnLeave";

describe("the home's search when the person opens a chat from it", () => {
  it.each([
    ["closes, left empty", "", "expanded", true],
    ["closes, left empty with the field still focused", "", "active", true],
    ["closes, left with only spaces", "  ", "expanded", true],
    ["stays open on a query, for its results", "otter", "expanded", false],
    ["stays open on a query being typed", "ot", "active", false],
    ["stays shut when it was", "", "resting", false],
  ] as const)("%s", (_, query, searchMode, closes) => {
    expect(closesOnLeave({ query, searchMode })).toBe(closes);
  });
});
