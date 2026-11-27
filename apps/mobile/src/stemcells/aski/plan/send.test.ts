import { describe, expect, it } from "vite-plus/test";

import type { Plan } from "../../../../../../stemcells/orchestrator/plan.ts";
import { type PlanDoor, sendThroughPlan } from "./send";

const plan = { id: "plan-1", acts: [], from: "read" } as unknown as Plan;

/** A door whose every step is logged in order; each can be held open by the test. */
function door(over: Partial<PlanDoor<string>> = {}) {
  const log: string[] = [];
  const settled: Array<Plan | null> = [];
  let tell: () => void = () => {};
  /** Resolves once the door is told what came of the plan. */
  const told = new Promise<void>((resolve) => (tell = resolve));
  const made: PlanDoor<string> = {
    text: "start two agents, one for the header and one for the docs",
    plain: true,
    names: new Set(),
    able: true,
    mint: () => "plan-1",
    expect: async () => {
      log.push("expect");
      return true;
    },
    send: async () => {
      log.push("send");
      return "message-1";
    },
    compile: async () => {
      log.push("compile");
      return plan;
    },
    reading: () => log.push("reading"),
    settled: (_id, got) => {
      log.push("settled");
      settled.push(got);
      tell();
    },
    forget: () => log.push("forget"),
    wait: () => new Promise(() => {}),
    ...over,
  };
  return { made, log, settled, told };
}

describe("a message to Aski's chat on its way out", () => {
  it("tells the server a plan is coming, then sends, with the compiler reading beside it", async () => {
    const { made, log, settled, told } = door();
    await expect(sendThroughPlan(made)).resolves.toBe("message-1");
    await told;
    expect(log).toEqual(["expect", "reading", "compile", "send", "settled"]);
    expect(settled).toEqual([plan]);
  });

  it("returns the send without waiting for the compiler", async () => {
    let finish: (made: Plan) => void = () => {};
    const { made, settled, told } = door({
      compile: () => new Promise<Plan>((resolve) => (finish = resolve)),
    });
    await expect(sendThroughPlan(made)).resolves.toBe("message-1");
    expect(settled).toEqual([]);
    finish(plan);
    await told;
    expect(settled).toEqual([plan]);
  });

  it.each([
    ["refuses", async () => false],
    [
      "can't be reached",
      async () => {
        throw new Error("offline");
      },
    ],
  ])("sends alone when the server %s", async (_name, expectPlan) => {
    const { made, log } = door({ expect: expectPlan });
    await expect(sendThroughPlan(made)).resolves.toBe("message-1");
    expect(log).toEqual(["send"]);
  });

  it("sends alone when the server is slow to answer, and takes the question back", async () => {
    let aborted = false;
    const { made, log } = door({
      expect: (_id, signal) =>
        new Promise<boolean>(() => signal.addEventListener("abort", () => (aborted = true))),
      wait: async () => {},
    });
    await expect(sendThroughPlan(made)).resolves.toBe("message-1");
    expect(log).toEqual(["send"]);
    expect(aborted).toBe(true);
  });

  it.each([
    ["talk", { text: "how many cells are flying?" }],
    ["a message with something attached", { plain: false }],
    ["a machine with no model to think with", { able: false }],
  ])("never asks the compiler about %s", async (_name, over) => {
    const { made, log } = door(over);
    await sendThroughPlan(made);
    expect(log).toEqual(["send"]);
  });

  it("takes no plan for a message that didn't go", async () => {
    let stopped = false;
    const { made, log, settled } = door({
      send: async () => null,
      compile: async (_id, signal) => {
        signal.addEventListener("abort", () => (stopped = true));
        return plan;
      },
    });
    await expect(sendThroughPlan(made)).resolves.toBeNull();
    expect(stopped).toBe(true);
    expect(log).toContain("forget");
    // The plan the compiler made anyway is never carried out.
    expect(settled).toEqual([null]);
  });
});
