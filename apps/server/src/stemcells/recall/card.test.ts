import { describe, expect, it } from "vite-plus/test";

import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";
import {
  HOUR,
  MINUTE,
  NOW,
  at,
  instanceId,
  runId,
  shellFixture,
  threadId,
} from "../upstream/needs.fixture.ts";
import { ASKED_MOST, cardOf, hasCard, restamped, runKeyOf, type RunRead } from "./card.ts";

const said = (text: string, ago: number, more: Partial<RunRead["messages"][number]> = {}) => ({
  text,
  at: NOW - ago,
  news: false,
  fromCell: false,
  ...more,
});

/** A Cell that built a page over two asks, ran its checks and merged its pull request. */
const landed = shellFixture({
  id: "thread-film",
  title: "Film detail page",
  pullRequests: [
    {
      number: 281,
      url: "https://example.com/acme/harbor/pull/281",
      host: "example.com",
      repository: "acme/harbor",
      source: "created",
      linkedAt: "2026-10-21T11:40:00.000Z",
      snapshot: { state: "merged", isDraft: false, checksState: "passing" },
    },
  ] as never,
});
const run: RunRead = {
  messages: [
    said("Build the film detail page: poster, cast list and the trailer.", 55 * MINUTE),
    said("Otter finished the tokens you asked about.", 40 * MINUTE, { fromCell: true }),
    said("Wake: the checks finished.", 30 * MINUTE, { news: true }),
    said("Also add the release year under the title.", 20 * MINUTE),
  ],
  reply: "The page is in.\n\n**Done:** film detail page shipped, #281 merged",
  records: {
    told: [],
    ran: [{ command: "pnpm exec vitest run src/film", failed: false }],
    files: [
      { path: "src/film/Page.tsx", additions: 120, deletions: 8 },
      { path: "src/film/Cast.tsx", additions: 40, deletions: 0 },
    ],
  },
};

describe("a Cell's card", () => {
  it("says what was asked, what came of it and what shows it, from the records alone", () => {
    const { card, touches } = cardOf(landed, run, "Harbor", NOW);
    expect(card).toEqual({
      threadId: "thread-film",
      projectId: "project-harbor",
      project: "Harbor",
      title: "Film detail page",
      // The person's own asks: not another Cell's mail, nor a wake.
      asked: [
        "Build the film detail page: poster, cast list and the trailer.",
        "Also add the release year under the title.",
      ],
      line: "film detail page shipped, #281 merged",
      verdict: "shown",
      proof: "pr-merged",
      changed: { files: 2, additions: 160, deletions: 8 },
      checks: [{ kind: "test", ok: true }],
      pullRequest: {
        number: 281,
        url: "https://example.com/acme/harbor/pull/281",
        state: "merged",
        draft: false,
        checks: "passing",
      },
      model: "gpt-5.4",
      bornAt: "2026-10-21T11:00:00.000Z",
      landedAt: "2026-10-21T11:50:00.000Z",
      awake: true,
      flying: false,
    });
    // Found by when it was born, each time it was told something, and when it landed.
    expect(touches).toEqual([
      NOW - HOUR,
      NOW - 55 * MINUTE,
      NOW - 40 * MINUTE,
      NOW - 20 * MINUTE,
      NOW - 10 * MINUTE,
    ]);
  });

  it("keeps the brief a Cell was started with, whoever sent it", () => {
    const { card } = cardOf(
      landed,
      { ...run, messages: [said("Rename the header tokens.", HOUR, { fromCell: true })] },
      "Harbor",
      NOW,
    );
    expect(card.asked).toEqual(["Rename the header tokens."]);
  });

  it("opens each ask, and of a long chat keeps the first two and the latest", () => {
    const messages = Array.from({ length: 30 }, (_, n) =>
      said(n === 0 ? `Start ${"word ".repeat(120)}` : `ask ${n}`, (40 - n) * MINUTE),
    );
    const { card } = cardOf(landed, { ...run, messages }, "Harbor", NOW);
    expect(card.asked).toHaveLength(ASKED_MOST);
    expect(card.asked[0]!.length).toBeLessThanOrEqual(281);
    expect(card.asked[0]!.endsWith("…")).toBe(true);
    expect(card.asked.slice(1, 3)).toEqual(["ask 1", "ask 20"]);
    expect(card.asked.at(-1)).toBe("ask 29");
  });

  it("keeps what its last landing left while it flies again", () => {
    const before = cardOf(landed, run, "Harbor", NOW).card;
    const flying = shellFixture({
      id: "thread-film",
      title: "Film detail page",
      status: "running",
      activeRunId: runId("run-2"),
      latestRunId: runId("run-2"),
      latestRunCompletedAt: null,
    });
    const { card } = cardOf(
      flying,
      {
        messages: [...run.messages, said("Now the reviews tab.", MINUTE)],
        reply: null,
        records: null,
      },
      "Harbor",
      NOW,
      before,
    );
    expect(card.flying).toBe(true);
    expect(card.line).toBe("film detail page shipped, #281 merged");
    expect(card.verdict).toBe("shown");
    expect(card.asked.at(-1)).toBe("Now the reviews tab.");
    expect(runKeyOf(flying)).not.toBe(runKeyOf(landed));
  });

  it("is asleep once its Cell is, with no run read again", () => {
    const before = cardOf(landed, run, "Harbor", NOW).card;
    const asleep = { ...landed, title: "Film page", settledAt: at(-MINUTE) };
    expect(runKeyOf(asleep)).toBe(runKeyOf(landed));
    expect(restamped(before, asleep, "Harbor", NOW)).toEqual({
      ...before,
      title: "Film page",
      awake: false,
    });
    // A snooze is a sleep with an alarm.
    expect(restamped(before, { ...landed, snoozedUntil: at(HOUR) }, "Harbor", NOW).awake).toBe(
      false,
    );
  });

  it("is kept for a Cell alone", () => {
    const root = threadId("thread-parent");
    expect(hasCard(landed)).toBe(true);
    expect(hasCard({ ...landed, deletedAt: at(0) })).toBe(false);
    expect(hasCard({ ...landed, latestRunId: null })).toBe(false);
    expect(hasCard({ ...landed, providerInstanceId: instanceId(ASKI_INSTANCE_ID) })).toBe(false);
    expect(
      hasCard({
        ...landed,
        lineage: { rootThreadId: root, parentThreadId: root, relationshipToParent: "subagent" },
      }),
    ).toBe(false);
    expect(
      hasCard({
        ...landed,
        lineage: {
          rootThreadId: threadId("thread-film"),
          parentThreadId: root,
          relationshipToParent: "fork",
          sideChat: true,
        },
      }),
    ).toBe(false);
    // A fork is a Cell of its own.
    expect(
      hasCard({
        ...landed,
        lineage: { rootThreadId: root, parentThreadId: root, relationshipToParent: "fork" },
      }),
    ).toBe(true);
  });
});
