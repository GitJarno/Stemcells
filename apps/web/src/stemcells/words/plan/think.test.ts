import { describe, expect, it } from "vite-plus/test";

import type { WordsCatalog } from "../catalog";
import { modelLexicon } from "../catalog";
import { heldOf } from "../cells";
import { testCatalog, testPlaces } from "../fixtures/catalog";
import { roster } from "../places";
import { readWords } from "../read";
import { askOf } from "./plan";
import {
  FAST_FAILURE_MS,
  FLOOR_WHY,
  type PlannerReply,
  plannerModel,
  plannerReplyOf,
  thinkThrough,
} from "./think";

const ctx = {
  door: "draft" as const,
  roster: roster(testPlaces),
  models: modelLexicon(testCatalog),
};
const defaults = {
  model: () => "Fable 5.1",
  place: "Kestrel",
  effortLabel: (level: string) => level,
};
const text = "Spawn 3 Opus Cells: fix sign-in across Harbor, Atlas and Kestrel";
const facts = readWords(text, ctx);
const launch = heldOf(facts)!;
const ask = askOf(facts, launch, defaults, []);
const answer = {
  cells: ["Harbor", "Atlas", "Kestrel"].map((project, i) => ({
    cell: i + 1,
    title: `Sign-in in ${project}`,
    prompt: `Fix sign-in in ${project}.`,
    project,
  })),
};

/** A planner that answers in turn, and the prompts it was asked. */
function planner(...replies: PlannerReply[]) {
  const asked: string[] = [];
  return {
    asked,
    call: async (prompt: string) => {
      asked.push(prompt);
      return replies.shift() ?? { ok: false as const, reason: "failed" as const };
    },
  };
}

const think = (
  call: (prompt: string) => Promise<PlannerReply>,
  limit: string | null = null,
  now?: () => number,
) =>
  thinkThrough({
    ask,
    launch,
    roster: testPlaces,
    call,
    limit,
    signal: new AbortController().signal,
    ...(now ? { now } : {}),
  });

/** A clock each call moves on by `ms`, as a call that takes that long would. */
function clock(ms: number) {
  let time = 0;
  return { now: () => time, pass: () => (time += ms) };
}

describe("Aski thinking a plan through", () => {
  it("takes a checked answer at once", async () => {
    const { asked, call } = planner({ ok: true, answer });
    const plan = await think(call);
    expect(plan?.kind).toBe("planned");
    expect(plan?.cells.map((cell) => cell.picked?.name)).toEqual(["Harbor", "Atlas", "Kestrel"]);
    expect(asked).toHaveLength(1);
  });

  it("asks once more, naming what failed, then falls to the floor", async () => {
    const short = { cells: answer.cells.slice(0, 2) };
    const { asked, call } = planner({ ok: true, answer: short }, { ok: true, answer: short });
    const tries: unknown[] = [];
    const plan = await thinkThrough({
      ask,
      launch,
      roster: testPlaces,
      call,
      limit: null,
      signal: new AbortController().signal,
      tried: (one) => tries.push({ ...one, ms: 0 }),
    });
    expect(tries).toEqual([
      { ms: 0, came: "answer", answer: short, failed: ["Cell 3 has no answer."] },
      { ms: 0, came: "answer", answer: short, failed: ["Cell 3 has no answer."] },
    ]);
    expect(asked).toHaveLength(2);
    expect(asked[1]).toContain("- Cell 3 has no answer.");
    expect(plan).toMatchObject({ kind: "floor", why: FLOOR_WHY.failed });
    expect(plan?.cells).toHaveLength(3);
  });

  it("asks again after a call that failed fast, never after a timeout", async () => {
    const fast = planner({ ok: false, reason: "failed" }, { ok: true, answer });
    expect((await think(fast.call))?.kind).toBe("planned");
    const slow = planner({ ok: false, reason: "timeout" }, { ok: true, answer });
    expect(await think(slow.call)).toMatchObject({ kind: "floor", why: FLOOR_WHY.timeout });
    expect(slow.asked).toHaveLength(1);
  });

  it("never asks again after a slow failure: a second would double the wait", async () => {
    const time = clock(FAST_FAILURE_MS + 1);
    const { asked, call } = planner({ ok: false, reason: "failed" }, { ok: true, answer });
    const timed = async (prompt: string) => {
      time.pass();
      return call(prompt);
    };
    expect(await think(timed, null, time.now)).toMatchObject({
      kind: "floor",
      why: FLOOR_WHY.failed,
    });
    expect(asked).toHaveLength(1);
  });

  it("never asks again when the server refused the request", async () => {
    const { asked, call } = planner(
      { ok: false, reason: "failed", refused: true },
      { ok: true, answer },
    );
    expect(await think(call)).toMatchObject({ kind: "floor", why: FLOOR_WHY.failed });
    expect(asked).toHaveLength(1);
  });

  it("lets go at once when the plan is dropped while a call hangs", async () => {
    const esc = new AbortController();
    const plan = thinkThrough({
      ask,
      launch,
      roster: testPlaces,
      call: () => new Promise<PlannerReply>(() => {}),
      limit: null,
      signal: esc.signal,
    });
    esc.abort();
    expect(await plan).toBeNull();
  });

  it("calls nothing when the planner's plan is spent, and says so", async () => {
    const { asked, call } = planner({ ok: true, answer });
    const plan = await think(call, "Claude Code Weekly: 0% left");
    expect(plan).toMatchObject({ kind: "floor", why: "Claude Code Weekly: 0% left" });
    expect(asked).toEqual([]);
  });

  it("drops the plan when the words change while it thinks", async () => {
    const words = new AbortController();
    const plan = thinkThrough({
      ask,
      launch,
      roster: testPlaces,
      call: async () => {
        words.abort();
        return { ok: true, answer };
      },
      limit: null,
      signal: words.signal,
    });
    expect(await plan).toBeNull();
  });
});

