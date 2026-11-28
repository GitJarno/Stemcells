import { describe, expect, it } from "vite-plus/test";

import type { DestroyAct, Plan, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { confirm, drop } from "../../../../../../stemcells/orchestrator/tray.ts";
import type { OutcomeRequest } from "../../../../../../stemcells/orchestrator/wire.ts";
import { carry, type Hands, type Went } from "./carry";
import { makeTrays } from "./trays";

const start = (i: number, over: Partial<StartAct> = {}): StartAct => ({
  kind: "start",
  i,
  pieces: [i + 1],
  tier: "start",
  why: [],
  threadId: `thread-${i}`,
  title: `Task ${i}`,
  words: `do task ${i}`,
  note: null,
  place: { id: "mac:p-harbor", name: "Harbor", heard: "Harbor", how: "exact" },
  model: null,
  effort: null,
  risks: [],
  ...over,
});

const destroy = (i: number): DestroyAct => ({
  kind: "destroy",
  i,
  pieces: [i + 1],
  tier: "hold",
  why: [],
  target: "project",
  place: { id: "mac:p-atlas", name: "Atlas", heard: "Atlas", how: "exact" },
  cells: [],
  words: "delete the Atlas project",
});

const planOf = (acts: Plan["acts"], from: Plan["from"] = "read"): Plan => ({
  id: "plan-1",
  dictated: false,
  pieces: [],
  acts,
  talk: [],
  leftOver: [],
  from,
});

/** Hands that log what they were asked; timers run when the test says. */
function world() {
  const trays = makeTrays();
  const log: string[] = [];
  const told: OutcomeRequest[] = [];
  const timers: Array<{ at: number; run: () => void; off: boolean }> = [];
  let clock = 1_000;
  /** The chats on the machine, and who watches them. */
  const cells = new Set<string>();
  const watchers = new Set<() => void>();
  const appear = (threadId: string) => {
    cells.add(threadId);
    for (const run of watchers) run();
  };
  const hands: Hands = {
    queue: async (_environmentId, planId, act, projectId, now) => {
      log.push(`queue ${act.threadId} of ${planId} in ${projectId}${now ? " now" : ""}`);
      return { ok: true };
    },
    wantsWorktree: (_environmentId, act) => act.apart === true,
    exists: (_environmentId, threadId) => cells.has(threadId),
    watch: (run) => {
      watchers.add(run);
      return () => void watchers.delete(run);
    },
    start: async (_environmentId, act, projectId) => {
      log.push(`start ${act.threadId} in ${projectId}`);
      return { ok: true };
    },
    create: async (_environmentId, name) => {
      log.push(`create ${name}`);
      return { ok: true, projectId: "p-new" };
    },
    destroy: async (_environmentId, act) => {
      log.push(`destroy ${act.place?.name}`);
      return { ok: true };
    },
    callBack: async (_environmentId, threadId) => void log.push(`call back ${threadId}`),
    tell: async (_environmentId, outcome) => void told.push(outcome),
    rows: () => {},
    now: () => clock,
    later: (ms, run) => {
      const timer = { at: clock + ms, run, off: false };
      timers.push(timer);
      return () => {
        timer.off = true;
      };
    },
  };
  const advance = (ms: number) => {
    clock += ms;
    for (const timer of timers.splice(0)) {
      if (timer.off) continue;
      if (timer.at <= clock) timer.run();
      else timers.push(timer);
    }
  };
  const statuses = () =>
    trays
      .read()
      .get("plan-1")
      ?.tray?.acts.map((one) => one.status) ?? [];
  /** Resolves on the store change that leaves the plan's acts standing as `want`. */
  const until = (...want: string[]) =>
    new Promise<void>((resolve) => {
      const reached = () => statuses().join() === want.join();
      if (reached()) return resolve();
      const off = trays.subscribe(() => {
        if (!reached()) return;
        off();
        resolve();
      });
    });
  return {
    trays,
    hands,
    log,
    told,
    advance,
    until,
    statuses,
    appear,
    watchers,
    carrier: carry(trays, hands),
  };
}

const statuses = (w: ReturnType<typeof world>) => w.statuses();

describe("carrying a plan out", () => {
  it("starts each Cell once, however often the tray changes, and stays where the person is", async () => {
    const w = world();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0), start(1, { tier: "check", why: ["place-near"] })]));
    // The store changes again while the first Cell is still on its way.
    w.trays.refuse("plan-1", 9, "unrelated");
    await w.until("started", "waiting");
    expect(w.log).toEqual(["start thread-0 in p-harbor"]);
    w.trays.change("plan-1", (tray) => confirm(tray, 1));
    await w.until("started", "started");
    expect(w.log).toEqual(["start thread-0 in p-harbor", "start thread-1 in p-harbor"]);
    expect(statuses(w)).toEqual(["started", "started"]);
  });

  it("makes a new project once, then starts its Cells in it", async () => {
    const w = world();
    const place = { id: null, name: "Otter Docs", heard: "otter docs", how: "new" as const };
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived(
      "plan-1",
      planOf([
        start(0, { tier: "check", why: ["new-project"], place }),
        start(1, { tier: "check", why: ["new-project"], place }),
      ]),
    );
    expect(w.log).toEqual([]);
    w.trays.change("plan-1", (tray) => confirm(confirm(tray, 0), 1));
    await w.until("started", "started");
    expect(w.log).toEqual([
      "create Otter Docs",
      "start thread-0 in p-new",
      "start thread-1 in p-new",
    ]);
  });

  it("says why a Cell didn't start", async () => {
    const w = world();
    const failing = carry(w.trays, {
      ...w.hands,
      start: async () => ({ ok: false, reason: "Sol 6.1 can’t start now." }),
    });
    w.carrier.stop();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0)]));
    await w.until("failed");
    expect(w.trays.read().get("plan-1")?.tray?.acts[0]).toMatchObject({
      status: "failed",
      reason: "Sol 6.1 can’t start now.",
    });
    failing.stop();
  });

  it("tells the server once per burst of changes what came of each act", async () => {
    const w = world();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0), start(1, { tier: "check", why: ["risky"] })]));
    await w.until("started", "waiting");
    w.advance(200);
    expect(w.told).toEqual([
      {
        id: "plan-1",
        acts: [
          { i: 0, status: "started" },
          { i: 1, status: "waiting" },
        ],
      },
    ]);
    w.trays.change("plan-1", (tray) => drop(tray, 1));
    w.advance(200);
    expect(w.told.at(-1)?.acts).toEqual([
      { i: 0, status: "started" },
      { i: 1, status: "dropped" },
    ]);
    expect(w.told).toHaveLength(2);
  });

  it("never deletes from a plan arriving or changing: only from the hold's own call", async () => {
    const w = world();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived(
      "plan-1",
      planOf([destroy(0), start(1, { tier: "check", why: ["after-hold"] })]),
    );
    // A tap's worth of everything a tray can be told: nothing is deleted, and nothing starts.
    w.trays.change("plan-1", (tray) => confirm(tray, 0));
    w.trays.change("plan-1", (tray) => confirm(tray, 1));
    expect(w.log).toEqual([]);
    expect(statuses(w)).toEqual(["waiting", "waiting"]);
    await w.carrier.destroy("plan-1", 0);
    expect(w.log).toEqual(["destroy Atlas"]);
    expect(statuses(w)).toEqual(["done", "waiting"]);
    // With the deletion dealt with, the Cell after it can start.
    w.trays.change("plan-1", (tray) => confirm(tray, 1));
    await w.until("done", "started");
    expect(w.log).toEqual(["destroy Atlas", "start thread-1 in p-harbor"]);
  });

  it("keeps a deletion waiting, with its reason, when it doesn't go", async () => {
    const w = world();
    w.carrier.stop();
    const refusing = carry(w.trays, {
      ...w.hands,
      destroy: async () => ({ ok: false, reason: "Otter is flying. Stop it first." }),
    });
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([destroy(0)]));
    await refusing.destroy("plan-1", 0);
    expect(statuses(w)).toEqual(["waiting"]);
    expect(w.trays.read().get("plan-1")?.refused.get(0)).toBe("Otter is flying. Stop it first.");
    refusing.stop();
  });

  it("calls back the one Cell asked for, and the plan leaves the composer for its message once it is over", async () => {
    const w = world();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0), start(1)]));
    await w.until("started", "started");
    w.advance(4_000);
    await w.carrier.callBack("plan-1", 1);
    expect(w.log.at(-1)).toBe("call back thread-1");
    expect(statuses(w)).toEqual(["started", "called-back"]);
    w.advance(10_000);
    // A Cell is left to show: the same plan stands under its message.
    expect(w.trays.read().get("plan-1")).toMatchObject({ door: "fence" });
    expect(statuses(w)).toEqual(["started", "called-back"]);
  });

  it("keeps a plan with a Cell that didn't start until the person closes it", async () => {
    const w = world();
    const failing = carry(w.trays, {
      ...w.hands,
      start: async () => ({ ok: false, reason: "Harbor isn’t here any more." }),
    });
    w.carrier.stop();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0)]));
    await w.until("failed");
    w.advance(60_000);
    expect(w.trays.read().has("plan-1")).toBe(true);
    failing.stop();
  });

  it("hands a Cell that comes after another to the server once, and it stays queued", async () => {
    const w = world();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0), start(1, { after: [0] })]));
    w.trays.refuse("plan-1", 9, "unrelated");
    await w.until("started", "queued");
    expect(w.log).toEqual(["start thread-0 in p-harbor", "queue thread-1 of plan-1 in p-harbor"]);
    // The queued Cell is the server's to report: word of it from here could undo its start.
    w.advance(200);
    expect(w.told).toEqual([{ id: "plan-1", acts: [{ i: 0, status: "started" }] }]);
    // The Cell before it started, so the plan leaves the composer for its message.
    w.advance(12_000);
    expect(w.trays.read().get("plan-1")).toMatchObject({ door: "fence" });
    expect(statuses(w)).toEqual(["started", "queued"]);
    expect(w.log).toHaveLength(2);
  });

  it("says why a queued Cell couldn't be handed over", async () => {
    const w = world();
    w.carrier.stop();
    const refusing = carry(w.trays, {
      ...w.hands,
      queue: async () => ({ ok: false, reason: "A deletion of this plan still waits." }),
    });
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0), start(1, { after: [0] })]));
    await w.until("started", "failed");
    expect(w.trays.read().get("plan-1")?.tray?.acts[1]).toMatchObject({
      status: "failed",
      reason: "A deletion of this plan still waits.",
    });
    w.advance(200);
    expect(w.told.at(-1)?.acts[1]).toMatchObject({ i: 1, status: "failed" });
    refusing.stop();
  });

  it("has the server start a Cell that gets a worktree of its own, and never starts it here", async () => {
    const w = world();
    w.carrier.stop();
    let land = (_went: Went) => {};
    const slow = carry(w.trays, {
      ...w.hands,
      queue: (_environmentId, planId, act, projectId) => {
        w.log.push(`queue ${act.threadId} of ${planId} in ${projectId}`);
        return new Promise((resolve) => {
          land = resolve;
        });
      },
    });
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0, { apart: true }), start(1)]));
    await w.until("starting", "started");
    expect(w.log).toEqual(["queue thread-0 of plan-1 in p-harbor", "start thread-1 in p-harbor"]);
    // Told while the server is at it: nothing of the Cell in its hands.
    w.advance(200);
    expect(w.told).toEqual([{ id: "plan-1", acts: [{ i: 1, status: "started" }] }]);
    land({ ok: true });
    await w.until("started", "started");
    w.advance(200);
    expect(w.told.at(-1)?.acts).toEqual([
      { i: 0, status: "started" },
      { i: 1, status: "started" },
    ]);
    slow.stop();
  });

  it("has the server start a queued Cell at once when the person won't wait, where the Cell before it works", async () => {
    const w = world();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0), start(1, { after: [0] })]));
    await w.until("started", "queued");
    w.carrier.startNow("plan-1", 1);
    await w.until("started", "started");
    // The phone starts nothing itself: the server knows the worktree of the Cell before it.
    expect(w.log.filter((line) => line.startsWith("start"))).toEqual([
      "start thread-0 in p-harbor",
    ]);
    expect(w.log.at(-1)).toBe("queue thread-1 of plan-1 in p-harbor now");
    w.advance(200);
    expect(w.told.at(-1)?.acts).toEqual([
      { i: 0, status: "started" },
      { i: 1, status: "started" },
    ]);
  });

  it("takes a queued Cell the machine lists as started, and stops watching once none is queued", async () => {
    const w = world();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([start(0), start(1, { after: [0] })]));
    await w.until("started", "queued");
    expect(w.watchers.size).toBe(1);
    w.appear("thread-9");
    expect(statuses(w)).toEqual(["started", "queued"]);
    w.appear("thread-1");
    expect(statuses(w)).toEqual(["started", "started"]);
    expect(w.watchers.size).toBe(0);
    w.advance(200);
    expect(w.told.at(-1)?.acts).toEqual([
      { i: 0, status: "started" },
      { i: 1, status: "started" },
    ]);
  });

  it("carries a plan read from the server on from where it stands: its queued Cell is not handed over again, and a waiting one starts by a tap", async () => {
    const w = world();
    const plan = planOf([
      start(0),
      start(1, { after: [0] }),
      start(2, { tier: "check", why: ["risky"] }),
    ]);
    w.trays.opened(
      "plan-1",
      "mac",
      plan,
      [
        { i: 0, status: "started" },
        { i: 1, status: "queued" },
        { i: 2, status: "waiting" },
      ],
      "aski-chat",
    );
    w.advance(200);
    expect(w.log).toEqual([]);
    expect(w.told).toEqual([]);
    w.trays.change("plan-1", (tray) => confirm(tray, 2));
    await w.until("started", "queued", "started");
    expect(w.log).toEqual(["start thread-2 in p-harbor"]);
    w.advance(200);
    expect(w.told.at(-1)?.acts).toEqual([
      { i: 0, status: "started" },
      { i: 2, status: "started" },
    ]);
  });

  it("lets a message Aski couldn't read as Cells stand briefly, then go", () => {
    const w = world();
    w.trays.reading("plan-1", "mac", "aski-chat");
    w.trays.arrived("plan-1", planOf([], "floor"));
    expect(w.trays.read().get("plan-1")?.state).toBe("floor");
    w.advance(6_000);
    expect(w.trays.read().has("plan-1")).toBe(false);
  });
});
