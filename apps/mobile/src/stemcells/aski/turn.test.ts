import { describe, expect, it } from "vite-plus/test";

import { answeredSince, turnFrom, whereOf } from "./turn";

const aski = { environmentId: "mac", threadId: "aski" };
const cell = { kind: "cell", environmentId: "mac", threadId: "bison" } as const;

describe("Aski's button turns the chat in front", () => {
  it("reads what's in front from the route", () => {
    expect(whereOf("Home", "/")).toEqual({ kind: "home" });
    expect(whereOf("Thread", "/threads/mac/bison")).toEqual(cell);
    expect(whereOf("Thread", "/threads/mac/bison?draft=1")).toEqual(cell);
    expect(whereOf("SettingsAppearance", "/settings/appearance")).toBeNull();
  });

  it("from a Cell to Aski, and back to that Cell", () => {
    const there = turnFrom(cell, aski, null);
    expect(there).toEqual({ go: { kind: "cell", ...aski }, back: cell });
    expect(turnFrom(there.go, aski, there.back)).toEqual({ go: cell, back: null });
  });

  it("from the home to Aski and back home, and home when it has nothing to go back to", () => {
    const there = turnFrom({ kind: "home" }, aski, null);
    expect(turnFrom(there.go, aski, there.back).go).toEqual({ kind: "home" });
    expect(turnFrom({ kind: "cell", ...aski }, aski, null).go).toEqual({ kind: "home" });
  });

  it("an Aski on another machine is a Cell like any", () => {
    const elsewhere = { kind: "cell", environmentId: "mini", threadId: "aski" } as const;
    expect(turnFrom(elsewhere, aski, null).back).toEqual(elsewhere);
  });
});

describe("the dot", () => {
  const run = (status: string, completedAt: string | null) => ({ status, completedAt });
  it("shows for a reply finished after Aski was last seen", () => {
    expect(
      answeredSince(run("completed", "2026-11-26T18:00:01Z"), Date.parse("2026-11-26T18:00:00Z")),
    ).toBe(true);
    expect(
      answeredSince(run("completed", "2026-11-26T17:59:59Z"), Date.parse("2026-11-26T18:00:00Z")),
    ).toBe(false);
    expect(answeredSince(run("running", null), 0)).toBe(false);
    expect(answeredSince(run("failed", "2026-11-26T18:00:01Z"), 0)).toBe(false);
    expect(answeredSince(null, 0)).toBe(false);
  });
});
