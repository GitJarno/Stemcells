import { describe, expect, it } from "vite-plus/test";

import { conditionLineOf } from "./conditionLines";
import type { Condition } from "./wire";

const NOW = Date.parse("2026-11-04T10:00:00.000Z");
const held = (threadId: string, carriesOn = true) => ({
  threadId,
  projectId: "p-harbor",
  title: threadId,
  runId: "run-1",
  since: "2026-11-04T09:58:00.000Z",
  carriesOn,
});
const limit = (over: Partial<Condition> = {}): Condition => ({
  key: "limit:claude:1",
  kind: "limit",
  providerInstanceId: "claude",
  resetAt: "2026-11-05T01:00:00.000Z",
  since: "2026-11-04T09:58:00.000Z",
  waits: "reset",
  cells: [held("otter"), held("pip")],
  ...over,
});
const said = (over: Partial<Condition> = {}) => {
  const line = conditionLineOf(limit(over), NOW, "en-GB", "UTC");
  return `${line.what} · ${line.when} · ${line.then}`;
};

describe("a condition in words", () => {
  it("says the reset and that its Cells carry on, or which don't", () => {
    expect(said()).toBe("Usage limit · resets tomorrow 01:00 · They carry on by themselves.");
    expect(said({ cells: [held("otter")] })).toBe(
      "Usage limit · resets tomorrow 01:00 · It carries on by itself.",
    );
    expect(said({ cells: [held("otter"), held("pip", false)] })).toBe(
      "Usage limit · resets tomorrow 01:00 · They carry on by themselves, except 1 you turned off.",
    );
  });

  it("says so when nothing will carry them on: no reset stated, none armed, or the reset gone by", () => {
    expect(said({ resetAt: null, waits: "you" })).toBe(
      "Usage limit · no reset stated · Nothing carries them on.",
    );
    expect(said({ waits: "you" })).toBe(
      "Usage limit · resets tomorrow 01:00 · Nothing carries them on.",
    );
    expect(said({ waits: "you", resetAt: "2026-11-04T09:00:00.000Z" })).toBe(
      "Usage limit · reset today 09:00 · They are still stopped.",
    );
  });
});
