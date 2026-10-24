import { describe, expect, it } from "vite-plus/test";

import type { LimitAccount, LimitWindow } from "../upstream/limits";
import { headlineOf, maskedEmail, readPlan, readPlans, readWindow, ringPlan } from "./plans";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse("2026-10-24T12:00:00Z");

/** A window of `hours` that opened `elapsedHours` ago with `used` percent spent. */
const window = (
  id: string,
  kind: LimitWindow["kind"],
  label: string,
  used: number,
  hours: number,
  elapsedHours: number,
): LimitWindow => ({
  id,
  kind,
  label,
  usedPercent: used,
  windowDurationMins: hours * 60,
  resetsAt: new Date(NOW + (hours - elapsedHours) * HOUR).toISOString(),
});

const account = (
  key: string,
  windows: ReadonlyArray<LimitWindow>,
  extra: Partial<LimitAccount> = {},
): LimitAccount =>
  ({
    key,
    driver: "claudeAgent",
    displayName: null,
    email: undefined,
    plan: undefined,
    accentColor: undefined,
    environments: [],
    sourceLabel: null,
    redeem: null,
    limits: { checkedAt: new Date(NOW).toISOString(), windows },
    ...extra,
  }) as LimitAccount;

const clock = (at: number) => new Date(at).toISOString().slice(11, 16);
const duration = (ms: number) => `${Math.round(ms / MINUTE)}m`;

describe("a window's reading", () => {
  it("runs out before its reset when the pace so far empties it first", () => {
    // 60% spent in 2 of 5 hours: the last 40% lasts 1h20m, the reset is 3h off.
    const reading = readWindow(window("s", "session", "Session", 60, 5, 2), NOW, NOW);
    expect(reading.left).toBe(40);
    expect(reading.runsOutAt).toBe(NOW + 80 * MINUTE);
    expect(reading.evenLeft).toBe(60);
    expect(reading.tone).toBe("short");
  });

  it("holds out when the pace lasts to the reset", () => {
    const reading = readWindow(window("w", "weekly", "Weekly", 30, 168, 84), NOW, NOW);
    expect(reading.runsOutAt).toBeNull();
    expect(reading.tone).toBe("fine");
  });

  it("judges no pace before a tenth of the window or 3% spent", () => {
    expect(readWindow(window("s", "session", "Session", 40, 5, 0.25), NOW, NOW).runsOutAt).toBe(
      null,
    );
    expect(readWindow(window("w", "weekly", "Weekly", 2, 168, 20), NOW, NOW).runsOutAt).toBeNull();
  });

  it("is short at a tenth left, out at nothing, and full again past its reset", () => {
    expect(readWindow(window("w", "weekly", "Weekly", 90, 168, 160), NOW, NOW).tone).toBe("short");
    expect(readWindow(window("w", "weekly", "Weekly", 100, 168, 100), NOW, NOW).tone).toBe("out");
    const refilled = readWindow(window("s", "session", "Session", 100, 5, 6), NOW, NOW);
    expect(refilled).toMatchObject({ left: 100, tone: "fine", resetsAt: null });
  });
});

