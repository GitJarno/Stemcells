import { describe, expect, it } from "vite-plus/test";

import type { CellStanding } from "../needs/wire";
import { cardOf, isLatest, type Reply } from "./reply";
import { shownOf } from "./shown";

const LEFT = "Both fixes are in.\n\n**Left:**\n- waiting: the checks on #212\n- me: merge it";
const reply = (more: Partial<Reply> = {}): Reply => ({
  text: LEFT,
  runId: "run-2",
  last: true,
  ...more,
});

const standing = (more: Partial<CellStanding> = {}): CellStanding => ({
  threadId: "thread-1",
  projectId: "project-1",
  title: "Header tokens",
  stage: "done",
  line: "the header fix",
  createdAt: "2026-10-21T11:00:00.000Z",
  ...more,
});

describe("the card a reply's words draw", () => {
  it("is the close-out of a settled reply's own words", () => {
    expect(cardOf(reply(), LEFT, false)?.lines.map((line) => line.owner)).toEqual([
      "waiting",
      "me",
    ]);
  });

  it("is none while the reply streams, so its last lines show as they arrive", () => {
    expect(cardOf(reply(), LEFT, true)).toBeNull();
  });

  it("is none for words that aren't the reply's own: a plan, a card inside it, a message", () => {
    expect(cardOf(null, LEFT, false)).toBeNull();
    expect(cardOf(reply(), "**Done:** a step the card itself draws", false)).toBeNull();
  });

  it("is none where the reader finds no close-out, and the words stay as written", () => {
    const report = "Fixed and pushed. Done: nothing more to say, far from the end.\n\nAll green.";
    expect(cardOf(reply({ text: report }), report, false)).toBeNull();
  });
});

describe("what the run shows under a reply", () => {
  it("stands under the latest run's last reply alone", () => {
    expect(isLatest(reply(), "run-2")).toBe(true);
    expect(isLatest(reply({ runId: "run-1" }), "run-2")).toBe(false);
    expect(isLatest(reply({ last: false }), "run-2")).toBe(false);
    expect(isLatest(reply({ runId: null }), null)).toBe(false);
  });

  it("says how it landed and the run's facts, as the room says them", () => {
    const shown = shownOf(
      standing({
        landing: { verdict: "shown", proof: "pr-checks-passing" },
        brief: {
          goal: "Fix the header",
          changed: { files: 2, additions: 30, deletions: 10 },
          checks: [{ kind: "test", ok: true }],
          pullRequest: {
            number: 212,
            url: "https://example.com/pull/212",
            state: "open",
            draft: false,
            checks: "passing",
            conflicts: false,
          },
        },
      }),
    );
    expect(shown?.verdict?.is).toBe("shown");
    expect(shown?.changed?.bar).toHaveLength(5);
    expect(shown?.facts.map((fact) => [fact.id, fact.tone])).toEqual([
      ["test", "good"],
      ["pull-request", "good"],
    ]);
  });

  it("is nothing from a server before the brief, or for a Cell out of reach", () => {
    expect(shownOf(standing())).toBeNull();
    expect(shownOf(standing({ landing: null, brief: null }))).toBeNull();
    expect(shownOf(null)).toBeNull();
  });
});
