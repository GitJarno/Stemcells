/**
 * What upstream knows of a chat's thread: its title and its project. Apart
 * from `chat.tsx`, which reaches upstream's chat view, so the line inside
 * that view can read these without importing the view back.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";

import { useProject, useQuietThreadShell } from "../../state/entities";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

/** The chat's title once it is a thread; null while it is an unsent draft. */
export function useCellTitle(cell: CellRef | null): string | null {
  return useQuietThreadShell(cell ? threadRefOf(cell) : null)?.title ?? null;
}

/**
 * Where the chat works: its project's title, as upstream's chat header names
 * it, or upstream's own words for a chat started without a project. Null
 * while the chat is an unsent draft.
 */
export function useCellPlace(
  cell: CellRef | null,
): { readonly name: string; readonly isProject: boolean } | null {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  const project = useProject(shell ? scopeProjectRef(shell.environmentId, shell.projectId) : null);
  if (project === null) return null;
  return project.isScratch
    ? { name: "No project", isProject: false }
    : { name: project.title, isProject: true };
}
