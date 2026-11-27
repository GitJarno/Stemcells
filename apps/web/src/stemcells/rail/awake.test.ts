import { describe, expect, it } from "vite-plus/test";

import { byRecent, launchedAt, rowStateOf, type Launchable } from "./awake";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 26, 12, minute)).toISOString();

function cell(over: Partial<Launchable> & { readonly id?: string } = {}): Launchable {
  return { id: "a", createdAt: at(0), latestRun: null, ...over };
}

describe("launchedAt", () => {
  it.each([
    ["a new Cell stands where it was made", cell(), at(0)],
    [
      "a word sent from rest launches it",
      cell({ latestUserAuthoredMessageAt: at(10), latestRun: { requestedAt: at(10) } }),
      at(10),
    ],
    [
      "a word sent while it flies leaves the flight's start",
      cell({ latestUserAuthoredMessageAt: at(14), latestRun: { requestedAt: at(10) } }),
      at(10),
    ],
    [
      "a flight an agent began leaves the person's last word",
      cell({ latestUserAuthoredMessageAt: at(10), latestRun: { requestedAt: at(30) } }),
      at(10),
    ],
    [
      "waking it brings it forward",
      cell({
        latestUserAuthoredMessageAt: at(10),
        latestRun: { requestedAt: at(10) },
        unsettledAt: at(40),
      }),
      at(40),
    ],
    [
      "a timed sleep's alarm brings it forward",
      cell({
        latestUserAuthoredMessageAt: at(10),
        latestRun: { requestedAt: at(10) },
        snoozedUntil: at(50),
      }),
      at(50),
    ],
    [
      "an older server's Cell stands where it was made",
      cell({ latestRun: { requestedAt: at(20) } }),
      at(0),
    ],
  ])("%s", (_name, input, expected) => {
    expect(launchedAt(input)).toBe(Date.parse(expected));
  });
});

describe("byRecent", () => {
  it("stands each row by the time it shows, else by its launch, and holds a tie by id", () => {
    const old = cell({ id: "old" });
    const tieB = cell({ id: "b", createdAt: at(5) });
    const tieA = cell({ id: "a", createdAt: at(5) });
    const sent = cell({
      id: "sent",
      latestUserAuthoredMessageAt: at(20),
      latestRun: { requestedAt: at(20) },
    });
    // Woken just now, it shows when it landed: it stands there, not at the top.
    const woken = cell({ id: "woken", unsettledAt: at(30) });
    const since = new Map([["woken", at(4)]]);
    expect(
      byRecent([old, woken, tieB, sent, tieA], (each) => since.get(each.id)).map((each) => each.id),
    ).toEqual(["sent", "a", "b", "woken", "old"]);
  });
});

describe("rowStateOf", () => {
  it.each([
    ["needs-you", false, "needs"],
    ["working", true, "flying"],
    ["done", true, "news"],
    ["done", false, "seen"],
    [undefined, false, "seen"],
  ] as const)("%s, unseen %s, is %s", (stage, unseen, expected) => {
    expect(rowStateOf(stage, unseen)).toBe(expected);
  });
});
