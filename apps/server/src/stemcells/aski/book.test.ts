import { beforeEach, describe, expect, it } from "vite-plus/test";

import { proposedPlan } from "../../../../../stemcells/orchestrator/check.ts";
import {
  clearBook,
  expectPlan,
  outcomeOf,
  planForMessage,
  putPlan,
  settlePlan,
  unexpectPlan,
} from "./book.ts";

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
