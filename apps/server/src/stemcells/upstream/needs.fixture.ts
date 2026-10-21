/**
 * Thread shells for the needs list's tests, built with upstream's own ids.
 * `needs.contract.test.ts` decodes them with upstream's schema, so they stay
 * real shells after a sync.
 */
import {
  ProjectId,
  ProviderInstanceId,
  RunId,
  RuntimeRequestId,
  ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import type { RequestKind, Shell } from "./needs.ts";

export const NOW = Date.parse("2026-10-21T12:00:00.000Z");
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** The time `offset` ms from NOW. */
export const at = (offset: number): DateTime.Utc => DateTime.makeUnsafe(NOW + offset);

export const runId = (id: string) => RunId.make(id);
export const threadId = (id: string) => ThreadId.make(id);
export const instanceId = (id: string) => ProviderInstanceId.make(id);

export function shellFixture(
  overrides: Omit<Partial<Shell>, "id"> & { readonly id?: string } = {},
): Shell {
  const id = ThreadId.make(overrides.id ?? "thread-floof");
  return {
    projectId: ProjectId.make("project-harbor"),
    title: "Header tokens",
    providerInstanceId: ProviderInstanceId.make("codex"),
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    worktreePath: null,
    activeProviderThreadId: null,
    lineage: { rootThreadId: id, parentThreadId: null, relationshipToParent: null },
    forkedFrom: null,
    createdBy: "user",
    creationSource: "web",
    activeRunId: null,
    latestVisibleMessage: null,
    hasActionableProposedPlan: false,
    itemCount: 4,
    visibleItemCount: 4,
    lastVisitedAt: null,
    deletedAt: null,
    branch: null,
    status: "completed",
    pendingRuntimeRequest: null,
    pendingBackgroundTasks: [],
    providerInstanceHistory: [],
    latestRunId: RunId.make("run-1"),
    latestRunCompletedAt: at(-10 * MINUTE),
    latestUserMessageAt: at(-20 * MINUTE),
    createdAt: at(-HOUR),
    updatedAt: at(-10 * MINUTE),
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    snoozedUntil: null,
    snoozedAt: null,
    ...overrides,
    id,
  };
}

export function pendingRequest(
  kind: RequestKind,
  options: { readonly id?: string; readonly ago?: number; readonly blocking?: boolean } = {},
): NonNullable<Shell["pendingRuntimeRequest"]> {
  return {
    id: RuntimeRequestId.make(options.id ?? "request-1"),
    kind,
    createdAt: at(-(options.ago ?? MINUTE)),
    ...(options.blocking === undefined ? {} : { blocking: options.blocking }),
  };
}
