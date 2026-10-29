/** Needs as the server sends them, for the column's tests. */
import type { Need, NeedRequest } from "./wire";

export const NOW = Date.parse("2026-10-21T12:00:00.000Z");

export function needFixture(overrides: Partial<Need> = {}): Need {
  return {
    key: "thread-floof:request:request-1",
    number: 1,
    kind: "permission",
    threadId: "thread-floof",
    projectId: "project-harbor",
    parentThreadId: null,
    title: "Header tokens",
    providerInstanceId: "codex",
    since: "2026-10-21T11:58:00.000Z",
    blocks: true,
    request: null,
    plan: null,
    limit: null,
    failure: null,
    prose: null,
    stuck: null,
    ...overrides,
  };
}

export function requestFixture(overrides: Partial<NeedRequest> = {}): NeedRequest {
  return {
    id: "request-1",
    kind: "command",
    prompt: "git push --force-with-lease origin header-tokens",
    appName: null,
    reason: null,
    fullAccessOverride: null,
    options: [],
    questions: [],
    responseMode: null,
    capability: "live",
    ...overrides,
  };
}

/** A finished reply's ask: its cue and words, and nothing else of the reply unless given. */
export function proseFixture(
  cue: NonNullable<Need["prose"]>["cue"],
  text: string,
  more: Partial<NonNullable<Need["prose"]>> = {},
): NonNullable<Need["prose"]> {
  return { runId: "run-1", cue, text, steps: [], next: null, lead: null, ...more };
}
