/**
 * What a chat's Cell acts out, read from upstream's thread: the tool calls of
 * the run in progress, newest last, when anything last came into it, when its
 * last turn landed, when its prompt cache goes cold, how long it has worked
 * alone, and what its last run did to the lines of its files. A Cell reads
 * the turn items only while its chat works, and the thread's detail as it is
 * drawn and as a run starts or lands. On the desktop app every running
 * thread's items are live already (upstream's `RunningThreadKeepAlive`); in
 * a browser this keeps a working chat's live while its Cell is mounted.
 */
import { commandDisplayText } from "@t3tools/client-runtime/work-log/command-label";
import type {
  OrchestrationV2Checkpoint,
  OrchestrationV2ExecutionNode,
  OrchestrationV2ProjectedTurnItem,
  OrchestrationV2Run,
  OrchestrationV2RuntimeRequest,
  OrchestrationV2ThreadProjection,
  OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import { DateTime } from "effect";
import { useEffect, useState } from "react";

import { latestProviderTurnTokenUsage } from "../../lib/contextWindow";
import {
  useQuietThreadShell,
  useThreadProjection,
  useThreadVisibleTurnItems,
} from "../../state/entities";
import { ACTIVITY_HOLD, budsOf, type ToolBeat } from "../cell/activity";
import { aloneIn, FLEX_MS, type Span, strengthOf } from "../cell/growth";
import type { Strength } from "../cell/kit";
import type { Diff } from "../cell/scene";
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

/** How many of a chat's subagents work on in the background, its turn over: upstream's pending background work of that kind. */
export function subagentsAwayOf(
  tasks: ReadonlyArray<{ readonly kind: string }> | undefined,
): number {
  return tasks?.filter((task) => task.kind === "subagent").length ?? 0;
}

/** The chat's subagents at work in the background (`subagentsAwayOf`). */
export function useCellSubagentsAway(cell: CellRef | null): number {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  return subagentsAwayOf(shell?.pendingBackgroundTasks);
}

/**
 * The buds a chat's Cell stands beside it (`budsOf`): its subagents at work.
 * While it works, those are its subagent items still running, in any run: a
 * subagent sent to the background keeps its item running past the turn that
 * started it. Its upstream lists them as pending background work too, which
 * is all there is to read once the chat stops working.
 */
export function useCellBuds(cell: CellRef | null, working: boolean): number {
  const ref = cell ? threadRefOf(cell) : null;
  const shell = useQuietThreadShell(ref);
  const items = useThreadVisibleTurnItems(working ? ref : null);
  return budsOf(
    working ? beatsOf(items, null) : [],
    subagentsAwayOf(shell?.pendingBackgroundTasks),
  );
}

/** What a run's items say, as a key that turns with each new item, change and word; and whether a compaction is running. */
export function newsOf(
  items: ReadonlyArray<OrchestrationV2ProjectedTurnItem>,
  runId: string | null,
): { readonly key: string; readonly compacting: boolean } {
  let count = 0;
  let latest = 0;
  let words = 0;
  let compacting = false;
  for (const { item } of items) {
    if (runId !== null && item.runId !== runId) continue;
    count += 1;
    latest = Math.max(latest, DateTime.toEpochMillis(item.updatedAt));
    if (item.type === "assistant_message" || item.type === "reasoning") words += item.text.length;
    if (item.type === "compaction" && stateOf(item.status) === "requested") compacting = true;
  }
  return { key: `${runId}|${count}|${latest}|${words}`, compacting };
}

/**
 * Whether the chat's thought has gone deep, as the original's did: it is
 * `quiet` (it shows thinking with no call in flight), nothing has come into
 * the run (its start, a call, a change in one, a word of the reply or of its
 * shown thought) for the activity's hold, and no compaction runs.
 */
export function useCellDeep(cell: CellRef | null, working: boolean, quiet: boolean): boolean {
  const ref = cell ? threadRefOf(cell) : null;
  const shell = useQuietThreadShell(ref);
  const items = useThreadVisibleTurnItems(working ? ref : null);
  const news = newsOf(items, shell?.runtime?.activeRunId ?? null);
  const [silent, setSilent] = useState<string | null>(null);
  // The silence counts from the last news, quiet or not, as the original's.
  useEffect(() => {
    if (!working) return;
    const timer = setTimeout(() => setSilent(news.key), ACTIVITY_HOLD);
    return () => clearTimeout(timer);
  }, [working, news.key]);
  return working && quiet && !news.compacting && silent === news.key;
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

/**
 * How long a chat's Cell has worked alone (`cell/growth.ts`), from its
 * thread's detail: each landed run from its start to its landing, less the
 * time a blocking request of the run waited on you, summed (`alone`); and
 * run `runId`'s own (`run`). Null while the detail hasn't seen `runId` land.
 */
export function growthOf(
  projection: {
    readonly runs: ReadonlyArray<
      Pick<OrchestrationV2Run, "id" | "status" | "startedAt" | "completedAt">
    >;
    readonly runtimeRequests: ReadonlyArray<
      Pick<
        OrchestrationV2RuntimeRequest,
        "nodeId" | "responseCapability" | "createdAt" | "resolvedAt"
      >
    >;
    readonly nodes: ReadonlyArray<Pick<OrchestrationV2ExecutionNode, "id" | "runId">>;
  },
  runId: string | null,
): { readonly alone: number; readonly run: number } | null {
  const runOf = new Map(projection.nodes.map((node) => [node.id, node.runId]));
  const waits = new Map<string, Span[]>();
  for (const request of projection.runtimeRequests) {
    // Upstream's own test for a request that holds the run (its shell's `blocking`).
    if (request.responseCapability.type === "message") continue;
    const run = runOf.get(request.nodeId);
    if (run == null) continue;
    const to = request.resolvedAt === null ? Infinity : DateTime.toEpochMillis(request.resolvedAt);
    waits.set(run, [
      ...(waits.get(run) ?? []),
      { from: DateTime.toEpochMillis(request.createdAt), to },
    ]);
  }
  let alone = 0;
  let last: number | null = runId === null ? 0 : null;
  for (const run of projection.runs) {
    if (run.status !== "completed" || run.startedAt === null || run.completedAt === null) continue;
    const worked = aloneIn({
      from: DateTime.toEpochMillis(run.startedAt),
      to: DateTime.toEpochMillis(run.completedAt),
      waits: waits.get(run.id) ?? [],
    });
    alone += worked;
    if (run.id === runId) last = worked;
  }
  return last === null ? null : { alone, run: last };
}

/**
 * What run `runId` did to the lines of the files it changed, from its
 * checkpoints: git's count of the lines each file gained and lost. A run
 * that changed no file did neither.
 */
export function diffOf(
  projection: {
    readonly checkpoints: ReadonlyArray<Pick<OrchestrationV2Checkpoint, "runId" | "files">>;
  },
  runId: string,
): Diff {
  const files = projection.checkpoints.flatMap((checkpoint) =>
    checkpoint.runId === runId ? checkpoint.files : [],
  );
  return {
    added: files.some((file) => file.additions > 0),
    removed: files.some((file) => file.deletions > 0),
  };
}

const NO_DIFF: Diff = { added: false, removed: false };

/**
 * What the chat's Cell carries from its landings: how strong it has grown,
 * and what its last landing cheers with, the flex (its run worked alone
 * `FLEX_MS` or more) and the marks of the lines the run added and removed.
 * Read from the thread's detail as the Cell is drawn, again as a run
 * starts, and as it lands.
 */
export function useCellLanding(cell: CellRef | null): {
  readonly strength: Strength | undefined;
  readonly flexes: boolean;
  readonly diff: Diff;
} {
  const ref = cell ? threadRefOf(cell) : null;
  const run = useQuietThreadShell(ref)?.latestRun;
  const landed = run?.status === "completed" ? run.runId : null;
  const key = cell === null ? null : `${cell.threadId}|${run?.runId ?? ""}|${landed !== null}`;
  const [read, setRead] = useState<{
    key: string;
    thread: string;
    alone: number;
    run: number;
    diff: Diff;
  } | null>(null);
  const reading = key !== null && read?.key !== key;
  const thread = useThreadProjection(reading ? ref : null);
  if (reading && cell !== null && thread !== null) {
    const growth = growthOf(thread.projection, landed);
    const diff = landed === null ? NO_DIFF : diffOf(thread.projection, landed);
    if (growth !== null) setRead({ key, thread: cell.threadId, ...growth, diff });
  }
  // Until the next read, the last one of this chat's stands: growth only comes as a run lands.
  const mine = read !== null && read.thread === cell?.threadId ? read : null;
  const cheer = landed !== null && mine?.key === key ? mine : null;
  return {
    strength: strengthOf(mine?.alone ?? 0),
    flexes: cheer !== null && cheer.run >= FLEX_MS,
    diff: cheer?.diff ?? NO_DIFF,
  };
}
