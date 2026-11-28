import { beforeEach, describe, expect, it } from "vite-plus/test";

import type { Plan, StartAct } from "../../../../../stemcells/orchestrator/plan.ts";
import {
  clearBook,
  keptBook,
  type Launch,
  planOfId,
  putPlan,
  queueAct,
  setStandings,
  settlePlan,
  standingOf,
  type Standing,
} from "./book.ts";
import { dueOf, QUEUED_MOST_MS } from "./line.ts";

const act = (i: number, over: Partial<StartAct> = {}): StartAct => ({
  kind: "start",
  i,
  pieces: [i],
  tier: "start",
  why: [],
  threadId: `thread-${i}`,
  title: `Task ${i}`,
  words: `Do task ${i}.`,
  note: null,
  place: { id: "p-harbor", name: "Harbor", heard: "Harbor", how: "exact" },
  model: null,
  effort: null,
  risks: [],
  ...over,
});

const plan = (id: string, acts: Plan["acts"]): Plan => ({
  id,
  dictated: false,
  pieces: [],
  acts,
  talk: [],
  leftOver: [],
  from: "read",
});

const launch = (at: number, worktree = false): Launch => ({
  projectId: "harbor",
  modelSelection: { instanceId: "claudeAgent", model: "m" },
  runtimeMode: "full-access",
  interactionMode: "default",
  worktree,
  at,
});

const stands = (threadId: string, standing: Standing) => setStandings([{ threadId, ...standing }]);
const landed: Standing = {
  stage: "done",
  line: "Done.",
  landing: { verdict: "claimed", proof: "word" },
};
const due = (now = 2_000) => dueOf(keptBook(), standingOf, now).map((one) => one.kind);

beforeEach(() => {
  clearBook();
  putPlan({
    plan: plan("p1", [act(0), act(1, { after: [0], afterHeard: "once that's done" })]),
    text: "x",
    threadId: "aski",
    at: 1_000,
  });
  settlePlan("p1", [{ i: 0, status: "started" }]);
});

describe("a queued Cell", () => {
  it("starts when the Cell before it has landed with nothing left, and not before", () => {
    expect(queueAct("p1", 1, launch(1_000))).toBe("queued");
    expect(due()).toEqual([]);
    stands("thread-0", { stage: "working", line: null, landing: null });
    expect(due()).toEqual([]);
    stands("thread-0", { stage: "needs-you", line: "Which file?", landing: null });
    expect(due()).toEqual([]);
    stands("thread-0", { ...landed, landing: { verdict: "short", proof: "stopped" } });
    expect(due()).toEqual([]);
    stands("thread-0", landed);
    expect(due()).toEqual(["start"]);
  });

  it("starts once: told as started, it is no longer the server's", () => {
    queueAct("p1", 1, launch(1_000));
    stands("thread-0", landed);
    settlePlan("p1", [{ i: 1, status: "started" }]);
    expect(due()).toEqual([]);
    expect(planOfId("p1")?.launches).toEqual({});
  });

  it("waits while the Cell before it never started, and is dropped after a day", () => {
    settlePlan("p1", [{ i: 0, status: "dropped" }]);
    queueAct("p1", 1, launch(1_000));
    stands("thread-0", landed);
    expect(due()).toEqual([]);
    expect(due(1_000 + QUEUED_MOST_MS + 1)).toEqual(["expire"]);
  });

  it("starts before the Cell before it lands when the person won't wait", () => {
    queueAct("p1", 1, { ...launch(1_000), now: true });
    stands("thread-0", { stage: "working", line: null, landing: null });
    expect(dueOf(keptBook(), standingOf, 2_000)).toMatchObject([{ kind: "start", waited: false }]);
  });

  it("is not put back in the line by a client that hasn't heard it started or failed", () => {
    queueAct("p1", 1, launch(1_000));
    settlePlan("p1", [{ i: 1, status: "failed", reason: "No model." }]);
    settlePlan("p1", [{ i: 1, status: "queued" }]);
    expect(planOfId("p1")?.outcome?.[1]).toEqual({ i: 1, status: "failed", reason: "No model." });
    settlePlan("p1", [{ i: 0, status: "queued" }]);
    expect(planOfId("p1")?.outcome?.[0]?.status).toBe("started");
    expect(queueAct("p1", 0, launch(1_000))).toBe("started");
  });

  it("with nothing to wait for starts at once: a Cell handed over for its worktree", () => {
    putPlan({ plan: plan("p3", [act(0)]), text: "z", threadId: "aski", at: 1_000 });
    queueAct("p3", 0, launch(1_000, true));
    expect(due()).toEqual(["start"]);
  });

  it("is refused for a plan the book lacks, and while a deletion of its plan is held", () => {
    expect(queueAct("nope", 0, launch(1_000))).toBe("unknown");
    putPlan({
      plan: plan("p2", [
        {
          kind: "destroy",
          i: 0,
          pieces: [0],
          tier: "hold",
          why: [],
          target: "project",
          place: null,
          cells: [],
          words: "delete it",
        },
        act(1),
      ]),
      text: "y",
      threadId: "aski",
      at: 1_000,
    });
    expect(queueAct("p2", 1, launch(1_000))).toBe("held");
    expect(queueAct("p2", 0, launch(1_000))).toBe("unknown");
    settlePlan("p2", [{ i: 0, status: "dropped" }]);
    expect(queueAct("p2", 1, launch(1_000))).toBe("queued");
  });
});
