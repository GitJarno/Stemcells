import { afterEach, describe, expect, it } from "vite-plus/test";

import { clearPlannedRows, plannedRows } from "../../../../../stemcells/aski/planned.ts";
import type { Plan, StartAct } from "../../../../../stemcells/orchestrator/plan.ts";
import { calledBack, send, started, toggle } from "../../../../../stemcells/orchestrator/tray.ts";
import { makeTrays } from "../aski/plan/trays";
import { plannedRowsFeed } from "./planFeed";

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
  place: { id: "mac:p-harbor", name: "Harbor", heard: "Harbor", how: "exact" },
  model: null,
  effort: null,
  risks: [],
  ...over,
});

const plan = (acts: Plan["acts"]): Plan => ({
  id: "plan-1",
  dictated: false,
  pieces: [],
  acts,
  talk: [],
  leftOver: [],
  from: "read",
});

afterEach(() => clearPlannedRows("plan-1"));

describe("the phone's plans in its Awake list", () => {
  it("plans no row for a Cell that waits for Send or was switched off, and Aski throws to each sent one once", () => {
    const trays = makeTrays();
    const thrown: string[][] = [];
    const later: Array<() => void> = [];
    const feed = plannedRowsFeed({
      factsOf: () => ({ modelName: "Fable" }),
      throwTo: (ids) => void thrown.push([...ids]),
      now: () => 5,
      later: (_ms, run) => void later.push(run),
    });
    trays.reading("plan-1", "mac", "aski-chat");
    trays.arrived(
      "plan-1",
      plan([cell(0), cell(1, { tier: "check", why: ["place-near"] }), cell(2)]),
    );
    feed([...trays.read().values()]);
    // A Cell has no row in Awake before it is sent, whatever its tier.
    expect(plannedRows()).toEqual([]);
    expect(thrown).toEqual([]);
    trays.change("plan-1", (tray) => send(toggle(tray, 2)));
    feed([...trays.read().values()]);
    expect(plannedRows().map((row) => [row.threadId, row.projectId])).toEqual([
      ["thread-0", "p-harbor"],
      ["thread-1", "p-harbor"],
    ]);
    trays.change("plan-1", (tray) => started(started(tray, 0, 9), 1, 9));
    feed([...trays.read().values()]);
    expect(thrown).toEqual([["thread-0", "thread-1"]]);
    // Nothing of it is left to show: its rows stay until the list's own have long taken over.
    trays.change("plan-1", (tray) => calledBack(calledBack(tray, 0), 1));
    trays.leave("plan-1");
    expect(trays.read().has("plan-1")).toBe(false);
    feed([...trays.read().values()]);
    expect(plannedRows()).toHaveLength(2);
    for (const run of later) run();
    expect(plannedRows()).toEqual([]);
  });

  it("plans no row for a queued Cell: it is no Cell until the server starts it", () => {
    const trays = makeTrays();
    const feed = plannedRowsFeed({
      factsOf: () => ({ modelName: "Fable" }),
      throwTo: () => {},
      now: () => 5,
      later: () => {},
    });
    trays.reading("plan-1", "mac", "aski-chat");
    trays.arrived(
      "plan-1",
      plan([cell(0), cell(1, { after: [0], afterHeard: "once that's done" })]),
    );
    trays.change("plan-1", send);
    feed([...trays.read().values()]);
    expect(plannedRows().map((row) => row.threadId)).toEqual(["thread-0"]);
  });
});
