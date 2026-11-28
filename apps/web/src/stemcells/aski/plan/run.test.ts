import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { clearPlannedRows, plannedRows } from "../../../../../../stemcells/aski/planned.ts";
import type { DestroyAct, Plan, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { trayOf } from "../../../../../../stemcells/orchestrator/tray.ts";
import type { KeptPlan } from "../../../../../../stemcells/orchestrator/wire.ts";
import { clearKept, keptTray, planUnder, takeKept, withTold } from "./kept";
import { createRunner, type RunnerHands } from "./run";
import {
  adoptPlan,
  beginPlan,
  clearPlans,
  leavePlan,
  planOf,
  planRead,
  readPlans,
  subscribePlans,
} from "./store";
import { capOf } from "./settings";

const cell = (i: number, over: Partial<StartAct> = {}): StartAct => ({
  kind: "start",
  i,
  pieces: [i + 1],
  tier: "start",
  why: [],
  threadId: `thread-${i}`,
  title: `Task ${i}`,
  words: `do task ${i}`,
  note: null,
  place: { id: "harbor", name: "Harbor", heard: "Harbor", how: "exact" },
  model: null,
  effort: null,
  risks: [],
  ...over,
});

const removal = (i: number): DestroyAct => ({
  kind: "destroy",
  i,
  pieces: [i + 1],
  tier: "hold",
  why: [],
  target: "project",
  place: { id: "atlas", name: "Atlas", heard: "Atlas", how: "exact" },
  cells: [],
  words: "delete the Atlas project",
});

const planWith = (id: string, acts: Plan["acts"]): Plan => ({
  id,
  dictated: false,
  pieces: [],
  acts,
  talk: [],
  leftOver: [],
  from: "read",
});

function world() {
  const calls = {
    started: [] as string[],
    /** Cells handed to the server to start. */
    queued: [] as string[],
    /** The threads the app lists. */
    listed: new Set<string>(),
    made: [] as string[],
    removed: [] as string[],
    told: [] as Array<{ id: string; acts: ReadonlyArray<{ i: number; status: string }> }>,
  };
  const hands: RunnerHands = {
    start: async (act) => {
      calls.started.push(act.threadId);
      return act.title === "Fails" ? { ok: false, error: "No model." } : { ok: true };
    },
    queue: async (_planId, act) => {
      calls.queued.push(act.threadId);
      return act.title === "Refused"
        ? { ok: false, error: "A deletion of this plan still waits for your hand." }
        : { ok: true };
    },
    wantsWorktree: (act) => act.apart === true,
    exists: (threadId) => calls.listed.has(threadId),
    newProject: async (name) => {
      calls.made.push(name);
      return { ok: true, projectKey: `env:${name}` };
    },
    removeProject: async (placeId) => {
      calls.removed.push(placeId);
      return { ok: true };
    },
    archive: async () => ({ ok: true }),
    projectKeyOf: (place) => (place === null || place.id === null ? null : `env:${place.id}`),
    cellsIn: () => [],
    cellOf: (threadId) => ({ environmentId: "env", threadId, draftId: null }),
    factsOf: () => ({ projectId: "p", modelName: "Fable", effort: undefined, driver: undefined }),
    tell: (outcome) => void calls.told.push(outcome),
    arrive: () => {},
    report: () => {},
  };
  const runner = createRunner(() => hands);
  const stop = subscribePlans(runner.sync);
  return { calls, runner, stop };
}

/** Lets the fake hands, which answer in a microtask, and the store's listeners run. */
const settle = async () => {
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
};

/** A plan as the server keeps it, with what it says came of each act. */
const keptPlan = (id: string, acts: Plan["acts"], outcome: KeptPlan["outcome"]): KeptPlan => ({
  id,
  at: 1,
  messageId: "message-1",
  words: "fix the importer",
  plan: planWith(id, acts),
  outcome,
});

const statusesOf = (id: string) => planOf(id)?.tray?.acts.map((one) => one.status);

afterEach(() => {
  for (const id of ["one", "two", "three", "four"]) clearPlannedRows(id);
  clearPlans();
  clearKept();
  vi.useRealTimers();
});

describe("carrying a plan out", () => {
  it("starts each Cell of the Start tier once, however often the store changes", async () => {
    const { calls, stop } = world();
    beginPlan("one", "env/aski", 1);
    planRead(
      "one",
      planWith("one", [cell(0), cell(1), cell(2, { tier: "check", why: ["place-near"] })]),
    );
    await settle();
    await settle();
    expect(calls.started).toEqual(["thread-0", "thread-1"]);
    expect(planOf("one")?.tray?.acts.map((one) => one.status)).toEqual([
      "started",
      "started",
      "waiting",
    ]);
    // Aski's line reads what really happened: two started, one waits.
    expect(calls.told.at(-1)?.acts.map((act) => act.status)).toEqual([
      "started",
      "started",
      "waiting",
    ]);
    // Awake forms a row for each, the waiting one as an outline.
    expect(plannedRows().map((row) => [row.threadId, row.tier])).toEqual([
      ["thread-0", "start"],
      ["thread-1", "start"],
      ["thread-2", "check"],
    ]);
    stop();
  });

  it("a Cell that waits starts only on the person's yes", async () => {
    const { calls, runner, stop } = world();
    beginPlan("two", "env/aski", 1);
    planRead("two", planWith("two", [cell(0, { tier: "check", why: ["risky"] })]));
    await settle();
    expect(calls.started).toEqual([]);
    runner.confirm("two", 0);
    await settle();
    expect(calls.started).toEqual(["thread-0"]);
    stop();
  });

  it("deletes nothing on a yes to everything: only the hold's own call removes the project", async () => {
    const { calls, runner, stop } = world();
    beginPlan("three", "env/aski", 1);
    planRead(
      "three",
      planWith("three", [removal(0), cell(1, { tier: "check", why: ["after-hold"] })]),
    );
    await settle();
    runner.confirmAll("three");
    runner.confirm("three", 0);
    runner.confirm("three", 1);
    await settle();
    // While the deletion is held, nothing else starts either, and Enter finds nothing to start.
    expect(calls.removed).toEqual([]);
    expect(calls.started).toEqual([]);
    expect(runner.waitingIn("env/aski")).toBeNull();
    // Two holds landing together delete once.
    await Promise.all([runner.destroy("three", 0), runner.destroy("three", 0)]);
    expect(calls.removed).toEqual(["atlas"]);
    expect(planOf("three")?.tray?.acts[0]?.status).toBe("done");
    runner.confirmAll("three");
    await settle();
    expect(calls.started).toEqual(["thread-1"]);
    // A second call deletes nothing again.
    await runner.destroy("three", 0);
    expect(calls.removed).toEqual(["atlas"]);
    stop();
  });

  it("Enter starts what a message's own plan waits on, never a plan Aski proposed", async () => {
    const { calls, runner, stop } = world();
    const waiting = cell(0, { tier: "check", why: ["proposed"] });
    adoptPlan("env/aski", trayOf(planWith("one", [waiting])), 1);
    await settle();
    expect(runner.waitingIn("env/aski")).toBeNull();
    beginPlan("two", "env/aski", 2);
    planRead("two", planWith("two", [cell(1, { tier: "check", why: ["place-near"] })]));
    await settle();
    expect(runner.waitingIn("env/aski")).toBe("two");
    expect(calls.started).toEqual([]);
    stop();
  });

  it("makes a new project once for the Cells that start in it, and says why one didn't start", async () => {
    const { calls, runner, stop } = world();
    const fresh = { id: null, name: "Otter Site", heard: "otter site", how: "new" } as const;
    beginPlan("four", "env/aski", 1);
    planRead(
      "four",
      planWith("four", [
        cell(0, { tier: "check", why: ["new-project"], place: fresh }),
        cell(1, { tier: "check", why: ["new-project"], place: fresh }),
        cell(2, { title: "Fails" }),
      ]),
    );
    await settle();
    runner.confirmAll("four");
    await settle();
    await settle();
    expect(calls.made).toEqual(["Otter Site"]);
    expect(calls.started.toSorted()).toEqual(["thread-0", "thread-1", "thread-2"]);
    const failed = planOf("four")?.tray?.acts[2];
    expect([failed?.status, failed?.reason]).toEqual(["failed", "No model."]);
    stop();
  });

  it("a message that was only talk leaves no plan behind", () => {
    beginPlan("one", "env/aski", 1);
    planRead("one", planWith("one", []));
    expect(planOf("one")).toBeNull();
    // The server couldn't say: the reading card goes too, and the message is the chat's.
    beginPlan("two", "env/aski", 1);
    planRead("two", null);
    expect(planOf("two")).toBeNull();
  });
});

describe("a Cell the server starts", () => {
  it("hands a Cell that comes after another to the server once, and it stays queued until its thread is listed", async () => {
    const { calls, runner, stop } = world();
    beginPlan("one", "env/aski", 1);
    planRead("one", planWith("one", [cell(0), cell(1, { after: [0] })]));
    await settle();
    runner.sync();
    runner.sync();
    await settle();
    expect(calls.started).toEqual(["thread-0"]);
    expect(calls.queued).toEqual(["thread-1"]);
    expect(statusesOf("one")).toEqual(["started", "queued"]);
    expect(calls.told.at(-1)?.acts.map((act) => act.status)).toEqual(["started", "queued"]);
    // The server started it: the app lists its thread, and the row is a Cell.
    calls.listed.add("thread-1");
    runner.sync();
    expect(statusesOf("one")).toEqual(["started", "started"]);
    expect(calls.started).toEqual(["thread-0"]);
    expect(calls.told.at(-1)?.acts.map((act) => act.status)).toEqual(["started", "started"]);
    stop();
  });

  it("says why when the server won't take a queued Cell", async () => {
    const { runner, stop } = world();
    beginPlan("one", "env/aski", 1);
    planRead("one", planWith("one", [cell(0), cell(1, { after: [0], title: "Refused" })]));
    await settle();
    const refused = planOf("one")?.tray?.acts[1];
    expect([refused?.status, refused?.reason]).toEqual([
      "failed",
      "A deletion of this plan still waits for your hand.",
    ]);
    // "Start now" on a Cell that still waits its turn starts it here.
    beginPlan("two", "env/aski", 2);
    planRead("two", planWith("two", [cell(2), cell(3, { after: [2] })]));
    await settle();
    runner.startNow("two", 3);
    await settle();
    expect(statusesOf("two")).toEqual(["started", "started"]);
    stop();
  });

  it("leaves a Cell that gets its own worktree to the server, and never tells it started before it has", async () => {
    const { calls, stop } = world();
    beginPlan("one", "env/aski", 1);
    planRead("one", planWith("one", [cell(0, { apart: true }), cell(1, { apart: false })]));
    await settle();
    expect(calls.queued).toEqual(["thread-0"]);
    expect(calls.started).toEqual(["thread-1"]);
    expect(calls.told[0]?.acts.map((act) => act.status)).toEqual(["queued", "started"]);
    expect(statusesOf("one")).toEqual(["started", "started"]);
    stop();
  });
});

describe("a plan under its message", () => {
  it("a message's plan whose Cells all started leaves the composer and stands under its message", async () => {
    vi.useFakeTimers();
    const { stop } = world();
    beginPlan("one", "env/aski", 1, "Fix the importer");
    planRead("one", planWith("one", [cell(0)]));
    await settle();
    expect(planOf("one")?.source).toBe("message");
    vi.advanceTimersByTime(12_000);
    expect(planOf("one")?.source).toBe("kept");
    expect(readPlans().filter((plan) => plan.source === "message")).toEqual([]);
    // Its message finds it by its words before the server's list has it.
    const said = { id: "message-9", text: "fix  the importer", at: 5 };
    expect(planUnder([], readPlans(), "env/aski", said)).toBe("one");
    expect(planUnder([], readPlans(), "env/other", said)).toBeNull();
    // A plan with no Cell left to show leaves the window instead.
    beginPlan("two", "env/aski", 2);
    planRead("two", planWith("two", [cell(1, { tier: "check", why: ["risky"] })]));
    world().runner.dropAll("two");
    leavePlan("two");
    expect(planOf("two")).toBeNull();
    stop();
  });

  it("a plan read from the server starts nothing; its waiting Cell starts on the person's yes", async () => {
    const { calls, runner, stop } = world();
    // No client ever said what came of it: nothing of it is shown, so nothing can start.
    expect(keptTray(keptPlan("three", [cell(5)], null))).toBeNull();
    takeKept("env/aski", [
      keptPlan(
        "one",
        [cell(0), cell(1), cell(2, { tier: "check", why: ["risky"] })],
        [
          { i: 0, status: "started" },
          { i: 2, status: "waiting" },
        ],
      ),
    ]);
    await settle();
    // The Cell nothing was told of waits for a tap, as the one that waited does.
    expect(statusesOf("one")).toEqual(["started", "waiting", "waiting"]);
    expect([calls.started, calls.told, plannedRows()]).toEqual([[], [], []]);
    expect(runner.waitingIn("env/aski")).toBeNull();
    runner.confirm("one", 2);
    await settle();
    expect(calls.started).toEqual(["thread-2"]);
    expect(calls.told.at(-1)?.acts.map((act) => act.status)).toEqual([
      "started",
      "waiting",
      "started",
    ]);
    stop();
  });

  it("a queued Cell the server holds is not handed over again, and a later list says what came of it", async () => {
    const { calls, stop } = world();
    const acts = [cell(0), cell(1, { after: [0] }), cell(2, { after: [0] })];
    const held = [
      { i: 0, status: "started" },
      { i: 1, status: "queued" },
      { i: 2, status: "queued" },
    ] as const;
    takeKept("env/aski", [keptPlan("one", acts, held)]);
    await settle();
    expect(calls.queued).toEqual([]);
    takeKept("env/aski", [
      keptPlan("one", acts, [
        held[0],
        { i: 1, status: "failed", reason: "That project isn't here any more." },
        { i: 2, status: "started" },
      ]),
    ]);
    const failed = planOf("one")?.tray?.acts[1];
    expect([failed?.status, failed?.reason]).toEqual([
      "failed",
      "That project isn't here any more.",
    ]);
    expect(statusesOf("one")).toEqual(["started", "failed", "started"]);
    stop();
  });

  it("the server's word never overwrites what the person is acting on here", () => {
    const tray = trayOf(
      planWith("one", [
        cell(0),
        cell(1, { tier: "check", why: ["risky"] }),
        cell(2, { after: [0] }),
      ]),
    );
    const next = withTold(tray, [
      { i: 0, status: "dropped" },
      { i: 1, status: "started" },
      { i: 2, status: "queued" },
    ]);
    expect(next.acts.map((one) => one.status)).toEqual(["starting", "waiting", "queued"]);
  });
});

describe("the most Cells one message starts", () => {
  it("stays between one and the ceiling, whatever was stored", () => {
    expect([capOf(null), capOf("0"), capOf("99"), capOf("words"), capOf("3")]).toEqual([
      6, 1, 12, 6, 3,
    ]);
  });
});
