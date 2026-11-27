import "../upstream/appStyles";
import "../tokens/stemcells.css";
import "./rail.css";

import { describe, expect, it, vi } from "vite-plus/test";

import type { LimitPresentations } from "../upstream/limitAccounts";
import { render } from "../upstream/testRender";
import { PlanRing } from "./PlanRing";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-10-24T12:00:00Z");

const window = (id: string, kind: string, label: string, used: number, hoursLeft: number) => ({
  id,
  kind,
  label,
  usedPercent: used,
  windowDurationMins: kind === "session" ? 300 : 10_080,
  resetsAt: new Date(NOW + hoursLeft * HOUR).toISOString(),
});

const provider = (
  instanceId: string,
  driver: string,
  email: string,
  displayName: string | undefined,
  windows: ReadonlyArray<ReturnType<typeof window>>,
) => ({
  instanceId,
  driver,
  enabled: true,
  installed: true,
  availability: "available",
  displayName,
  auth: { status: "authenticated", email, label: "Max" },
  usageLimits: { checkedAt: new Date(NOW).toISOString(), windows },
});

const PRESENTATIONS = new Map([
  [
    "e1",
    {
      entry: { target: { label: "Mac" } },
      serverConfig: {
        providers: [
          provider("work", "claudeAgent", "work@example.com", "Work", [
            window("five_hour", "session", "Session", 34, 3),
            window("seven_day", "weekly", "Weekly", 66, 50),
            window("fable", "weekly", "Weekly · Fable", 61, 50),
          ]),
          provider("home", "claudeAgent", "home@example.com", "Home", [
            window("five_hour", "session", "Session", 8, 4),
            window("seven_day", "weekly", "Weekly", 23, 120),
          ]),
          provider("spare", "claudeAgent", "spare@example.com", "Spare", [
            window("five_hour", "session", "Session", 100, 0.75),
            window("seven_day", "weekly", "Weekly", 71, 90),
          ]),
        ],
      },
    },
  ],
]) as unknown as LimitPresentations;

// The adapter reads the app's atoms; the ring needs only these from it.
vi.mock("../upstream/limits", async () => ({
  ...(await import("../upstream/limitAccounts")),
  formatDuration: (ms: number) => `${Math.round(ms / 60_000)}m`,
  showLimitsOnUsage: () => undefined,
  useLimitPresentations: () => PRESENTATIONS,
  useChatWork: () => ({ working: new Map([["e1:work", 2]]), lastWritten: "e1:work" }),
  useClockFormat: () => (at: number) => new Date(at).toISOString().slice(11, 16),
}));

vi.mock("./clock", () => ({ useMinute: () => NOW }));

describe("the plan ring", () => {
  it("shows the plan you're on and opens every plan on a click, that plan first", async () => {
    await using screen = await render(
      <div style={{ padding: 16, width: 48 }}>
        <PlanRing on={false} />
      </div>,
    );
    const ring = screen.getByRole("button", { name: /Work: 66% used/ });
    await expect.element(ring).toHaveTextContent("66");
    await ring.click();
    const names = screen.getByText("Limits");
    await expect.element(names).toBeVisible();
    const plans = [
      ...document.querySelectorAll("[data-stemcells-plans-name] > span:nth-of-type(1)"),
    ].map((name) => name.textContent);
    // The plan you're on, then the most room, the plan that is out last.
    expect(plans).toEqual(["Work", "Home", "Spare"]);
    const rows = [...document.querySelectorAll("[data-stemcells-plans-label]")].map(
      (label) => label.textContent,
    );
    expect(rows.slice(0, 3)).toEqual(["Session", "Week", "Fable"]);
  });
});
