/**
 * What a chat's Cell acts out, read from upstream's thread: the tool calls of
 * the run in progress, newest last, when its last turn landed, and when its
 * prompt cache goes cold. A Cell reads the turn items only while its chat
 * works, and the thread's detail once per landing. On the desktop app every
 * running thread's items are live already (upstream's
 * `RunningThreadKeepAlive`); in a browser this keeps a working chat's live
 * while its Cell is mounted.
 */
import { commandDisplayText } from "@t3tools/client-runtime/work-log/command-label";
import type {
  OrchestrationV2ProjectedTurnItem,
  OrchestrationV2ThreadProjection,
  OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import { useState } from "react";

import { latestProviderTurnTokenUsage } from "../../lib/contextWindow";
import {
  useQuietThreadShell,
  useThreadProjection,
  useThreadVisibleTurnItems,
} from "../../state/entities";
import type { ToolBeat } from "../cell/activity";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

/** Where a call stands: still running, returned, or gone wrong. */
function stateOf(status: OrchestrationV2TurnItem["status"]): ToolBeat["state"] {
  switch (status) {
    case "pending":
    case "running":
    case "waiting":
      return "requested";
    case "idle":
    case "completed":
      return "returned";
    case "failed":
    case "cancelled":
    case "interrupted":
      return "failed";
  }
}

/** The command a tool's input carries, when it carries one as text. */
function commandIn(input: unknown): string {
  if (typeof input === "string") return input;
  const command = (input as { readonly command?: unknown } | null | undefined)?.command;
  return typeof command === "string" ? command : "";
}

/**
 * A turn item as the call it is, named the way the original's classifier
 * (`cell/activity.ts`) reads tools; undefined for what is no call (words,
 * reasoning, notices).
 */
export function beatOf(item: OrchestrationV2TurnItem): ToolBeat | undefined {
  const state = stateOf(item.status);
  switch (item.type) {
    case "command_execution":
      // As upstream shows it: a shell's `-lc '…'` wrapper off, so the script's own words lead.
      return { name: "bash", brief: commandDisplayText(item.input), state };
    case "file_search":
      return { name: "grep", brief: item.pattern ?? "", state };
    case "web_search":
      return { name: "websearch", brief: item.patterns?.join(" ") ?? "", state };
    case "file_change":
      return { name: "edit", brief: item.fileName, state };
    case "dynamic_tool":
      return { name: item.toolName ?? "", brief: commandIn(item.input), state };
    case "subagent":
      return { name: "task", brief: item.prompt, state };
    default:
      return undefined;
  }
}

/** The calls of run `runId`, in the order the turn made them. */
export function beatsOf(
  items: ReadonlyArray<OrchestrationV2ProjectedTurnItem>,
  runId: string | null,
): ToolBeat[] {
  return items.flatMap(({ item }) => {
    if (runId !== null && item.runId !== runId) return [];
    return beatOf(item) ?? [];
  });
}

/** The calls of the chat's run in progress while `working`; none otherwise. */
export function useCellCalls(cell: CellRef | null, working: boolean): ToolBeat[] {
  const ref = cell ? threadRefOf(cell) : null;
  const shell = useQuietThreadShell(ref);
  const items = useThreadVisibleTurnItems(working ? ref : null);
  return working ? beatsOf(items, shell?.runtime?.activeRunId ?? null) : [];
}

/**
 * How long a Codex chat's prompt cache stays warm after its turn: OpenAI's
 * documented floor. Caches measured live longer, so this errs warm.
 */
export const CODEX_CACHE_MS = 30 * 60_000;

/**
 * When run `runId`'s prompt cache goes cold, from the thread's detail: the
 * expiry upstream's Claude adapter stamps on the turn's usage (an hour or five
 * minutes from the last request's start, by the tier that request wrote).
 * Undefined when the usage names none, as for a request served wholly from
 * cache; null until the detail has seen the run land.
 */
export function coldAtOf(
  projection: OrchestrationV2ThreadProjection,
  runId: string,
): number | undefined | null {
  if (!projection.runs.some((run) => run.id === runId && run.status === "completed")) return null;
  const providerThread = projection.providerThreads.find(
    (candidate) => candidate.id === projection.thread.activeProviderThreadId,
  );
  const expiresAt = latestProviderTurnTokenUsage(
    projection.providerTurns,
    projection,
    providerThread,
  )?.promptCacheExpiresAt;
  const at = expiresAt === undefined ? Number.NaN : Date.parse(expiresAt);
  return Number.isFinite(at) ? at : undefined;
}

/**
 * When a chat on `driver` whose turn landed at `landedAt` goes cold: Claude's
 * as read from its turn (`claude`), Codex's `CODEX_CACHE_MS` after the
 * landing. Any other provider makes no claim, so its Cell stays awake.
 */
export function coldAtFor(
  driver: string | null,
  landedAt: number,
  claude: number | undefined,
): number | undefined {
  switch (driver) {
    case "claudeAgent":
      return claude;
    case "codex":
      return landedAt + CODEX_CACHE_MS;
    default:
      return undefined;
  }
}

/**
 * When the chat's last turn landed and when its prompt cache goes cold, in
 * milliseconds since the epoch. `landedAt` is null before a turn has landed
 * or while one runs; `coldAt` is undefined when the Cell makes no claim
 * (`coldAtFor`). Claude's expiry is read from the thread's detail once per
 * landing.
 */
export function useCellRest(
  cell: CellRef | null,
  driver: string | null,
): { readonly landedAt: number | null; readonly coldAt: number | undefined } {
  const ref = cell ? threadRefOf(cell) : null;
  const run = useQuietThreadShell(ref)?.latestRun;
  const parsed =
    run?.status === "completed" && run.completedAt !== null
      ? Date.parse(run.completedAt)
      : Number.NaN;
  const landedAt = Number.isFinite(parsed) ? parsed : null;
  const landing = landedAt === null || run == null ? null : `${cell?.threadId}|${run.runId}`;
  const [read, setRead] = useState<{ landing: string; coldAt: number | undefined } | null>(null);
  const reading = driver === "claudeAgent" && landing !== null && read?.landing !== landing;
  const thread = useThreadProjection(reading ? ref : null);
  if (reading && thread !== null && run != null) {
    const coldAt = coldAtOf(thread.projection, run.runId);
    if (coldAt !== null) setRead({ landing, coldAt });
  }
  if (landedAt === null) return { landedAt, coldAt: undefined };
  const claude = read !== null && read.landing === landing ? read.coldAt : undefined;
  return { landedAt, coldAt: coldAtFor(driver, landedAt, claude) };
}
