/**
 * What landing new Cells reads from upstream (tabs/landing.ts): the project
 * a Cell works in, and the chats agents start through the tools
 * (`t3_thread_launch`) as their shells arrive.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readThreadShell, readThreadShells } from "../../state/entities";
import { environmentThreadShells } from "../../state/threads";
import type { CellRef } from "../tabs/layout";
import { draftProject } from "./newCell";
import { threadRefOf } from "./routes";

/** The project a Cell works in, as `environmentId/projectId`, a draft's too; null when unknown. */
export function cellProject(cell: CellRef): string | null {
  const shell = readThreadShell(threadRefOf(cell));
  return shell ? `${shell.environmentId}/${shell.projectId}` : draftProject(cell);
}

/**
 * How long a launched chat counts as new: one an agent started while the
 * app was closed, or that a server reconnecting brings in later, was
 * started for no one looking.
 */
const NEW_FOR_MS = 2 * 60_000;

/**
 * The chats in `shells` an agent started through the tools that `seen`
 * hasn't: chats of their own (not a subagent's or a fork), made in the
 * last two minutes. Every shell is `seen` after.
 */
export function launchesAmong(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  seen: Set<string>,
  now: number,
): CellRef[] {
  return shells.flatMap((shell) => {
    const key = `${shell.environmentId}/${shell.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const launched =
      shell.source.createdBy === "agent" &&
      shell.source.creationSource === "mcp" &&
      shell.lineage.parentThreadId === null &&
      shell.archivedAt === null &&
      now - Date.parse(shell.createdAt) <= NEW_FOR_MS;
    return launched
      ? [{ environmentId: shell.environmentId, threadId: shell.id, draftId: null }]
      : [];
  });
}

/** Calls `listener` with the chats agents launch from now on, as they arrive. Returns the unsubscribe. */
export function subscribeLaunches(listener: (cells: CellRef[]) => void): () => void {
  const seen = new Set<string>();
  launchesAmong(readThreadShells(), seen, Date.now());
  return appAtomRegistry.subscribe(environmentThreadShells.threadShellsAtom, (shells) => {
    const cells = launchesAmong(shells, seen, Date.now());
    if (cells.length > 0) listener(cells);
  });
}
