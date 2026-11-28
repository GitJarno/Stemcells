import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { clearPlannedRows, plannedRows } from "../../../../../../stemcells/aski/planned.ts";
import type { DestroyAct, Plan, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { send, trayOf } from "../../../../../../stemcells/orchestrator/tray.ts";
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
    /** Those of them handed over to start at once. */
    atOnce: [] as string[],
    /** Cells said to open no tab. */
    tabless: [] as string[],
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
    onAskisServer: () => true,
    queue: async (_planId, act, _projectKey, now) => {
      calls.queued.push(act.threadId);
      if (now) calls.atOnce.push(act.threadId);
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
    tabless: (threadIds) => void calls.tabless.push(...threadIds),
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
  it("starts nothing before Send, and gives Awake no row for a Cell that waits", async () => {
    const { calls, runner, stop } = world();
    beginPlan("one", "env/aski", 1);
    planRead(
      "one",
      planWith("one", [cell(0), cell(1), cell(2, { tier: "check", why: ["place-near"] })]),
    );
    await settle();
    runner.sync();
    await settle();
    // However sure the plan is of a Cell, it is a task until the person sends it.
    expect(calls.started).toEqual([]);
    expect(statusesOf("one")).toEqual(["waiting", "waiting", "waiting"]);
    expect(calls.told.at(-1)?.acts.map((act) => act.status)).toEqual([
      "waiting",
      "waiting",
      "waiting",
    ]);
    expect(plannedRows()).toEqual([]);
    stop();
  });

  it("Send starts each Cell left on once, and never one switched off", async () => {
    const { calls, runner, stop } = world();
    beginPlan("one", "env/aski", 1);
    planRead("one", planWith("one", [cell(0), cell(1), cell(2)]));
    await settle();
    runner.toggle("one", 1);
    runner.send("one");
    await settle();
    runner.sync();
    runner.send("one");
    await settle();
    expect(calls.started).toEqual(["thread-0", "thread-2"]);
    expect(statusesOf("one")).toEqual(["started", "dropped", "started"]);
    // Aski's line reads what really happened, and Awake forms a row only for what was sent.
    expect(calls.told.at(-1)?.acts.map((act) => act.status)).toEqual([
      "started",
      "dropped",
      "started",
    ]);
    expect(plannedRows().map((row) => row.threadId)).toEqual(["thread-0", "thread-2"]);
    stop();
  });

  it("Send is all or nothing: a Cell with no project holds every Cell until it has one or is off", async () => {
    const { calls, runner, stop } = world();
    beginPlan("two", "env/aski", 1);
    planRead(
      "two",
      planWith("two", [cell(0), cell(1, { tier: "check", why: ["place-open"], place: null })]),
    );
    await settle();
    runner.send("two");
    await settle();
    expect(calls.started).toEqual([]);
    expect(statusesOf("two")).toEqual(["waiting", "waiting"]);
    runner.toggle("two", 1);
    runner.send("two");
    await settle();
    expect(calls.started).toEqual(["thread-0"]);
    stop();
  });

  it("deletes nothing on Send: only the hold's own call removes the project, and it comes first", async () => {
    const { calls, runner, stop } = world();
    beginPlan("three", "env/aski", 1);
    planRead(
      "three",
      planWith("three", [removal(0), cell(1, { tier: "check", why: ["after-hold"] })]),
    );
    await settle();
    runner.send("three");
    await settle();
    // While the deletion is held, Send starts nothing and deletes nothing.
    expect(calls.removed).toEqual([]);
    expect(calls.started).toEqual([]);
    // Two holds landing together delete once.
    await Promise.all([runner.destroy("three", 0), runner.destroy("three", 0)]);
    expect(calls.removed).toEqual(["atlas"]);
    expect(planOf("three")?.tray?.acts[0]?.status).toBe("done");
    runner.send("three");
    await settle();
    expect(calls.started).toEqual(["thread-1"]);
    // A second call deletes nothing again.
    await runner.destroy("three", 0);
    expect(calls.removed).toEqual(["atlas"]);
    stop();
  });

  it("a deletion the person drops frees Send, and is never carried out", async () => {
    const { calls, runner, stop } = world();
    beginPlan("three", "env/aski", 1);
    planRead("three", planWith("three", [removal(0), cell(1)]));
    await settle();
    runner.drop("three", 0);
    await runner.destroy("three", 0);
    runner.send("three");
    await settle();
    expect(calls.removed).toEqual([]);
    expect(statusesOf("three")).toEqual(["dropped", "started"]);
    stop();
  });

  it("Enter and Esc reach only a message's own plan; a plan Aski proposed is sent by its button", async () => {
    const { calls, runner, stop } = world();
    adoptPlan("env/aski", trayOf(planWith("one", [cell(0, { why: ["proposed"] })])), 1);
    await settle();
    // The keys find no plan: `AskiPlans.tsx` sends and cancels only what this names.
    expect(runner.waitingIn("env/aski")).toBeNull();
    expect(calls.started).toEqual([]);
    beginPlan("two", "env/aski", 2);
    planRead("two", planWith("two", [cell(1, { tier: "check", why: ["place-near"] })]));
    await settle();
    expect(runner.waitingIn("env/aski")).toBe("two");
    expect(runner.waitingIn("env/other")).toBeNull();
    expect(calls.started).toEqual([]);
    runner.send("one");
    await settle();
    expect(calls.started).toEqual(["thread-0"]);
    // Sent, the message's plan no longer takes the keys.
    runner.send("two");
    await settle();
    expect(runner.waitingIn("env/aski")).toBeNull();
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
    runner.send("four");
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
    planRead(
      "one",
      planWith("one", [cell(0), cell(1, { after: [0], afterHeard: "once that's done" })]),
    );
    runner.send("one");
    await settle();
    runner.sync();
    runner.sync();
    await settle();
    expect(calls.started).toEqual(["thread-0"]);
    expect(calls.queued).toEqual(["thread-1"]);
    expect(statusesOf("one")).toEqual(["started", "queued"]);
    expect(calls.told.at(-1)?.acts.map((act) => act.status)).toEqual(["started", "queued"]);
    // Whenever the server starts it, it opens no tab: said while it is still queued.
    expect(calls.tabless).toEqual(["thread-1"]);
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
    planRead(
      "one",
      planWith("one", [
        cell(0),
        cell(1, { after: [0], afterHeard: "once that's done", title: "Refused" }),
      ]),
    );
    runner.send("one");
    await settle();
    const refused = planOf("one")?.tray?.acts[1];
    expect([refused?.status, refused?.reason]).toEqual([
      "failed",
      "A deletion of this plan still waits for your hand.",
    ]);
    stop();
  });

  it("has the server start a queued Cell at once on Start now, where the Cell before it works", async () => {
    const { calls, runner, stop } = world();
    beginPlan("two", "env/aski", 2);
    planRead(
      "two",
      planWith("two", [cell(2), cell(3, { after: [2], afterHeard: "once that's done" })]),
    );
    runner.send("two");
    await settle();
    runner.startNow("two", 3);
    await settle();
    expect(statusesOf("two")).toEqual(["started", "started"]);
    expect(calls.atOnce).toEqual(["thread-3"]);
    expect(calls.started).toEqual(["thread-2"]);
    stop();
  });

  it("leaves a Cell that gets its own worktree to the server, and never tells it started before it has", async () => {
    const { calls, runner, stop } = world();
    beginPlan("one", "env/aski", 1);
    planRead("one", planWith("one", [cell(0, { apart: true }), cell(1, { apart: false })]));
    runner.send("one");
    await settle();
    expect(calls.queued).toEqual(["thread-0"]);
    expect(calls.started).toEqual(["thread-1"]);
    // The first word after Send: the worktree's Cell is the server's to start, never "started" yet.
    expect(
      calls.told.find((told) => told.acts.every((act) => act.status !== "waiting"))?.acts,
    ).toMatchObject([{ status: "queued" }, { status: "started" }]);
    expect(statusesOf("one")).toEqual(["started", "started"]);
    stop();
  });
});

