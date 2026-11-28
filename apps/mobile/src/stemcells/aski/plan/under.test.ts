import { describe, expect, it } from "vite-plus/test";

import type { Plan, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { dropAll, started } from "../../../../../../stemcells/orchestrator/tray.ts";
import { type KeptPlan, planWords } from "../../../../../../stemcells/orchestrator/wire.ts";
import { RECALL_NOTE } from "../../recall/feed";
import { type MessageEntry, noteUnder, type ThreadFeedEntry } from "../../upstream/recallFeed";
import { makeTrays } from "./trays";
import { plansUnder, withPlans } from "./under";

const PLAN = "0b5c2f8e-3d41-4a8e-9a57-6f1f1c2d3e4a";
const OTHER = "7e1d9c2a-5b64-4f0e-8c13-2a9b8d7c6e5f";

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

const planOf = (id: string, acts: Plan["acts"], from: Plan["from"] = "read"): Plan => ({
  id,
  dictated: false,
  pieces: [],
  acts,
  talk: [],
  leftOver: [],
  from,
});

const message = (id: string, role: "user" | "assistant", text: string, at: string) =>
  ({
    type: "message",
    id,
    createdAt: at,
    message: {
      id,
      role,
      text,
      attachments: [],
      runId: null,
      streaming: false,
      createdAt: at,
      updatedAt: at,
    },
  }) as unknown as MessageEntry;

const ASKED = "Fix the importer in Harbor, then write its changelog";
const ask = message("message-ask", "user", ASKED, "2026-11-27T10:00:00.000Z");
const pills = noteUnder(ask, RECALL_NOTE, "[Importer](t3-thread://v2/mac/thread-importer)");
const feed: ThreadFeedEntry[] = [
  message("message-before", "user", "what flew yesterday?", "2026-11-27T09:00:00.000Z"),
  message("message-told", "assistant", "Otter and Finch.", "2026-11-27T09:00:05.000Z"),
  ask,
  pills,
  message("message-reply", "assistant", "Two Cells are on it.", "2026-11-27T10:00:04.000Z"),
];

const kept = (id: string, plan: Plan, over: Partial<KeptPlan> = {}): KeptPlan => ({
  id,
  at: Date.parse("2026-11-27T10:00:02.000Z"),
  messageId: null,
  words: planWords(ASKED),
  plan,
  outcome: null,
  ...over,
});

const texts = (entries: ReadonlyArray<ThreadFeedEntry>) =>
  entries.map((entry) => (entry.type === "message" ? entry.message.text : entry.type));

describe("a plan's card in Aski's chat", () => {
  it("stands under the message it was made from, after the Cells the question found, once it left the composer", () => {
    const trays = makeTrays();
    const plan = planOf(PLAN, [start(0), start(1, { after: [0] })]);
    const plans = [kept(PLAN, plan)];
    trays.reading(PLAN, "mac", "aski-chat");
    trays.arrived(PLAN, plan);
    // Over the composer it is the tray's alone.
    expect(plansUnder(feed, plans, trays.read())).toEqual([]);
    trays.change(PLAN, (tray) => started(tray, 0, 5));
    trays.leave(PLAN);
    const shown = plansUnder(feed, plans, trays.read());
    expect(shown).toEqual([["message-ask", PLAN]]);
    const made = new Map();
    const fed = withPlans(feed, new Map(shown), made);
    expect(texts(fed)).toEqual([
      "what flew yesterday?",
      "Otter and Finch.",
      ASKED,
      "[Importer](t3-thread://v2/mac/thread-importer)",
      `\`\`\`plan\n${PLAN}\n\`\`\``,
      "Two Cells are on it.",
    ]);
    // Drawn again it is the same row, and with no card the feed itself.
    expect(withPlans(feed, new Map(shown), made)[4]).toBe(fed[4]);
    expect(withPlans(feed, new Map(), made)).toBe(feed);
  });

  it("goes by the message the server tied, and shows no card for a plan with no Cell left or one Aski proposed", () => {
    const trays = makeTrays();
    const tied = planOf(PLAN, [start(0)]);
    const proposed = planOf(OTHER, [start(0, { tier: "check", why: ["proposed"] })], "proposed");
    const plans = [
      // Other words, long before: only the server's tie says it is this message's.
      kept(PLAN, tied, { messageId: "message-before", words: "something else", at: 5 }),
      kept(OTHER, proposed),
    ];
    trays.opened(PLAN, "mac", tied, [{ i: 0, status: "started" }], "aski-chat");
    trays.opened(OTHER, "mac", proposed, null, "aski-chat");
    expect(plansUnder(feed, plans, trays.read())).toEqual([["message-before", PLAN]]);
    trays.change(PLAN, (tray) => ({
      ...tray,
      acts: tray.acts.map((one) => ({ ...one, status: "called-back" as const })),
    }));
    expect(plansUnder(feed, plans, trays.read())).toEqual([]);
    trays.change(OTHER, dropAll);
    expect(plansUnder(feed, plans, trays.read())).toEqual([]);
  });
});
