import { describe, expect, it } from "vite-plus/test";

import type { Plan, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { dropAll, send, started, toggle } from "../../../../../../stemcells/orchestrator/tray.ts";
import { makeTrays, overComposer, toldOver } from "./trays";

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

/** A Cell the person said comes after the first. */
const AFTER = { after: [0], afterHeard: "once that's done" } as const;

const planOf = (acts: Plan["acts"]): Plan => ({
  id: "plan-1",
  dictated: false,
  pieces: [],
  acts,
  talk: [],
  leftOver: [],
  from: "read",
});

const statuses = (trays: ReturnType<typeof makeTrays>) =>
  trays
    .read()
    .get("plan-1")
    ?.tray?.acts.map((one) => one.status);

describe("the phone's plans", () => {
  it("keeps a plan that leaves the composer with a Cell to show, as the same entry under its message", () => {
    const trays = makeTrays();
    trays.reading("plan-1", "mac", "aski-chat");
    trays.arrived("plan-1", planOf([start(0), start(1, { tier: "check", why: ["risky"] })]));
    trays.change("plan-1", (tray) => started(send(toggle(tray, 1)), 0, 5));
    trays.leave("plan-1");
    expect(trays.read().get("plan-1")).toMatchObject({ door: "fence", chatId: "aski-chat" });
    expect(statuses(trays)).toEqual(["started", "dropped"]);
    expect(overComposer(trays.read(), "mac", "aski-chat")).toEqual([]);
    // Read again from the server, the live plan stays as it is.
    trays.opened("plan-1", "mac", planOf([start(0)]), null, "aski-chat");
    expect(statuses(trays)).toEqual(["started", "dropped"]);
  });

  it("forgets a plan that leaves the composer with nothing to show", () => {
    const trays = makeTrays();
    trays.reading("plan-1", "mac", "aski-chat");
    trays.arrived("plan-1", planOf([start(0, { tier: "check", why: ["risky"] })]));
    trays.change("plan-1", dropAll);
    trays.leave("plan-1");
    expect(trays.read().has("plan-1")).toBe(false);
  });

  it("makes every Cell of a plan wait as it arrives, whatever its tier", () => {
    const trays = makeTrays();
    trays.reading("plan-1", "mac", "aski-chat");
    trays.arrived("plan-1", planOf([start(0), start(1, { tier: "check", why: ["risky"] })]));
    expect(statuses(trays)).toEqual(["waiting", "waiting"]);
  });

  it("starts nothing by reading a plan: a Cell the server wasn't told of waits", () => {
    const trays = makeTrays();
    trays.opened("plan-1", "mac", planOf([start(0), start(1)]), [{ i: 1, status: "started" }]);
    expect(statuses(trays)).toEqual(["waiting", "started"]);
  });

  it("takes the server's word only for the Cells it holds queued", () => {
    const trays = makeTrays();
    trays.reading("plan-1", "mac", "aski-chat");
    trays.arrived("plan-1", planOf([start(0), start(1, AFTER), start(2, AFTER), start(3, AFTER)]));
    trays.change("plan-1", send);
    const before = trays.read().get("plan-1")!.tray!;
    const after = toldOver(before, [
      // On its way here: the server's "started" is this phone's own word come back.
      { i: 0, status: "failed", reason: "stale" },
      { i: 1, status: "started" },
      { i: 2, status: "failed", reason: "Harbor is no repository." },
      { i: 3, status: "queued" },
    ]);
    expect(after.acts.map((one) => one.status)).toEqual([
      "starting",
      "started",
      "failed",
      "queued",
    ]);
    expect(after.acts[2]?.reason).toBe("Harbor is no repository.");
    // Nothing new is the same tray: no view draws and no one is told.
    expect(toldOver(after, [{ i: 3, status: "queued" }])).toBe(after);
  });
});