describe("a plan under its message", () => {
  it("a message's plan stays over the composer until it is sent, then stands under its message", async () => {
    vi.useFakeTimers();
    const { runner, stop } = world();
    beginPlan("one", "env/aski", 1, "Fix the importer");
    planRead("one", planWith("one", [cell(0)]));
    await settle();
    // It waits on the person there, however long they take.
    vi.advanceTimersByTime(60_000);
    expect(planOf("one")?.source).toBe("message");
    runner.send("one");
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

  it("a plan read from the server starts nothing; what still waits starts on the person's Send", async () => {
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
    // The Cell nothing was told of waits for Send, as the one that waited does.
    expect(statusesOf("one")).toEqual(["started", "waiting", "waiting"]);
    expect([calls.started, calls.told, plannedRows()]).toEqual([[], [], []]);
    // Under its message it is no plan for Enter: its card's Send is the only way.
    expect(runner.waitingIn("env/aski")).toBeNull();
    // Another window started one of them meanwhile: Send here doesn't start it twice.
    calls.listed.add("thread-1");
    runner.send("one");
    await settle();
    expect(calls.started).toEqual(["thread-2"]);
    expect(calls.told.at(-1)?.acts.map((act) => act.status)).toEqual([
      "started",
      "started",
      "started",
    ]);
    expect(planOf("one")?.tray?.acts[1]).toMatchObject({ status: "started" });
    expect(planOf("one")?.tray?.acts[1]?.startedAt).toBeUndefined();
    stop();
  });

  it("a queued Cell the server holds is not handed over again, and a later list says what came of it", async () => {
    const { calls, stop } = world();
    const acts = [
      cell(0),
      cell(1, { after: [0], afterHeard: "once that's done" }),
      cell(2, { after: [0], afterHeard: "once that's done" }),
    ];
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
    const plan = planWith("one", [
      cell(0),
      cell(1),
      cell(2, { after: [0], afterHeard: "once that's done" }),
    ]);
    const told = [
      { i: 0, status: "dropped" },
      { i: 1, status: "started" },
      { i: 2, status: "started" },
    ] as const;
    // Before Send every Cell is the person's to send; sent, only the one the server holds is its to say.
    expect(withTold(trayOf(plan), told).acts.map((one) => one.status)).toEqual([
      "waiting",
      "waiting",
      "waiting",
    ]);
    expect(withTold(send(trayOf(plan)), told).acts.map((one) => one.status)).toEqual([
      "starting",
      "starting",
      "started",
    ]);
  });
});
