/**
 * What needs the person, read from T3's thread shells: at most one signal per Cell, the most
 * blocking (stemcells/tasks/aski-room.md, decision 2 and "Item types"). Pure. A finished run
 * is a prose candidate the pre-read of its last reply keeps or drops; a running one quiet too
 * long is a stuck candidate, kept or dropped by what it is in the middle of (`stuckFor`).
 */
import * as DateTime from "effect/DateTime";

import type {
  ApprovalOption,
  AskedQuestion,
  FailureClass,
  FullAccessOverride,
  InFlight,
  PlanDetail,
  RequestDetail,
  RequestKind,
  Shell,
} from "../upstream/needs.ts";
import type { Stop } from "./closeOut.ts";
import type { Cue, PreRead } from "./preread.ts";

/** The provider instance Aski's chat runs on; the web's `aski/setup.ts` names the same. */
export const ASKI_INSTANCE_ID = "aski";

/**
 * Aski's own chat among the Cells, whose asks show inline there: the
 * top-level chat on Aski's instance, the pinned one first, else the first
 * made, as the web's `askiChatAmong` picks it. Another chat on Aski's
 * instance (a new chat opened from Aski's page) is a Cell like any.
 */
export function askiThreadOf(shells: Iterable<Shell>): string | null {
  const rank = (shell: Shell) =>
    [shell.pinnedAt == null ? 1 : 0, DateTime.toEpochMillis(shell.createdAt)] as const;
  let aski: Shell | null = null;
  for (const shell of shells) {
    if (shell.providerInstanceId !== ASKI_INSTANCE_ID) continue;
    if (shell.lineage.parentThreadId !== null || shell.deletedAt !== null) continue;
    if (aski === null) {
      aski = shell;
      continue;
    }
    const [pinned, made] = rank(shell);
    const [askiPinned, askiMade] = rank(aski);
    if (pinned < askiPinned || (pinned === askiPinned && made < askiMade)) aski = shell;
  }
  return aski?.id ?? null;
}

export type NeedKind =
  | "permission"
  | "question"
  | "sign-in"
  | "input"
  | "limit"
  | "failed"
  | "plan"
  | "prose"
  | "stuck";

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

/**
 * A run quiet this long with the model itself at work is stuck. Measured on
 * the Swift app's working transcripts: of 83,439 such gaps the longest
 * benign one was 9.4 min, and every gap past 12 min fell in an outage.
 */
export const QUIET_MS = 12 * 60 * 1000;
/**
 * With a tool call in flight, or not yet known: a build or a test runs long
 * and says nothing until it ends. Three times the 10 min a CLI gives a
 * foreground command.
 */
export const TOOL_QUIET_MS = 30 * 60 * 1000;

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

