import { beforeEach, describe, expect, it } from "vite-plus/test";

import { proposedPlan } from "../../../../../stemcells/orchestrator/check.ts";
import { planOfMessage } from "../../../../../stemcells/orchestrator/wire.ts";
import {
  clearBook,
  expectPlan,
  hydrateBook,
  keptBook,
  markTold,
  newsFor,
  outcomeOf,
  planForMessage,
  planOfId,
  plansOf,
  putPlan,
  setStandings,
  settlePlan,
  standingOf,
  tieMessage,
  unexpectPlan,
} from "./book.ts";
import { entriesOf } from "./Keeper.ts";
import { planReport } from "./note.ts";

const plan = (id: string, cells = 1) =>
  proposedPlan({
    id,
    cells: Array.from({ length: cells }, () => ({
      projectId: "harbor",
      projectName: "Harbor",
      title: "Header",
      words: "Fix the header.",
    })),
    mint: () => "thread-1",
  });

beforeEach(clearBook);

describe("the plan a message to Aski's chat belongs to", () => {
  it("is the one made in that chat from the same words, whitespace and case aside", async () => {
    putPlan({ plan: plan("p1"), text: "Fix  the header", threadId: "aski", at: 1_000 });
    expect((await planForMessage("aski", "fix the header", 2_000))?.plan.id).toBe("p1");
    expect(await planForMessage("other", "fix the header", 2_000)).toBeNull();
    expect(await planForMessage("aski", "fix the footer", 2_000)).toBeNull();
    // Long after, the same words are a new message.
    expect(await planForMessage("aski", "fix the header", 1_000 + 10 * 60_000)).toBeNull();
  });

  it("is waited for while it is being made, so the message can go first", async () => {
    expectPlan({ id: "p2", threadId: "aski", text: "Fix the header", at: 1_000 });
    const found = planForMessage("aski", "Fix the header", 1_500);
    putPlan({ plan: plan("p2"), text: "Fix the header", threadId: "aski", at: 4_000 });
    expect((await found)?.plan.id).toBe("p2");
  });

  it("is none when the plan never comes, or starts nothing", async () => {
    expectPlan({ id: "p3", threadId: "aski", text: "Fix the header", at: 1_000 });
    const found = planForMessage("aski", "Fix the header", 1_500);
    unexpectPlan("p3");
    expect(await found).toBeNull();
    putPlan({ plan: { ...plan("p4"), acts: [] }, text: "hello", threadId: "aski", at: 1_000 });
    expect(await planForMessage("aski", "hello", 1_500)).toBeNull();
  });
});

describe("what came of a plan", () => {
  it("is told act by act, later tellings replacing earlier ones", async () => {
    putPlan({ plan: plan("p5", 2), text: "x", threadId: "aski", at: 1_000 });
    const first = outcomeOf("p5", 5_000);
    settlePlan("p5", [
      { i: 0, status: "started" },
      { i: 1, status: "waiting" },
      { i: 7, status: "started" },
    ]);
    expect(await first).toEqual([
      { i: 0, status: "started" },
      { i: 1, status: "waiting" },
    ]);
    settlePlan("p5", [{ i: 1, status: "dropped" }]);
    expect(await outcomeOf("p5", 5_000)).toEqual([
      { i: 0, status: "started" },
      { i: 1, status: "dropped" },
    ]);
  });

  it("is null after the wait when no client says", async () => {
    putPlan({ plan: plan("p6"), text: "x", threadId: "aski", at: 1_000 });
    expect(await outcomeOf("p6", 10)).toBeNull();
    expect(await outcomeOf("nope", 10)).toBeNull();
  });
});

describe("a plan that is kept", () => {
  it("outlives a restart with what came of it, read back from what was written", () => {
    putPlan({ plan: plan("p7"), text: "Fix the header", threadId: "aski", at: 1_000 });
    settlePlan("p7", [{ i: 0, status: "started" }]);
    tieMessage("p7", "m1");
    const written: unknown = JSON.parse(JSON.stringify(keptBook()));
    clearBook();
    hydrateBook(entriesOf([...(written as unknown[]), { plan: "not a plan" }, null]), 2_000);
    expect(planOfId("p7")?.outcome).toEqual([{ i: 0, status: "started" }]);
    expect(plansOf("aski").map((kept) => [kept.id, kept.messageId])).toEqual([["p7", "m1"]]);
    expect(plansOf("other")).toEqual([]);
  });

  it("is found under its message by the message's id, or by its words and time until it has one", () => {
    putPlan({ plan: plan("p8"), text: "Fix the header", threadId: "aski", at: 10_000 });
    putPlan({ plan: plan("p9"), text: "Fix the header", threadId: "aski", at: 500_000 });
    const message = { id: "m2", text: "fix  the header", at: 11_000 };
    expect(planOfMessage(plansOf("aski"), message)?.id).toBe("p8");
    // Said again later: each message keeps its own plan.
    tieMessage("p8", "m2");
    tieMessage("p9", "m3");
    expect(planOfMessage(plansOf("aski"), message)?.id).toBe("p8");
    expect(planOfMessage(plansOf("aski"), { ...message, id: "m3" })?.id).toBe("p9");
    expect(planOfMessage(plansOf("aski"), { ...message, id: "m4" })).toBeNull();
  });
});

describe("how a plan's Cells stand", () => {
  const landed = {
    threadId: "thread-1",
    stage: "done" as const,
    line: "Header fixed, tests pass.",
    landing: { verdict: "shown" as const, proof: "checks-clean" },
  };

  it("is news to Aski's chat once, when a Cell it started lands or asks", () => {
    putPlan({ plan: plan("p10"), text: "x", threadId: "aski", at: 1_000 });
    settlePlan("p10", [{ i: 0, status: "started" }]);
    setStandings([{ ...landed, stage: "working", line: null, landing: null }]);
    expect(newsFor("aski", 2_000)).toEqual([]);
    setStandings([landed]);
    expect(newsFor("other", 2_000)).toEqual([]);
    expect(newsFor("aski", 2_000).map((one) => one.standing.stage)).toEqual(["done"]);
    expect(newsFor("aski", 3_000)).toEqual([]);
    setStandings([{ ...landed, stage: "needs-you", landing: null }]);
    expect(newsFor("aski", 4_000).map((one) => one.standing.stage)).toEqual(["needs-you"]);
  });

  it("is no news once Aski read the plan, nor for a Cell that never started", () => {
    putPlan({ plan: plan("p11"), text: "x", threadId: "aski", at: 1_000 });
    setStandings([landed]);
    expect(newsFor("aski", 2_000)).toEqual([]);
    settlePlan("p11", [{ i: 0, status: "started" }]);
    markTold(planOfId("p11")!);
    expect(newsFor("aski", 2_000)).toEqual([]);
  });

  it("stands in Aski's report beside what started, the Cell's own word quoted as its own", () => {
    putPlan({ plan: plan("p12"), text: "x", threadId: "aski", at: 1_000 });
    setStandings([landed]);
    const report = planReport(planOfId("p12")!.plan, [{ i: 0, status: "started" }], standingOf);
    expect(report).toContain("Now: landed, and a check or its pull request shows it");
    expect(report).toContain("It says: “Header fixed, tests pass.”");
  });
});
