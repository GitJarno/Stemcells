/**
 * The project a new chat starts in when no chat on screen gives it one:
 * upstream's first project (`useHandleNewThread`'s `defaultProjectRef`), the
 * sidebar's first. Upstream counts the scratch project among them, though
 * the sidebar shows none: Aski's chat opens it at the first launch
 * (`aski.ts`), so on a fresh install it comes first, and every new chat
 * would start in no project. Past it, the first project there is.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import type { EnvironmentId, ProjectId, ScopedProjectRef } from "@t3tools/contracts";

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

/** `pastScratch` over the projects the app knows now. */
export function firstProject(first: ScopedProjectRef | null): ScopedProjectRef | null {
  if (first === null) return null;
  const configs = appAtomRegistry.get(environmentServerConfigsAtom);
  return pastScratch(
    first,
    readProjects().map((project) => ({
      environmentId: project.environmentId,
      id: project.id,
      scratch: isScratchProject(project, configs.get(project.environmentId)?.scratchWorkspaceRoot),
    })),
  );
}