describe("what the planner's route answered", () => {
  it("is refused for a request the server won't take: not signed in, not allowed, too large", () => {
    for (const status of [401, 403, 413])
      expect(plannerReplyOf(status, null)).toEqual({ ok: false, reason: "failed", refused: true });
  });

  it("may be asked again after a server error or a failure it names", () => {
    expect(plannerReplyOf(502, null)).toEqual({ ok: false, reason: "failed" });
    expect(plannerReplyOf(200, { ok: false, reason: "failed", ms: 900 })).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("keeps the answer, a timeout and an unavailable model as they came", () => {
    expect(plannerReplyOf(200, { ok: true, answer, ms: 900 })).toEqual({ ok: true, answer });
    expect(plannerReplyOf(200, { ok: false, reason: "timeout" })).toEqual({
      ok: false,
      reason: "timeout",
    });
    expect(plannerReplyOf(200, { ok: false, reason: "unavailable" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(plannerReplyOf(200, "nonsense")).toEqual({ ok: false, reason: "failed" });
  });
});

describe("the model Aski thinks with", () => {
  const catalog: WordsCatalog = {
    providers: [
      {
        id: "codex",
        name: "Codex",
        defaultModel: "gpt-6.1-sol",
        models: [
          { id: "gpt-6.1-sol", name: "Sol 6.1", efforts: ["low"], effortOption: "reasoningEffort" },
        ],
      },
      {
        id: "claudeAgent",
        name: "Claude",
        defaultModel: "claude-fable-5-1",
        models: [
          {
            id: "claude-fable-5-1",
            name: "Fable 5.1",
            efforts: ["low", "high"],
            effortOption: "effort",
          },
          {
            id: "claude-opus-5-5",
            name: "Opus 5.5",
            efforts: ["low", "high"],
            effortOption: "effort",
            aliases: ["opus"],
          },
        ],
      },
      { id: "claudeAgent-work", name: "Claude (work)", models: [] },
    ],
  };

  it("is Claude's strongest model at low effort, else Codex's default", () => {
    expect(plannerModel(catalog, () => true)).toEqual({
      instanceId: "claudeAgent",
      driver: "claudeAgent",
      model: "claude-opus-5-5",
      effort: { option: "effort", level: "low" },
    });
    expect(plannerModel(catalog, (id) => id === "codex")).toMatchObject({
      instanceId: "codex",
      model: "gpt-6.1-sol",
      effort: { option: "reasoningEffort", level: "low" },
    });
    expect(plannerModel(catalog, () => false)).toBeNull();
  });

  it("is none when the person turned Aski's planning off, so the words alone set the Cells up", () => {
    expect(plannerModel(catalog, () => true, false)).toBeNull();
  });
});
