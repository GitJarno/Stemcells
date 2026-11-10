import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import type { LedgerRequest, LedgerRun, LedgerThread } from "../upstream/ledger.ts";
import { factsOf, landedOf } from "./facts.ts";

const MINUTE = 60_000;
const at = (minutes: number) =>
  DateTime.formatIso(DateTime.makeUnsafe(Date.UTC(2026, 9, 23, 9, minutes)));

const cell = (overrides: Partial<LedgerThread> = {}): LedgerThread => ({
  threadId: "thread-pip",
  projectId: "project-harbor",
  driver: "claudeAgent",
  createdAt: at(0),
  settledAt: null,
  merged: [],
  ...overrides,
});

const run = (overrides: Partial<LedgerRun> = {}): LedgerRun => ({
  threadId: "thread-pip",
  runId: "run-1",
  ordinal: 1,
  status: "completed",
  startedAt: at(0),
  completedAt: at(30),
  reply: "Shipped.\n\n**Done:** the header is fixed",
  requests: [],
  ...overrides,
});

const asked = (from: number, to: number | null): LedgerRequest => ({
  createdAt: at(from),
  resolvedAt: to === null ? null : at(to),
});

describe("the facts true of a chat", () => {
  it("a chat is born with its name, its driver and its project, and nothing of its words", () => {
    expect(factsOf(cell())).toEqual([
      {
        key: "born:thread-pip",
        kind: "born",
        threadId: "thread-pip",
        at: at(0),
        data: {
          name: expect.stringMatching(/^\p{Lu}/u),
          driver: "claudeAgent",
          projectId: "project-harbor",
        },
      },
    ]);
  });

  it.each([
    ["interrupted", at(0), at(30)],
    ["failed", at(0), at(30)],
    ["cancelled", at(0), at(30)],
    ["rolled_back", at(0), at(30)],
    ["running", at(0), null],
    // Never started: it was queued, then completed without a start to count from.
    ["completed", null, at(30)],
  ])("a %s run from %s to %s didn't land", (status, startedAt, completedAt) => {
    expect(landedOf(run({ status, startedAt, completedAt }))).toEqual([]);
  });

  it("a completed run landed, once, at its landing", () => {
    expect(landedOf(run())).toEqual([
      {
        key: "landed:run-1",
        kind: "landed",
        threadId: "thread-pip",
        at: at(30),
        data: { runId: "run-1", ms: 30 * MINUTE, aloneMs: 30 * MINUTE, asks: 0, closeOut: "done" },
      },
    ]);
  });

  it("time alone is the run less the waits that held it, and its asks are those waits", () => {
    const [fact] = landedOf(
      run({
        requests: [
          // Held it for 5 minutes.
          asked(5, 10),
          // Overlaps the first: counted once, 2 more minutes.
          asked(8, 12),
          // Never answered: it waited until the landing, 3 minutes.
          asked(27, null),
        ],
      }),
    );
    expect(fact?.data).toMatchObject({ ms: 30 * MINUTE, aloneMs: 20 * MINUTE, asks: 3 });
  });

  it.each([
    ["Shipped.\n\n**Done:** the header is fixed", "done"],
    ["Two ways to go.\n\n**Left:** you — pick one", "left"],
    ["All set, I think.", null],
    [null, null],
  ] as const)("a reply ending %j closes out %s", (reply, closeOut) => {
    expect(landedOf(run({ reply }))[0]?.data).toMatchObject({ closeOut });
  });

  it("each settle is its own fact", () => {
    const first = factsOf(cell({ settledAt: at(40) })).find((fact) => fact.kind === "settled");
    const second = factsOf(cell({ settledAt: at(90) })).find((fact) => fact.kind === "settled");
    expect(first).toEqual({
      key: `settled:thread-pip:${at(40)}`,
      kind: "settled",
      threadId: "thread-pip",
      at: at(40),
      data: {},
    });
    expect(second?.key).not.toBe(first?.key);
  });

  it("a merged pull request is a fact at its forge's merge time, and none until it has one", () => {
    const merged = factsOf(
      cell({
        merged: [
          { id: "example.com/team/website#7", number: 7, mergedAt: "2026-10-23T09:45:00Z" },
          // No time of ours stands in: the first write is kept for good.
          { id: "example.com/team/website#8", number: 8, mergedAt: null },
        ],
      }),
    ).filter((fact) => fact.kind === "merged");
    expect(merged).toEqual([
      {
        key: "merged:thread-pip:example.com/team/website#7",
        kind: "merged",
        threadId: "thread-pip",
        at: at(45),
        data: { number: 7 },
      },
    ]);
  });
});
