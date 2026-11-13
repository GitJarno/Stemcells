import { describe, expect, it } from "vite-plus/test";

import type { Fact, Landed } from "./facts.ts";
import { LANDED_ALONE_MS, LONG_HAUL_MS, MARKS, marksByThread } from "./marks.ts";

const MINUTE = 60_000;
const at = (minutes: number) =>
  `2026-10-23T${String(9 + Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00.000Z`;

const landed = (
  runId: string,
  minutes: number,
  data: Partial<Landed> = {},
  threadId = "pip",
): Fact => ({
  key: `landed:${runId}`,
  kind: "landed",
  threadId,
  at: at(minutes),
  data: { runId, ms: 12 * MINUTE, aloneMs: 12 * MINUTE, asks: 0, closeOut: "done", ...data },
});

const mergedAt = (number: number, minutes: number, threadId = "pip"): Fact => ({
  key: `merged:${threadId}:example.com/team/website#${number}`,
  kind: "merged",
  threadId,
  at: at(minutes),
  data: { number },
});

const marks = (facts: ReadonlyArray<Fact>, threadId = "pip") =>
  (marksByThread(facts).get(threadId) ?? []).map((award) => award.mark);

describe("the marks a life earned, from its facts", () => {
  it("are measured against growth's own stages", () => {
    expect(LANDED_ALONE_MS).toBe(10 * MINUTE);
    expect(LONG_HAUL_MS).toBe(120 * MINUTE);
  });

  it.each<[string, Partial<Landed>, boolean]>([
    ["with Done, asking nothing, 10 min alone", { aloneMs: 10 * MINUTE }, true],
    ["a second short of 10 min alone", { aloneMs: 10 * MINUTE - 1000 }, false],
    ["having asked the person once", { asks: 1 }, false],
    ["with something left", { closeOut: "left" }, false],
    ["with no close-out", { closeOut: null }, false],
    // A long run that waited on the person most of the time wasn't alone.
    ["30 min long, 8 of them alone", { ms: 30 * MINUTE, aloneMs: 8 * MINUTE }, false],
  ])("a run that landed %s: landed alone %s", (_what, data, earned) => {
    expect(marks([landed("run-1", 20, data)])).toEqual(earned ? ["landed-alone"] : []);
  });

  it("the first run that landed alone stands for the mark, whatever lands later", () => {
    const facts = [
      landed("run-3", 90, { aloneMs: 50 * MINUTE }),
      landed("run-1", 10, { asks: 2 }),
      landed("run-2", 40, { aloneMs: 15 * MINUTE }),
    ];
    expect(marksByThread(facts).get("pip")).toEqual([
      { mark: "landed-alone", threadId: "pip", at: at(40), aloneMs: 15 * MINUTE },
    ]);
  });

  it("a merged pull request is a mark, once, by its first", () => {
    expect(marksByThread([mergedAt(9, 70), mergedAt(7, 30)]).get("pip")).toEqual([
      { mark: "merged", threadId: "pip", at: at(30), number: 7 },
    ]);
  });

  it("the long haul is earned at the landing that takes a life past two hours alone", () => {
    const run = (n: number, minutes: number, alone: number) =>
      landed(`run-${n}`, minutes, { aloneMs: alone * MINUTE, closeOut: "left", asks: 1 });
    const short = [run(1, 10, 50), run(2, 70, 69)];
    expect(marks(short)).toEqual([]);
    expect(marksByThread([...short, run(3, 130, 1), run(4, 200, 30)]).get("pip")).toEqual([
      { mark: "long-haul", threadId: "pip", at: at(130), aloneMs: 150 * MINUTE },
    ]);
  });

  it("counts a life's landings, its clean ones in a row, and its merges", () => {
    // Too short to land alone or come to a long haul: only the counts are in play.
    const brief = (n: number, data: Partial<Landed> = {}) =>
      landed(`run-${n}`, n, { ms: MINUTE, aloneMs: MINUTE, ...data });
    const nine = Array.from({ length: 9 }, (_, n) => brief(n + 1, { closeOut: "left" }));
    expect(marks(nine)).toEqual([]);
    expect(marksByThread([...nine, brief(10), brief(11)]).get("pip")).toEqual([
      { mark: "frequent-flyer", threadId: "pip", at: at(10), landings: 11 },
    ]);
    // An ask breaks the row; the mark is dated by the fifth in a row and shows the longest.
    const row = [1, 2, 3, 4].map((n) => brief(n));
    expect(marks([...row, brief(5, { asks: 1 }), ...[6, 7, 8, 9].map((n) => brief(n))])).toEqual(
      [],
    );
    expect(marksByThread([...row, brief(5), brief(6)]).get("pip")).toEqual([
      { mark: "radio-silence", threadId: "pip", at: at(5), inARow: 6 },
    ]);
    expect(marks([mergedAt(1, 10), mergedAt(2, 20)])).toEqual(["merged"]);
    expect(
      marksByThread([mergedAt(1, 10), mergedAt(2, 20), mergedAt(3, 30), mergedAt(4, 40)]).get(
        "pip",
      ),
    ).toEqual([
      { mark: "merged", threadId: "pip", at: at(10), number: 1 },
      { mark: "hat-trick", threadId: "pip", at: at(30), merges: 4 },
    ]);
  });

  it("each life earns its own, in the order it earned them", () => {
    const facts = [
      landed("run-a", 50, { aloneMs: 130 * MINUTE }),
      mergedAt(4, 20),
      landed("run-b", 30, { aloneMs: 60 * MINUTE }, "otter"),
      landed("run-c", 45, { aloneMs: 59 * MINUTE }, "otter"),
    ];
    expect(marks(facts)).toEqual(["merged", "landed-alone", "long-haul"]);
    expect(marks(facts, "otter")).toEqual(["landed-alone"]);
    // No mark, no entry: a life that earned nothing isn't listed.
    expect(marksByThread([landed("run-d", 5, { asks: 3 }, "wren")]).has("wren")).toBe(false);
    // A record lists every mark a rule can award, once.
    const every = [
      ...Array.from({ length: 10 }, (_, n) => landed(`run-${n}`, n * 10, { aloneMs: 15 * MINUTE })),
      mergedAt(1, 5),
      mergedAt(2, 6),
      mergedAt(3, 7),
    ];
    expect([...marks(every)].sort()).toEqual([...MARKS].sort());
  });
});
