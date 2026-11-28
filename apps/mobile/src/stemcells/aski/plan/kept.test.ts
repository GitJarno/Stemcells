import { describe, expect, it } from "vite-plus/test";

import type { Plan, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  type KeptPlan,
  PLANS_PATH,
  planWords,
} from "../../../../../../stemcells/orchestrator/wire.ts";
import { makeKept } from "./kept";
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

const keptPlan = (id: string, acts: Plan["acts"], over: Partial<KeptPlan> = {}): KeptPlan => ({
  id,
  at: 1_000,
  messageId: null,
  words: planWords("fix the importer, then write its changelog"),
  plan: { id, dictated: false, pieces: [], acts, talk: [], leftOver: [], from: "read" },
  outcome: null,
  ...over,
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

describe("a chat's plans, read from its machine", () => {
  it("opens each plan as the server has it, and leaves one another device is still carrying out", async () => {
    const trays = makeTrays();
    const asked: string[] = [];
    const told = keptPlan("plan-told", [start(0), start(1, { after: [0] })], {
      messageId: "message-1",
      outcome: [
        { i: 0, status: "started" },
        { i: 1, status: "queued" },
      ],
    });
    const kept = makeKept(
      trays,
      async (environmentId, path) => {
        asked.push(`${environmentId} ${path}`);
        return json({ plans: [keptPlan("plan-untold", [start(0)]), told] });
      },
      () => {},
    );
    await Promise.all([kept.read("mac", "aski chat"), kept.read("mac", "aski chat")]);
    expect(asked).toEqual([`mac ${PLANS_PATH}?thread=aski%20chat`]);
    expect(kept.of("mac", "aski chat").map((plan) => plan.id)).toEqual(["plan-told"]);
    expect(trays.read().has("plan-untold")).toBe(false);
    expect(trays.read().get("plan-told")).toMatchObject({ door: "fence", chatId: "aski chat" });
    expect(
      trays
        .read()
        .get("plan-told")
        ?.tray?.acts.map((one) => one.status),
    ).toEqual(["started", "queued"]);
  });

  it("knows a plan made here before any list has it, and takes the server's word for its queued Cell", async () => {
    const trays = makeTrays();
    const made = keptPlan("plan-here", [start(0), start(1, { after: [0] })]);
    let plans: KeptPlan[] = [];
    const kept = makeKept(
      trays,
      async () => json({ plans }),
      () => {},
    );
    trays.reading("plan-here", "mac", "aski-chat");
    trays.arrived("plan-here", made.plan);
    kept.made("mac", "aski-chat", made);
    await kept.read("mac", "aski-chat");
    const first = kept.of("mac", "aski-chat");
    expect(first.map((plan) => plan.id)).toEqual(["plan-here"]);
    plans = [{ ...made, messageId: "message-1", outcome: [{ i: 1, status: "started" }] }];
    await kept.read("mac", "aski-chat");
    expect(kept.of("mac", "aski-chat")[0]?.messageId).toBe("message-1");
    // Its first Cell is on its way from here; the queued one the server started.
    expect(trays.read().get("plan-here")).toMatchObject({ door: "composer" });
    expect(
      trays
        .read()
        .get("plan-here")
        ?.tray?.acts.map((one) => one.status),
    ).toEqual(["starting", "started"]);
    // A read that says nothing new is the same list: no feed draws again.
    const second = kept.of("mac", "aski-chat");
    await kept.read("mac", "aski-chat");
    expect(kept.of("mac", "aski-chat")).toBe(second);
  });
});
