import { describe, expect, it } from "vite-plus/test";

import { EMPTY, endingOf, listed, mark, measure, type Ledger } from "./ledger.ts";

const DAY = 24 * 60 * 60 * 1000;
const T = Date.parse("2026-10-27T09:00:00.000Z");

const question = (key: string) => ({ key, kind: "question" as const });
const permission = (key: string) => ({ key, kind: "permission" as const });

/** Asks seen at T, then gone at T + 1 minute, each after what the person did. */
function ended(
  ...asks: ReadonlyArray<{
    key: string;
    kind: "question" | "permission";
    did?: ReadonlyArray<"answered" | "opened" | "flagged">;
  }>
): Ledger {
  let ledger = listed(EMPTY, asks, T);
  for (const ask of asks)
    for (const did of ask.did ?? []) ledger = mark(ledger, ask.key, did, null, T);
  return listed(ledger, [], T + 60_000);
}

describe("the asks' ledger", () => {
  it("records an ask as it comes, ends it as it leaves, and opens it again if it comes back", () => {
    const seen = listed(EMPTY, [question("a")], T);
    expect(seen.asks["a"]).toMatchObject({ kind: "question", seenAt: T, endedAt: null });
    expect(listed(seen, [question("a")], T + 1)).toBe(seen);
    const left = listed(seen, [], T + 2);
    expect(left.asks["a"]?.endedAt).toBe(T + 2);
    expect(listed(left, [question("a")], T + 3).asks["a"]).toMatchObject({
      seenAt: T,
      endedAt: null,
    });
  });

  it("tells how an ask ended: a flag first, then an opened chat, then an answer from the ask", () => {
    const ledger = ended(
      { ...question("alone"), did: ["answered"] },
      { ...question("opened"), did: ["opened", "answered"] },
      { ...question("flagged"), did: ["flagged", "answered"] },
      question("elsewhere"),
    );
    expect(
      Object.fromEntries(Object.entries(ledger.asks).map(([key, r]) => [key, endingOf(r)])),
    ).toEqual({
      alone: "alone",
      opened: "opened",
      flagged: "flagged",
      elsewhere: "elsewhere",
    });
  });

  it("keeps what was missing, said after the flag, and ignores an ask it never saw", () => {
    let ledger = listed(EMPTY, [question("a")], T);
    ledger = mark(ledger, "a", "flagged", null, T);
    ledger = mark(ledger, "a", "flagged", "  Which branch it pushes  ", T + 5);
    expect(ledger.asks["a"]?.flag).toEqual({ at: T, note: "Which branch it pushes" });
    expect(mark(ledger, "unseen", "answered", null, T)).toBe(ledger);
  });

  it("measures each kind over the last week: the share answered from the ask alone", () => {
    const ledger = ended(
      { ...question("q1"), did: ["answered"] },
      { ...question("q2"), did: ["flagged"] },
      question("q3"),
      { ...permission("p1"), did: ["answered"] },
    );
    expect(measure(ledger, T + DAY).kinds).toEqual([
      { kind: "question", ended: 3, alone: 1, flagged: 1 },
      { kind: "permission", ended: 1, alone: 1, flagged: 0 },
    ]);
    // An ask still on the list hasn't ended; one that ended over a week ago is past the window.
    expect(measure(listed(ledger, [question("q4")], T + DAY), T + DAY).kinds[0]?.ended).toBe(3);
    expect(measure(ledger, T + 8 * DAY).kinds).toEqual([]);
  });

  it("forgets an ask a month after it ended", () => {
    const ledger = ended(question("a"));
    expect(listed(ledger, [], T + 29 * DAY)).toBe(ledger);
    expect(listed(ledger, [], T + 31 * DAY).asks).toEqual({});
  });
});