describe("a plan's windows", () => {
  it("read the plan's own week; a model's week running short only marks it, named", () => {
    const general = window("seven_day", "weekly", "Weekly", 18, 168, 84);
    const roomy = window("seven_day_fable", "weekly", "Weekly · Fable", 40, 168, 84);
    expect(readPlan(account("a", [general, roomy]), 0, "Claude", NOW).long).toMatchObject({
      left: 82,
      tone: "fine",
      note: null,
    });
    const short = window("seven_day_opus", "weekly", "Weekly · Opus", 95, 168, 84);
    expect(readPlan(account("a", [general, short]), 0, "Claude", NOW).long).toMatchObject({
      left: 82,
      tone: "short",
      note: "Opus 5%",
    });
  });

  it("never call a plan out, or say until when it is limited, for one model's spent week", () => {
    const plan = readPlan(
      account("a", [
        window("seven_day", "weekly", "Weekly", 30, 168, 84),
        window("seven_day_fable", "weekly", "Weekly · Fable", 100, 168, 84),
      ]),
      1,
      "Claude",
      NOW,
    );
    expect(plan.tone).toBe("short");
    expect(headlineOf(plan, NOW, clock, duration)).toBeNull();
    // With only families' weeks, the tightest stands in, short at worst.
    const families = readPlan(
      account("b", [
        window("gemini", "weekly", "Gemini · Weekly", 100, 168, 84),
        window("claude", "weekly", "Claude · Weekly", 20, 168, 84),
      ]),
      0,
      "Antigravity",
      NOW,
    );
    expect(families.long).toMatchObject({ left: 0, tone: "short", note: "Gemini", scoped: true });
  });

  it("block the session while the plan's week is spent, until the week resets", () => {
    const plan = readPlan(
      account("a", [
        window("five_hour", "session", "Session", 20, 5, 1),
        window("seven_day", "weekly", "Weekly", 100, 168, 160),
      ]),
      0,
      "Claude",
      NOW,
    );
    expect(plan.session).toMatchObject({ left: 0, tone: "out", resetsAt: plan.long?.resetsAt });
  });

  it("take the month only when the plan has no week, and say so", () => {
    const month = window("m", "monthly", "Monthly", 40, 720, 360);
    expect(readPlan(account("a", [month]), 0, "Cursor", NOW).long?.note).toBe("month");
    const week = window("w", "weekly", "Weekly", 10, 168, 84);
    expect(readPlan(account("a", [week, month]), 0, "Codex", NOW).long?.left).toBe(90);
  });

  it("go by the person's name, else a masked email, never the whole address", () => {
    expect(readPlan(account("a", [], { displayName: "Work" }), 0, "Claude", NOW)).toMatchObject({
      name: "Work",
      named: true,
    });
    expect(readPlan(account("a", [], { email: "someone@example.com" }), 0, "Claude", NOW).name).toBe(
      "so…@example.com",
    );
    expect(maskedEmail("j@example.com")).toBe("j…@example.com");
  });
});

describe("the ring's plan", () => {
  const fine = account("fine", [window("s", "session", "Session", 10, 5, 2)]);
  const short = account("short", [window("s", "session", "Session", 60, 5, 2)]);
  const idle = account("idle", [window("s", "session", "Session", 0, 5, 1)]);
  const plansWith = (working: Record<string, number>) =>
    readPlans(
      [fine, short, idle],
      (instance) => [fine, short, idle].find((candidate) => candidate.key === instance) ?? null,
      { working: new Map(Object.entries(working)), lastWritten: null },
      () => "Claude",
      NOW,
    );

  it("is the worst off of the plans at work, never one nobody is using", () => {
    expect(ringPlan(plansWith({ fine: 2, short: 1 }), null)?.account.key).toBe("short");
    expect(ringPlan(plansWith({ fine: 1 }), null)?.account.key).toBe("fine");
  });

  it("is the plan written to last while none works", () => {
    expect(ringPlan(plansWith({}), idle)?.account.key).toBe("idle");
  });

  it("lists the plans at work first, then the worse off", () => {
    expect(plansWith({ fine: 1 }).map((plan) => plan.account.key)).toEqual([
      "fine",
      "short",
      "idle",
    ]);
  });
});

describe("the headline", () => {
  it("says when the plan limits and how long before its reset", () => {
    const plan = readPlan(
      account("a", [window("s", "session", "Session", 60, 5, 2)]),
      1,
      "Claude",
      NOW,
    );
    expect(headlineOf(plan, NOW, clock, duration)).toBe(
      "You'll limit at 13:20, 100m before reset (15:00)",
    );
  });

  it("says until when a plan that has run out is limited: its later reset", () => {
    const plan = readPlan(
      account("a", [
        window("s", "session", "Session", 100, 5, 4),
        window("w", "weekly", "Weekly", 100, 168, 166),
      ]),
      0,
      "Claude",
      NOW,
    );
    expect(headlineOf(plan, NOW, clock, duration)).toBe("Limited until 14:00, in 120m");
  });

  it("says nothing while the pace holds out", () => {
    const plan = readPlan(
      account("a", [window("w", "weekly", "Weekly", 30, 168, 84)]),
      1,
      "Claude",
      NOW,
    );
    expect(headlineOf(plan, NOW, clock, duration)).toBeNull();
  });
});
