import { describe, expect, it } from "vite-plus/test";

import { CHEER_MS, faceOf, faceTurnsAt } from "./mood";

const LANDED = "2026-10-25T12:00:00.000Z";
const landedMs = Date.parse(LANDED);

const shell = (
  patch: Partial<Parameters<typeof faceOf>[0]> = {},
): Parameters<typeof faceOf>[0] => ({
  interactionMode: "default",
  hasActionableProposedPlan: false,
  latestRun: null,
  runtime: null,
  blockedOnThreadWait: false,
  ...patch,
});

const landed = shell({
  latestRun: {
    runId: "run" as never,
    status: "completed",
    requestedAt: null,
    startedAt: null,
    completedAt: LANDED,
    assistantMessageId: null,
  },
});

describe("a Cell's face on the phone", () => {
  it("asks while a question, an approval or a plan waits on you", () => {
    expect(faceOf(shell(), "approval", { now: 0, driver: null }).mood).toBe("needsApproval");
    expect(faceOf(shell(), "input", { now: 0, driver: null }).mood).toBe("needsYou");
    expect(
      faceOf(shell({ interactionMode: "plan", hasActionableProposedPlan: true }), "waiting", {
        now: 0,
        driver: null,
      }).mood,
    ).toBe("needsYou");
  });

  it("works while it runs, and waits while it waits on another chat", () => {
    expect(faceOf(shell(), "working", { now: 0, driver: null })).toEqual({
      mood: "awake",
      activity: "thinking",
    });
    const blocked = shell({
      runtime: { status: "running" } as never,
      blockedOnThreadWait: true,
    });
    expect(faceOf(blocked, "waiting", { now: 0, driver: null }).activity).toBe("waiting");
  });

  it("cheers once its turn lands, rests, and sleeps once Codex's cache goes cold", () => {
    expect(faceOf(landed, "waiting", { now: landedMs + 1_000, driver: "codex" }).mood).toBe(
      "pleased",
    );
    expect(faceOf(landed, "waiting", { now: landedMs + CHEER_MS, driver: "codex" }).mood).toBe(
      "awake",
    );
    expect(faceOf(landed, "waiting", { now: landedMs + 31 * 60_000, driver: "codex" }).mood).toBe(
      "asleep",
    );
    expect(
      faceOf(landed, "waiting", { now: landedMs + 31 * 60_000, driver: "claudeAgent" }).mood,
    ).toBe("awake");
    expect(faceTurnsAt(landed, "codex", landedMs + 1_000)).toBe(landedMs + CHEER_MS);
  });

  it("sleeps once put away, peers while its machine is out of reach, and crashes on a failure", () => {
    expect(faceOf(landed, "waiting", { now: landedMs, driver: null, away: true }).mood).toBe(
      "asleep",
    );
    expect(faceOf(shell(), "input", { now: 0, driver: null, lineDown: true }).mood).toBe("peering");
    expect(faceOf(shell(), "limited", { now: 0, driver: null }).mood).toBe("crashed");
  });
});
