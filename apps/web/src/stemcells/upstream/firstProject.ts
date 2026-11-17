/**
 * The project a new chat starts in when no chat on screen gives one: upstream's first
 * (`useHandleNewThread`'s `defaultProjectRef`), past the scratch project, which Aski's chat opens
 * at first launch (`aski.ts`), and the Disk project, which Free space may make before any other.
 * Upstream counts both, so a new chat would start in no project, or among the cleanup Cells.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ProjectId, ScopedProjectRef } from "@t3tools/contracts";
import { normalizeProjectPathForComparison } from "@t3tools/shared/path";

import { diskProjectFolder } from "../../../../../stemcells/disk/project.ts";

export interface ProjectFact {
  readonly environmentId: EnvironmentId;
  readonly id: ProjectId;
  readonly aside: boolean;
}

/** `first` (upstream's), unless it is set aside and `projects`, in upstream's order, hold another. */
export function pastAside(
  first: ScopedProjectRef | null,
  projects: readonly ProjectFact[],
): ScopedProjectRef | null {
  const chosen = projects.find(
    (project) => project.id === first?.projectId && project.environmentId === first.environmentId,
  );
  if (!chosen?.aside) return first;
  const real = projects.find((project) => !project.aside);
  return real ? scopeProjectRef(real.environmentId, real.id) : first;
}

const isFolder = (workspaceRoot: string, folder: string | null | undefined) => {
  if (folder == null) return false;
  const normalized = normalizeProjectPathForComparison(folder);
  return normalized.length > 0 && normalizeProjectPathForComparison(workspaceRoot) === normalized;
};

/**
 * Upstream's `isScratchProject`, read without its module: that one re-exports the project
 * commands and loads their connection layer, and this file loads with every new chat
 * (`substitutes/chatThreadActions.ts`), in upstream's tests too. `firstProject.test.ts` holds
 * the two to the same answers.
 */
export function isScratchWorkspace(
  workspaceRoot: string,
  scratchWorkspaceRoot: string | null | undefined,
): boolean {
  return isFolder(workspaceRoot, scratchWorkspaceRoot);
}

/** The scratch project's folder or the Disk project's, on the machine `config` describes. */
export function isAsideWorkspace(
  workspaceRoot: string,
  config: { readonly scratchWorkspaceRoot?: string; readonly newProjectsRoot?: string } | undefined,
): boolean {
  const projectsRoot = config?.newProjectsRoot;
  return (
    isScratchWorkspace(workspaceRoot, config?.scratchWorkspaceRoot) ||
    isFolder(workspaceRoot, projectsRoot === undefined ? null : diskProjectFolder(projectsRoot))
  );
}

let knownProjects: (() => readonly ProjectFact[]) | null = null;

/**
 * Where `firstProject` reads the app's projects. This file stays free of the app's state:
 * upstream's connection layer loads the composer's store, which loads the new-chat actions this
 * serves, so importing state here closes a loop that leaves the connection runtime undefined.
 * `firstProjectFacts.ts` hands the projects in, loaded with the workspace.
 */
export function readProjectFactsFrom(source: () => readonly ProjectFact[]): void {
  knownProjects = source;
}

/** `pastAside` over the projects the app knows now; upstream's first until the workspace loads. */
export function firstProject(first: ScopedProjectRef | null): ScopedProjectRef | null {
  if (first === null || knownProjects === null) return first;
  return pastAside(first, knownProjects());
}
