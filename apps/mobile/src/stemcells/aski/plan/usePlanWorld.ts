// A machine's places and models as a plan's rows read them, kept in step with the app: the
// projects by when a Cell last worked in each, and the providers' own catalogs.

import { modelEntries } from "../../../../../../stemcells/orchestrator/context.ts";
import type { ModelEntry, PlaceEntry } from "../../../../../../stemcells/orchestrator/plan.ts";
import { useThreadShellsSelected } from "../../upstream/cells";
import {
  catalogProvider,
  EFFORT_OPTIONS,
  useMachineConfig,
  useProjects,
} from "../../upstream/plans";
import { placeKey, placesOf } from "./world";

export function usePlanWorld(environmentId: string): {
  readonly places: PlaceEntry[];
  readonly models: ModelEntry[];
} {
  const projects = useProjects();
  const config = useMachineConfig(environmentId);
  // The projects in the order they were last used: a row draws again only when that changes.
  const order = useThreadShellsSelected((shells) => {
    const latest = new Map<string, string>();
    for (const shell of shells) {
      if (shell.environmentId !== environmentId || shell.deletedAt !== null) continue;
      if ((latest.get(shell.projectId) ?? "") < shell.updatedAt)
        latest.set(shell.projectId, shell.updatedAt);
    }
    return [...latest]
      .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
      .map(([projectId]) => projectId)
      .join("\u0000");
  });
  const ranked = order === "" ? [] : order.split("\u0000");
  const lastUsed = new Map(
    ranked.map((projectId, index) => [
      placeKey(environmentId, projectId),
      String(ranked.length - index).padStart(6, "0"),
    ]),
  );
  return {
    places: placesOf(environmentId, projects, lastUsed),
    models: modelEntries((config?.providers ?? []).map(catalogProvider), EFFORT_OPTIONS),
  };
}
