import { describe, expect, it } from "vite-plus/test";

import type { LimitPool } from "../upstream/rail";
import { bindingPlan, planTone } from "./plans";

type PoolWindow = LimitPool["windows"][number];

const window = (
  label: string,
  remainingPercent: number,
  pace: PoolWindow["pace"] = "on",
  resets: ReadonlyArray<number> = [],
): PoolWindow =>
  ({
    id: label,
    kind: "weekly",
    label,
    members: [],
    columns: [],
    remainingPercent,
    usedPercent: 100 - remainingPercent,
    pace,
    resets: resets.map((at) => ({ at, member: {} as never, restoresPercent: 100 })),
  }) as PoolWindow;

const pool = (driver: string, ...windows: PoolWindow[]): LimitPool =>
  ({ driver, accounts: [], windows }) as unknown as LimitPool;

describe("a limit's tone", () => {
  it("is out at nothing left, low at a tenth or when spending runs ahead, else fine", () => {
    expect(planTone({ remainingPercent: 0, pace: "under" })).toBe("out");
    expect(planTone({ remainingPercent: 10, pace: "under" })).toBe("low");
    expect(planTone({ remainingPercent: 60, pace: "ahead" })).toBe("low");
    expect(planTone({ remainingPercent: 60, pace: null })).toBe("fine");
  });
});

describe("the limit the ring shows", () => {
  it("is none without limits", () => {
    expect(bindingPlan([])).toBeNull();
  });

  it("is the worse tone first, across providers", () => {
    const plan = bindingPlan([
      pool("claudeAgent", window("Weekly", 30)),
      pool("codex", window("5 hours", 70, "ahead")),
    ]);
    expect(plan).toMatchObject({ driver: "codex", label: "5 hours", left: 70, tone: "low" });
  });

  it("is the smaller share left between equal tones, with its soonest reset", () => {
    const plan = bindingPlan([
      pool(
        "claudeAgent",
        window("Weekly", 64, "on", [3_000, 2_000]),
        window("Session", 40, "on", [5_000]),
      ),
    ]);
    expect(plan).toMatchObject({ label: "Session", left: 40, tone: "fine", resetsAt: 5_000 });
    expect(
      bindingPlan([pool("claudeAgent", window("Weekly", 64, "on", [3_000, 2_000]))])?.resetsAt,
    ).toBe(2_000);
  });
});
