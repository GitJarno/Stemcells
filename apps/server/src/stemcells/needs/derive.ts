/**
 * What needs the person, read from T3's thread shells: one signal per Cell
 * at most, the most blocking one (stemcells/tasks/aski-room.md, decision 2
 * and "Item types"). Pure: the service hands it shells and the time.
 *
 * This slice derives the kinds T3 states outright. A question or a stop
 * read from a Cell's prose, and a quiet run, come in later slices.
 */
import * as DateTime from "effect/DateTime";

import type {
  ApprovalOption,
  AskedQuestion,
  FailureClass,
  PlanDetail,
  RequestDetail,
  RequestKind,
  Shell,
} from "../upstream/needs.ts";

/** Aski's own chat: its asks show inline there. The web's `aski/setup.ts` names the same instance. */
export const ASKI_INSTANCE_ID = "aski";

export type NeedKind =
  | "permission"
  | "question"
  | "sign-in"
  | "input"
  | "limit"
  | "failed"
  | "plan";

/** Every kind of runtime request T3 has, and the card it makes. */
export const REQUEST_KINDS: Readonly<Record<RequestKind, NeedKind>> = {
  command: "permission",
  "file-read": "permission",
  "file-change": "permission",
  permission: "permission",
  user_input: "question",
  auth_refresh: "sign-in",
  "mcp-elicitation": "input",
  dynamic_tool_call: "input",
};

/**
 * With "carry on at the reset" set, a limit needs nobody when the reset is
 * this close: the Cell goes on by itself.
 */
export const CARRY_ON_WITHIN_MS = 5 * 60 * 60 * 1000;
/** A carry-on still not under way this long after the reset has failed. */
export const CARRY_ON_GRACE_MS = 15 * 60 * 1000;

export interface Signal {
  /** Changes whenever what is asked changes, so an answer meant for the old ask is never sent. */
  readonly key: string;
  readonly kind: NeedKind;
  readonly shell: Shell;
  /** When it began: the request's creation, or the end of the run. */
  readonly since: number;
  /** A request a running turn waits on. */
  readonly blocks: boolean;
}

const ACTIVE_RUN = new Set<Shell["status"]>([
  "preparing",
  "queued",
  "starting",
  "running",
  "waiting",
]);

const millis = (at: DateTime.Utc | null | undefined): number | null =>
  at == null ? null : DateTime.toEpochMillis(at);

/**
 * T3's own rule (client-runtime `effectiveSnoozed`): a snooze holds until
 * its time unless a request, or a failure after the snooze, wakes it early.
 */
export function isSnoozed(shell: Shell, now: number): boolean {
  const until = millis(shell.snoozedUntil);
  if (until === null || until <= now) return false;
  if (shell.pendingRuntimeRequest !== null) return false;
  if (shell.status !== "failed") return true;
  const failedAt = millis(shell.latestRunCompletedAt);
  const snoozedAt = millis(shell.snoozedAt);
  if (snoozedAt === null) return false;
  return failedAt === null || failedAt <= snoozedAt;
}

/** T3's sidebar rule: a failed latest run nobody has opened the Cell to see since it ended. */
export function isUnseenFailure(shell: Shell): boolean {
  if (shell.status !== "failed") return false;
  const visitedAt = millis(shell.lastVisitedAt);
  const completedAt = millis(shell.latestRunCompletedAt);
  return visitedAt === null || completedAt === null || completedAt > visitedAt;
}

/** The reset a limit waits for, from T3's recovery record or the provider's own word. */
export function limitResetAt(shell: Shell): string | null {
  const recovery = shell.limitRecovery;
  if (recovery != null && recovery.runId === shell.latestRunId) return recovery.resetAt;
  return shell.usageLimitResetAt ?? null;
}

/** Whether T3 will carry the Cell on at a reset close enough that nobody needs to look. */
export function carriesOn(shell: Shell, now: number): boolean {
  const recovery = shell.limitRecovery;
  if (recovery == null || !recovery.autoResume || recovery.runId !== shell.latestRunId) {
    return false;
  }
  const resetAt = Date.parse(recovery.resetAt);
  if (Number.isNaN(resetAt)) return false;
  return resetAt - now <= CARRY_ON_WITHIN_MS && now - resetAt <= CARRY_ON_GRACE_MS;
}

function runSettled(shell: Shell): boolean {
  return (
    shell.latestRunId !== null &&
    !ACTIVE_RUN.has(shell.status) &&
    shell.activeRunId !== shell.latestRunId
  );
}

function runEnded(shell: Shell): number {
  return millis(shell.latestRunCompletedAt) ?? DateTime.toEpochMillis(shell.updatedAt);
}

