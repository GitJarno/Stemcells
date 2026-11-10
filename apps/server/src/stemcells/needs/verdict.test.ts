import { expect, it } from "vite-plus/test";

import type { Brief, PullRequestFact } from "./evidence.ts";
import { landingOf } from "./verdict.ts";

const pullRequest = (over: Partial<PullRequestFact>): PullRequestFact => ({
  number: 12,
  url: "https://example.com/pull/12",
  state: "open",
  draft: false,
  checks: null,
  conflicts: false,
  ...over,
});

const brief = (over: Partial<Brief>): Brief => ({
  goal: null,
  changed: null,
  checks: [],
  pullRequest: null,
  ...over,
});

const CLEAN = [{ kind: "test", ok: true }] as const;
const FAILED = [
  { kind: "test", ok: true },
  { kind: "lint", ok: false },
] as const;

it.each([
  // How the run ended outranks everything it shows.
  ["interrupted", brief({ checks: CLEAN }), "short", "stopped"],
  ["cancelled", null, "short", "stopped"],
  ["rolled_back", null, "short", "rolled-back"],
  ["failed", null, "short", "failed"],
  // A failing fact outranks a passing one.
  [
    "completed",
    brief({ checks: CLEAN, pullRequest: pullRequest({ checks: "failing" }) }),
    "short",
    "pr-checks-failing",
  ],
  [
    "completed",
    brief({ checks: FAILED, pullRequest: pullRequest({ checks: "passing" }) }),
    "short",
    "check-failed",
  ],
  // A merged pull request's old failing checks no longer say anything.
  [
    "completed",
    brief({ pullRequest: pullRequest({ state: "merged", checks: "failing" }) }),
    "shown",
    "pr-merged",
  ],
  [
    "completed",
    brief({ pullRequest: pullRequest({ checks: "passing" }) }),
    "shown",
    "pr-checks-passing",
  ],
  ["completed", brief({ checks: CLEAN }), "shown", "checks-clean"],
  // Pending checks and an open pull request show nothing yet.
  ["completed", brief({ pullRequest: pullRequest({ checks: "pending" }) }), "claimed", "word"],
  ["completed", null, "claimed", "word"],
] as const)("%s with %j lands %s on %s", (status, facts, verdict, proof) => {
  expect(landingOf(status, facts)).toEqual({ verdict, proof });
});
