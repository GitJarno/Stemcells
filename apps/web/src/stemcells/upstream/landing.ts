/**
 * What landing new Cells reads from upstream (tabs/landing.ts): the project
 * a Cell works in, the chats agents start through the tools
 * (`t3_thread_launch`) as their shells arrive, and every chat started
 * anywhere else: the phone, another Mac, an agent.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readThreadShell, readThreadShells, waitForThreadShell } from "../../state/entities";
import { environmentThreadShells } from "../../state/threads";
import { isAskisInstance } from "../aski/setup";
import type { CellRef } from "../tabs/layout";
import { draftProject } from "./newCell";
import { threadRefOf } from "./routes";

/** The project a Cell works in, as `environmentId/projectId`, a draft's too; null when unknown. */
export function cellProject(cell: CellRef): string | null {
  const shell = readThreadShell(threadRefOf(cell));
  return shell ? `${shell.environmentId}/${shell.projectId}` : draftProject(cell);
}

/** Once each Cell's chat is known here, a moment after it starts; a few seconds at most. */
export async function cellsKnown(cells: readonly CellRef[]): Promise<void> {
  await Promise.all(cells.map((cell) => waitForThreadShell(threadRefOf(cell))));
}

/**
 * How long a launched chat counts as new: one a server reconnecting brings
 * in later was started for no one looking.
 */
const NEW_FOR_MS = 2 * 60_000;
/** How far a server's clock may run ahead of this page's for a chat it just made. */
const CLOCK_SLACK_MS = 5_000;

/**
 * The chats in `shells` an agent started through the tools that `seen`
 * hasn't: chats of their own (not a subagent's or a fork), made since
 * `since` and in the last two minutes. Every shell is `seen` after.
 */
export function launchesAmong(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  seen: Set<string>,
  now: number,
  since: number,
): CellRef[] {
  return shells.flatMap((shell) => {
    const key = `${shell.environmentId}/${shell.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const made = Date.parse(shell.createdAt);
    const launched =
      shell.source.createdBy === "agent" &&
      shell.source.creationSource === "mcp" &&
      shell.lineage.parentThreadId === null &&
      shell.archivedAt === null &&
      made >= since &&
      now - made <= NEW_FOR_MS;
    return launched
      ? [{ environmentId: shell.environmentId, threadId: shell.id, draftId: null }]
      : [];
  });
}

/**
 * Calls `listener` with the chats agents launch from now on, as they
 * arrive: one made before (a reload brings every chat in again) never
 * passes. Returns the unsubscribe.
 */
export function subscribeLaunches(listener: (cells: CellRef[]) => void): () => void {
  const seen = new Set<string>();
  const since = Date.now() - CLOCK_SLACK_MS;
  const take = (shells: ReadonlyArray<EnvironmentThreadShell>) => {
    const cells = launchesAmong(shells, seen, Date.now(), since);
    if (cells.length > 0) listener(cells);
  };
  take(readThreadShells());
  return appAtomRegistry.subscribe(environmentThreadShells.threadShellsAtom, take);
}

/**
 * The chats in `shells` new to this app, each examined once (`seen`): a Cell
 * of its own (not a subagent's, a fork, Aski's chat or one the system made),
 * open (neither archived nor settled), and made after the newest one `through` holds for its server, or
 * after `since` on a server it holds none for. `through` moves past each.
 */
export function arrivalsAmong(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  seen: Set<string>,
  through: Map<string, number>,
  since: number,
): CellRef[] {
  const fresh = shells.filter((shell) => !seen.has(`${shell.environmentId}/${shell.id}`));
  const marks = new Map(through);
  return fresh.flatMap((shell) => {
    seen.add(`${shell.environmentId}/${shell.id}`);
    const made = Date.parse(shell.createdAt);
    const mark = marks.get(shell.environmentId) ?? since;
    through.set(shell.environmentId, Math.max(through.get(shell.environmentId) ?? mark, made));
    const { createdBy, creationSource } = shell.source;
    const arrived =
      made > mark &&
      (createdBy === "user" || (createdBy === "agent" && creationSource === "mcp")) &&
      shell.lineage.parentThreadId === null &&
      shell.archivedAt === null &&
      shell.settledOverride !== "settled" &&
      !isAskisInstance(shell.providerInstanceId);
    return arrived
      ? [{ environmentId: shell.environmentId, threadId: shell.id, draftId: null }]
      : [];
  });
}

/** Per server, the newest chat this app has seen: kept, so one started while it was closed still lands. */
const SEEN_THROUGH_KEY = "stemcells.landing.seenThrough";

function readSeenThrough(): Map<string, number> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SEEN_THROUGH_KEY) ?? "{}");
    if (typeof stored !== "object" || stored === null) return new Map();
    return new Map(
      Object.entries(stored).filter((entry): entry is [string, number] =>
        Number.isFinite(entry[1]),
      ),
    );
  } catch {
    return new Map();
  }
}

function writeSeenThrough(through: ReadonlyMap<string, number>): void {
  try {
    localStorage.setItem(SEEN_THROUGH_KEY, JSON.stringify(Object.fromEntries(through)));
  } catch {
    // Lost, a server's chats count as seen from the next start.
  }
}

/**
 * Calls `listener` with each chat started on another device, by an agent,
 * or here, as it arrives, and with those started since this app last saw
 * its server; landing leaves one a pane shows where it is. Returns the
 * unsubscribe.
 */
export function subscribeArrivals(listener: (cells: CellRef[]) => void): () => void {
  const seen = new Set<string>();
  const through = readSeenThrough();
  const since = Date.now() - CLOCK_SLACK_MS;
  const take = (shells: ReadonlyArray<EnvironmentThreadShell>) => {
    const examined = seen.size;
    const cells = arrivalsAmong(shells, seen, through, since);
    if (seen.size !== examined) writeSeenThrough(through);
    if (cells.length > 0) listener(cells);
  };
  take(readThreadShells());
  // A new chat changes the quiet list; a run's streaming doesn't.
  return appAtomRegistry.subscribe(environmentThreadShells.quietThreadShellsAtom, take);
}
