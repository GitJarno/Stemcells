import { describe, expect, it } from "vite-plus/test";

import { inTab } from "./tabs";

const NOW = "2026-10-25T12:00:00.000Z";

const chat = (patch: Partial<Parameters<typeof inTab>[0]> = {}): Parameters<typeof inTab>[0] => ({
  settledOverride: null,
  snoozedUntil: null,
  snoozedAt: null,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  pendingSubagentRequest: null,
  interactionMode: "default",
  hasActionableProposedPlan: false,
  latestRun: null,
  runtime: null,
  blockedOnThreadWait: false,
  ...patch,
});

const running = { status: "running" } as never;

describe("the home's tabs", () => {
  it("puts a settled Cell, and one snoozed till later, asleep and nowhere else", () => {
    const settled = chat({ settledOverride: "settled" });
    const snoozed = chat({ snoozedUntil: "2026-10-26T09:00:00.000Z", snoozedAt: NOW });
    const woken = chat({ snoozedUntil: "2026-10-25T09:00:00.000Z", snoozedAt: NOW });
    for (const away of [settled, snoozed]) {
      expect(inTab(away, "asleep", NOW)).toBe(true);
      expect(inTab(away, "active", NOW)).toBe(false);
    }
    expect(inTab(woken, "asleep", NOW)).toBe(false);
    expect(inTab(woken, "active", NOW)).toBe(true);
  });

  it("counts a Cell at work, and one waiting on another chat, as working", () => {
    expect(inTab(chat({ runtime: running }), "working", NOW)).toBe(true);
    expect(inTab(chat({ runtime: running, blockedOnThreadWait: true }), "working", NOW)).toBe(true);
    expect(inTab(chat(), "working", NOW)).toBe(false);
  });

  it("puts an approval, a question and a plan ready to take in Input", () => {
    expect(inTab(chat({ hasPendingApprovals: true }), "input", NOW)).toBe(true);
    expect(inTab(chat({ hasPendingUserInput: true }), "input", NOW)).toBe(true);
    const plan = chat({ interactionMode: "plan", hasActionableProposedPlan: true });
    expect(inTab(plan, "input", NOW)).toBe(true);
    expect(inTab({ ...plan, runtime: running }, "input", NOW)).toBe(false);
  });

  it("keeps Working and Input inside Active", () => {
    const asking = chat({ hasPendingUserInput: true });
    expect(inTab(asking, "active", NOW)).toBe(true);
    expect(inTab({ ...asking, settledOverride: "settled" }, "input", NOW)).toBe(false);
  });
});
