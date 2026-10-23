/**
 * The project a new chat starts in when no chat on screen gives it one:
 * upstream's first project (`useHandleNewThread`'s `defaultProjectRef`), the
 * sidebar's first. Upstream counts the scratch project among them, though
 * the sidebar shows none: Aski's chat opens it at the first launch
 * (`aski.ts`), so on a fresh install it comes first, and every new chat
 * would start in no project. Past it, the first project there is.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ProjectId, ScopedProjectRef } from "@t3tools/contracts";
import { normalizeProjectPathForComparison } from "@t3tools/shared/path";

import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readProjects } from "../../state/entities";
import { environmentServerConfigsAtom } from "../../state/server";

interface ProjectFact {
  readonly environmentId: EnvironmentId;
  readonly id: ProjectId;
  readonly scratch: boolean;
}

/** `first` (upstream's), unless it is a scratch project and `projects`, in upstream's order, hold another. */
export function pastScratch(
  first: ScopedProjectRef | null,
  projects: readonly ProjectFact[],
): ScopedProjectRef | null {
  const chosen = projects.find(
    (project) => project.id === first?.projectId && project.environmentId === first.environmentId,
  );
  if (!chosen?.scratch) return first;
  const real = projects.find((project) => !project.scratch);
  return real ? scopeProjectRef(real.environmentId, real.id) : first;
}

/**
 * Upstream's `isScratchProject`, read without its module: that one
 * re-exports the project commands, whose connection layer loads with it, and
 * this file loads with every new chat (`substitutes/chatThreadActions.ts`),
 * in upstream's own tests of the new chat too. `firstProject.test.ts` holds
 * the two to the same answers.
 */
export function isScratchWorkspace(
  workspaceRoot: string,
  scratchWorkspaceRoot: string | null | undefined,
): boolean {
  if (scratchWorkspaceRoot == null) return false;
  const scratch = normalizeProjectPathForComparison(scratchWorkspaceRoot);
  return scratch.length > 0 && normalizeProjectPathForComparison(workspaceRoot) === scratch;
}

/** `pastScratch` over the projects the app knows now. */
export function firstProject(first: ScopedProjectRef | null): ScopedProjectRef | null {
  if (first === null) return null;
  const configs = appAtomRegistry.get(environmentServerConfigsAtom);
  return pastScratch(
    first,
    readProjects().map((project) => ({
      environmentId: project.environmentId,
      id: project.id,
      scratch: isScratchWorkspace(
        project.workspaceRoot,
        configs.get(project.environmentId)?.scratchWorkspaceRoot,
      ),
    })),
  );
}
