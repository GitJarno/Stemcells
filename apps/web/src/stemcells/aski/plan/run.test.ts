import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { clearPlannedRows, plannedRows } from "../../../../../../stemcells/aski/planned.ts";
import type {
  DestroyAct,
  Plan,
  StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import { createRunner, type RunnerHands } from "./run";
import { beginPlan, clearPlans, planOf, planRead, subscribePlans } from "./store";
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
    made: [] as string[],
    removed: [] as string[],
    told: [] as Array<{ id: string; acts: ReadonlyArray<{ i: number; status: string }> }>,
  };
  const hands: RunnerHands = {
    start: async (act) => {
      calls.started.push(act.threadId);
      return act.title === "Fails" ? { ok: false, error: "No model." } : { ok: true };
    },
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const id of ["one", "two", "three", "four"]) clearPlannedRows(id);
  clearPlans();
  vi.useRealTimers();
});

describe("carrying a plan out", () => {
  it("starts each Cell of the Start tier once, however often the store changes", async () => {
    const { calls, stop } = world();
    beginPlan("one", "env/aski", 1);
    planRead("one", planWith("one", [cell(0), cell(1), cell(2, { tier: "check", why: ["place-near"] })]));
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
    await runner.destroy("three", 0);
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

describe("the most Cells one message starts", () => {
  it("stays between one and the ceiling, whatever was stored", () => {
    expect([capOf(null), capOf("0"), capOf("99"), capOf("words"), capOf("3")]).toEqual([
      6, 1, 12, 6, 3,
    ]);
  });
});
