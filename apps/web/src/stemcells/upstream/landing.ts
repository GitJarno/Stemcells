/**
 * What landing new Cells reads from upstream (tabs/landing.ts): the project
 * a Cell works in, and the chats agents start through the tools
 * (`t3_thread_launch`) as their shells arrive.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readThreadShell, readThreadShells, waitForThreadShell } from "../../state/entities";
import { environmentThreadShells } from "../../state/threads";
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
