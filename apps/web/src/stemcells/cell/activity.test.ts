import { describe, expect, it } from "vite-plus/test";
import {
  type Activity,
  ActivityHold,
  activityOf,
  BUDS_MOST,
  budsOf,
  currentActivity,
  type ToolBeat,
} from "./activity.ts";

const beat = (name: string, brief: string, state: ToolBeat["state"] = "requested"): ToolBeat => ({
  name,
  brief,
  state,
});

describe("currentActivity", () => {
  it("acts nothing for a Cell at rest", () => {
    expect(currentActivity(false, [beat("Bash", "make test")])).toBeUndefined();
  });

  it("is thinking in a turn with no call", () => {
    expect(currentActivity(true, [])).toBe("thinking");
  });

  it("leaves the model thinking once a call has returned", () => {
    expect(currentActivity(true, [beat("Read", "a.swift", "returned")])).toBe("thinking");
  });
});

describe("activityOf", () => {
  it.each<[string, string, Activity]>([
    ["Read", "main.swift", "reading"],
    ["Grep", "activityOf", "searching"],
    ["Glob", "**/*.swift", "searching"],
    ["WebFetch", "docs", "browsing"],
    ["WebSearch", "swift", "browsing"],
    ["Edit", "main.swift", "editing"],
    ["Write", "notes.md", "editing"],
    ["MultiEdit", "kit.ts", "editing"],
    ["apply_patch", "*** Begin Patch", "editing"],
    ["Bash", "make test-sprite", "testing"],
    ["Bash", "pytest -q", "testing"],
    ["Bash", "grep test Makefile", "searching"],
    ["Bash", "make build", "building"],
    ["Bash", "swiftc -O x.swift", "building"],
    ["Bash", "git commit -m x", "shipping"],
    ["Bash", "git push", "shipping"],
    ["Bash", "gh pr create", "shipping"],
    ["Bash", "make merge PR=735", "shipping"],
    ["Bash", "git status", "reading"],
    ["Bash", "sleep 30", "waiting"],
    ["Bash", "until test -f x; do", "waiting"],
    ["Bash", "cat README.md", "reading"],
    ["Bash", "curl -s x", "browsing"],
    ["Bash", "python3 tool.py", "running"],
    ["exec_command", "cargo test", "testing"],
    ["Task", "research", "delegating"],
    ["Agent", "review the diff", "delegating"],
    ["TodoWrite", "plan", "thinking"],
  ])("%s `%s` → %s", (tool, brief, expected) => {
    expect(activityOf(tool, brief)).toBe(expected);
  });
});

describe("ActivityHold", () => {
  it("shows a change only after the hold and the debounce, and starting and stopping at once", () => {
    const hold = new ActivityHold();
    const t0 = 1_000_000;
    hold.update("thinking", t0);
    expect(hold.shown, "starting work shows at once").toBe("thinking");
    const due = hold.update("reading", t0 + 1000);
    expect(hold.shown, "a change waits out the 8 s hold").toBe("thinking");
    expect(due).toBe(t0 + 8000);
    hold.update("reading", t0 + 8000);
    expect(hold.shown, "and then shows").toBe("reading");
    hold.update("testing", t0 + 17_000);
    hold.update("reading", t0 + 18_000);
    expect(hold.shown, "a flicker shorter than 3 s never shows").toBe("reading");
    hold.update("testing", t0 + 19_000);
    expect(hold.update("testing", t0 + 20_000), "a new activity debounces 3 s").toBe(t0 + 22_000);
    expect(hold.shown).toBe("reading");
    hold.update(undefined, t0 + 21_000);
    expect(hold.shown, "stopping shows at once").toBeUndefined();
  });
});

describe("budsOf", () => {
  it("counts the subagents still at work, two at most", () => {
    expect(budsOf([beat("Task", "a"), beat("Read", "a.ts")])).toBe(1);
    expect(budsOf([beat("Task", "a", "returned"), beat("Agent", "b")])).toBe(1);
    expect(budsOf([beat("Task", "a"), beat("Task", "b"), beat("Agent", "c")])).toBe(BUDS_MOST);
    expect(budsOf([beat("Bash", "ls")])).toBe(0);
  });

  it("counts the subagents gone to the background once, beside the turn's own", () => {
    expect(budsOf([], 1)).toBe(1);
    expect(budsOf([beat("Task", "a")], 1)).toBe(1);
    expect(budsOf([], 5)).toBe(BUDS_MOST);
  });
});