/** The one thing this Cell needs from the person now, or null. */
export function signalOf(shell: Shell, now: number): Signal | null {
  if (shell.deletedAt !== null || shell.archivedAt !== null) return null;
  if (shell.providerInstanceId === ASKI_INSTANCE_ID) return null;
  if (isSnoozed(shell, now)) return null;

  const request = shell.pendingRuntimeRequest;
  if (request !== null) {
    return {
      key: `${shell.id}:request:${request.id}`,
      kind: REQUEST_KINDS[request.kind],
      shell,
      since: DateTime.toEpochMillis(request.createdAt),
      blocks: request.blocking !== false,
    };
  }

  const runId = shell.latestRunId;
  if (runId === null) return null;
  const ended = { shell, since: runEnded(shell), blocks: false } as const;

  if (shell.status === "failed" && shell.lastErrorClass === "usage_limit") {
    return carriesOn(shell, now)
      ? null
      : { ...ended, key: `${shell.id}:limit:${runId}`, kind: "limit" };
  }
  if (isUnseenFailure(shell)) {
    return { ...ended, key: `${shell.id}:failed:${runId}`, kind: "failed" };
  }
  if (shell.hasActionableProposedPlan && shell.interactionMode === "plan" && runSettled(shell)) {
    return { ...ended, key: `${shell.id}:plan:${runId}`, kind: "plan" };
  }
  return null;
}

/** A plan's title and its first three steps, as the Cell wrote them. */
export function planOutline(markdown: string): {
  readonly title: string | null;
  readonly steps: ReadonlyArray<string>;
} {
  const lines = markdown.split("\n");
  const heading = lines.find((line) => /^#{1,6}\s+\S/.test(line));
  const step = /^ ?(?:\d+[.)]|[-*+])\s+(?:\[[ xX]\]\s+)?(\S.*)$/;
  const steps = lines.flatMap((line) => {
    const match = step.exec(line);
    return match?.[1] === undefined ? [] : [match[1].trim()];
  });
  return {
    title:
      heading === undefined
        ? null
        : heading
            .replace(/^#{1,6}\s+/, "")
            .replace(/\s+#+\s*$/, "")
            .trim(),
    steps: steps.slice(0, 3),
  };
}

// The wire. The web keeps its own copy of these types, as the server sends them.

export interface NeedRequest {
  readonly id: string;
  readonly kind: RequestKind;
  /** The command or file as the provider worded it; shown whole, never summarised. */
  readonly prompt: string | null;
  readonly appName: string | null;
  /** The provider's own choices, in its order; empty when it offers none. */
  readonly options: ReadonlyArray<ApprovalOption>;
  readonly questions: ReadonlyArray<AskedQuestion>;
  readonly responseMode: "message" | null;
}

export interface NeedPlan {
  /** Null when the plan couldn't be read; the card then only opens the chat. */
  readonly id: string | null;
  readonly runId: string;
  readonly title: string | null;
  readonly steps: ReadonlyArray<string>;
}

export interface NeedLimit {
  readonly runId: string;
  readonly resetAt: string | null;
  /** "Carry on at the reset" is set, but the reset is too far off, unknown or past. */
  readonly autoResume: boolean;
}

export interface NeedFailure {
  readonly runId: string;
  readonly errorClass: FailureClass | null;
  readonly message: string | null;
}

export interface Need {
  readonly key: string;
  /** Given by arrival, kept for the card's life (decision 3). */
  readonly number: number;
  readonly kind: NeedKind;
  readonly threadId: string;
  readonly projectId: string;
  /** Set for a subagent's thread, whose card goes under its parent's name. */
  readonly parentThreadId: string | null;
  readonly title: string;
  readonly since: string;
  readonly blocks: boolean;
  readonly request: NeedRequest | null;
  readonly plan: NeedPlan | null;
  readonly limit: NeedLimit | null;
  readonly failure: NeedFailure | null;
}

export interface NeedDetail {
  readonly request?: RequestDetail | null;
  readonly plan?: PlanDetail | null;
}

/** The card's data: the signal, the detail read for it, and its number. */
export function needOf(signal: Signal, detail: NeedDetail, number: number): Need {
  const { shell } = signal;
  const runId = shell.latestRunId ?? "";
  const pending = shell.pendingRuntimeRequest;
  const read = detail.request ?? null;
  const outline = detail.plan == null ? null : planOutline(detail.plan.markdown);
  return {
    key: signal.key,
    number,
    kind: signal.kind,
    threadId: shell.id,
    projectId: shell.projectId,
    parentThreadId: shell.lineage.parentThreadId,
    title: shell.title,
    since: DateTime.formatIso(DateTime.makeUnsafe(signal.since)),
    blocks: signal.blocks,
    request:
      pending === null
        ? null
        : {
            id: pending.id,
            kind: pending.kind,
            prompt: read?.prompt ?? null,
            appName: read?.appName ?? null,
            options: read?.options ?? [],
            questions: read?.questions ?? [],
            responseMode: read?.responseMode ?? null,
          },
    plan:
      signal.kind === "plan"
        ? {
            id: detail.plan?.id ?? null,
            runId,
            title: outline?.title ?? null,
            steps: outline?.steps ?? [],
          }
        : null,
    limit:
      signal.kind === "limit"
        ? {
            runId,
            resetAt: limitResetAt(shell),
            autoResume: shell.limitRecovery?.autoResume === true,
          }
        : null,
    failure:
      signal.kind === "failed"
        ? { runId, errorClass: shell.lastErrorClass ?? null, message: shell.lastError ?? null }
        : null,
  };
}