/** A run under way: it may be setting up, queued, working or waiting on a request. */
export const ACTIVE_RUN = new Set<Shell["status"]>([
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

/** Waits on what finishes without the person: its own background work, or another Cell. */
export const waitsOnItsOwn = (shell: Shell) =>
  shell.blockedOnThreadWait === true || (shell.pendingBackgroundTasks ?? []).length > 0;

/**
 * How long a stuck candidate has been quiet, once that is past its bound:
 * 12 min with the model at work, 30 with a tool call in flight or before
 * that is known. Null while it is still inside its bound.
 */
export function stuckFor(signal: Signal, inFlight: InFlight | null, now: number): number | null {
  const quiet = now - signal.since;
  const bound = inFlight === null || inFlight.tool !== null ? TOOL_QUIET_MS : QUIET_MS;
  return quiet >= bound ? quiet : null;
}

/**
 * The one thing this Cell needs from the person now, or null. `heardAt` is
 * the last time the Cell showed life: an event of its own work, as the
 * service hears them.
 */
export function signalOf(shell: Shell, now: number, heardAt: number = now): Signal | null {
  if (shell.deletedAt !== null || shell.archivedAt !== null) return null;
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

  const activeRunId = shell.activeRunId;
  if (activeRunId !== null && shell.status === "running") {
    return !waitsOnItsOwn(shell) && now - heardAt >= QUIET_MS
      ? {
          key: `${shell.id}:stuck:${activeRunId}:${heardAt}`,
          kind: "stuck",
          shell,
          since: heardAt,
          blocks: false,
        }
      : null;
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
  // A subagent's reply is its parent's to read, and a settled Cell is done.
  if (
    shell.status === "completed" &&
    runSettled(shell) &&
    shell.settledOverride !== "settled" &&
    shell.lineage.parentThreadId === null &&
    !waitsOnItsOwn(shell)
  ) {
    return { ...ended, key: `${shell.id}:prose:${runId}`, kind: "prose" };
  }
  return null;
}

/**
 * Every Cell's signal, Aski's own chat and its subagents left out. `heard`
 * is when each Cell last showed life.
 */
export function signalsOf(
  shells: ReadonlyArray<Shell>,
  now: number,
  heard: ReadonlyMap<string, number> = new Map(),
): ReadonlyArray<Signal> {
  const aski = askiThreadOf(shells);
  return shells.flatMap((shell) =>
    shell.id === aski || shell.lineage.rootThreadId === aski
      ? []
      : (signalOf(shell, now, heard.get(shell.id) ?? now) ?? []),
  );
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
  /** The provider's own words for why it asks, quoted on the card. */
  readonly reason: string | null;
  /** Why a Cell with full access still asks: the person's ask rule, or the provider's own check. */
  readonly fullAccessOverride: FullAccessOverride | null;
  /** The provider's own choices, in its order; empty when it offers none. */
  readonly options: ReadonlyArray<ApprovalOption>;
  readonly questions: ReadonlyArray<AskedQuestion>;
  readonly responseMode: "message" | null;
  /** Null when the request couldn't be read; the card then only opens the chat. */
  readonly capability: "live" | "message" | "not_resumable" | null;
}

export interface NeedPlan {
  /** Null when the plan couldn't be read; the card then only opens the chat. */
  readonly id: string | null;
  readonly runId: string;
  readonly title: string | null;
  readonly steps: ReadonlyArray<string>;
  /** The whole plan, which building it sends back to the Cell. */
  readonly markdown: string | null;
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

export interface NeedProse {
  readonly runId: string;
  /** What the pre-read found: a question, an offer to go on, or a stop short of done. */
  readonly cue: Cue;
  /** The reply's last paragraph, word for word. */
  readonly text: string;
}

export interface NeedStuck {
  readonly runId: string;
  /** The last time the Cell showed life. */
  readonly quietSince: string;
  /** The tool call it is in the middle of; null with the model itself at work. */
  readonly tool: InFlight["tool"];
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
  /** The provider instance the Cell runs on, for a sign-in. */
  readonly providerInstanceId: string;
  readonly since: string;
  readonly blocks: boolean;
  readonly request: NeedRequest | null;
  readonly plan: NeedPlan | null;
  readonly limit: NeedLimit | null;
  readonly failure: NeedFailure | null;
  readonly prose: NeedProse | null;
  readonly stuck: NeedStuck | null;
}

export interface NeedDetail {
  readonly request?: RequestDetail | null;
  readonly plan?: PlanDetail | null;
  /** Null: the reply leaves the person nothing, or couldn't be read. */
  readonly prose?: PreRead | null;
  /** What the finished reply says of where the Cell stands; null when it couldn't be read. */
  readonly stop?: Stop | null;
  readonly inFlight?: InFlight | null;
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
    providerInstanceId: shell.providerInstanceId,
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
            reason: read?.reason ?? null,
            fullAccessOverride: read?.fullAccessOverride ?? null,
            options: read?.options ?? [],
            questions: read?.questions ?? [],
            responseMode: read?.responseMode ?? null,
            capability: read?.capability ?? null,
          },
    plan:
      signal.kind === "plan"
        ? {
            id: detail.plan?.id ?? null,
            runId,
            title: outline?.title ?? null,
            steps: outline?.steps ?? [],
            markdown: detail.plan?.markdown ?? null,
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
    prose:
      signal.kind === "prose" && detail.prose != null
        ? { runId, cue: detail.prose.cue, text: detail.prose.text }
        : null,
    stuck:
      signal.kind === "stuck"
        ? {
            runId: shell.activeRunId ?? runId,
            quietSince: DateTime.formatIso(DateTime.makeUnsafe(signal.since)),
            tool: detail.inFlight?.tool ?? null,
          }
        : null,
  };
}
