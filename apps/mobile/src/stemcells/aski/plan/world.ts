// What the phone tells the compiler about one machine (stemcells/tasks/aski-orchestrator.md,
// decision 3): its projects as places, the most recently used first; its models by the names a
// person reads; its awake Cells. Built by the rules the Mac uses
// (`stemcells/orchestrator/context.ts`).

import {
  byRecency,
  type CatalogProvider,
  gateNames,
  modelEntries,
} from "../../../../../../stemcells/orchestrator/context.ts";
import type {
  LiveCell,
  ModelEntry,
  PlaceEntry,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import { cellNameOf } from "../../../../../../stemcells/words/cellNames.ts";

/** A place's key, the phone's own: the machine and the project on it. */
export const placeKey = (environmentId: string, projectId: string): string =>
  `${environmentId}:${projectId}`;

/** The machine and project a place's key names; null for a key that isn't the phone's. */
export function placeOfKey(key: string): { environmentId: string; projectId: string } | null {
  const at = key.indexOf(":");
  if (at <= 0 || at === key.length - 1) return null;
  return { environmentId: key.slice(0, at), projectId: key.slice(at + 1) };
}

export interface WorldProject {
  readonly environmentId: string;
  readonly id: string;
  readonly title: string;
  /** A casual chat's project: no word names it. */
  readonly isScratch?: boolean | undefined;
  readonly archivedAt?: string | null | undefined;
}

export interface WorldShell {
  readonly environmentId: string;
  readonly id: string;
  readonly projectId: string;
  /** Its last activity, as an ISO time. */
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
  readonly lineage: { readonly parentThreadId: string | null };
}

/** A machine's projects a Cell can start in, the most recently used first. */
export function placesOf(
  environmentId: string,
  projects: ReadonlyArray<WorldProject>,
  lastUsed: ReadonlyMap<string, string>,
): PlaceEntry[] {
  return byRecency(
    projects
      .filter(
        (project) =>
          project.environmentId === environmentId &&
          project.isScratch !== true &&
          (project.archivedAt ?? null) === null,
      )
      .map((project) => ({
        id: placeKey(project.environmentId, project.id),
        name: project.title,
      })),
    lastUsed,
  );
}

export interface World {
  readonly places: PlaceEntry[];
  readonly models: ModelEntry[];
  readonly cells: LiveCell[];
  /** The words that send a message to the compiler when it opens with one. */
  readonly names: Set<string>;
}

/**
 * The world of the machine `environmentId`, where Aski's chat is: a plan's Cells start beside
 * it. `aski` are Aski's own chats, and `away` says a Cell is asleep: neither is a Cell to name.
 */
export function worldOf(input: {
  readonly environmentId: string;
  readonly projects: ReadonlyArray<WorldProject>;
  readonly shells: ReadonlyArray<WorldShell>;
  readonly providers: ReadonlyArray<CatalogProvider>;
  readonly effortOptions: ReadonlyArray<string>;
  readonly aski: ReadonlySet<string>;
  readonly away: (shell: WorldShell) => boolean;
}): World {
  const here = input.shells.filter(
    (shell) =>
      shell.environmentId === input.environmentId &&
      shell.deletedAt === null &&
      shell.lineage.parentThreadId === null &&
      !input.aski.has(shell.id),
  );
  const lastUsed = new Map<string, string>();
  for (const shell of here) {
    const key = placeKey(shell.environmentId, shell.projectId);
    if ((lastUsed.get(key) ?? "") < shell.updatedAt) lastUsed.set(key, shell.updatedAt);
  }
  const places = placesOf(input.environmentId, input.projects, lastUsed);
  const models = modelEntries(input.providers, input.effortOptions);
  const cells = here
    .filter((shell) => shell.archivedAt === null && !input.away(shell))
    .map((shell) => ({ threadId: shell.id, name: cellNameOf(shell.id) }));
  return { places, models, cells, names: gateNames(places, models) };
}
