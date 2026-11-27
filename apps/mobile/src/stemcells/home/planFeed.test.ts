import { afterEach, describe, expect, it } from "vite-plus/test";

import { clearPlannedRows, plannedRows } from "../../../../../stemcells/aski/planned.ts";
import type { Plan, StartAct } from "../../../../../stemcells/orchestrator/plan.ts";
import { started } from "../../../../../stemcells/orchestrator/tray.ts";
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
  it("plans a row per Cell on its way or waiting, and Aski throws to each starting one once", () => {
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
      plan([
        cell(0),
        cell(1, { tier: "check", why: ["place-near"] }),
        // No project yet: it waits in the plan, not in a project's list.
        cell(2, { tier: "check", why: ["place-open"], place: null }),
      ]),
    );
    feed([...trays.read().values()]);
    expect(plannedRows().map((row) => [row.threadId, row.projectId, row.tier, row.unsure])).toEqual([
      ["thread-0", "p-harbor", "start", undefined],
      ["thread-1", "p-harbor", "check", "place"],
    ]);
    trays.change("plan-1", (tray) => started(tray, 0, 9));
    feed([...trays.read().values()]);
    expect(thrown).toEqual([["thread-0"]]);
    // The plan left: its rows stay until the list's own have long taken over.
    trays.leave("plan-1");
    feed([...trays.read().values()]);
    expect(plannedRows()).toHaveLength(2);
    for (const run of later) run();
    expect(plannedRows()).toEqual([]);
  });
});
