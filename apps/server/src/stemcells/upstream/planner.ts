import type { ModelSelection, ProjectId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";

import * as ServerConfig from "../../config.ts";
import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";
import * as ProviderInstanceRegistry from "../../provider/ProviderInstanceRegistry.ts";

// What Aski's planner takes from upstream: a provider instance's lean
// structured call (`runLean`, a seam in provider-core), where the person's
// projects live, and the app's own data folder.

/** The lean structured call of the instance `selection` names; null when it is off or has none. */
export const leanRunner = Effect.fn("Planner.leanRunner")(function* (selection: ModelSelection) {
  const registry = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  const instance = yield* registry.getInstance(selection.instanceId);
  if (instance === undefined || !instance.enabled) return null;
  return instance.textGeneration.runLean ?? null;
});

/** The workspace roots of the projects `ids` name that this server holds. */
export const projectRoots = Effect.fn("Planner.projectRoots")(
  function* (ids: ReadonlyArray<ProjectId>) {
    const store = yield* ProjectStore.ProjectStoreV2;
    const shells = yield* store.listShells({ projectIds: ids });
    return new Map(shells.map((shell) => [shell.id as string, shell.workspaceRoot]));
  },
  // Without the roots the planner still plans, on names alone.
  Effect.catchTags({
    ProjectStoreV2Error: (error) =>
      Effect.logWarning("Planner: projects unavailable", { operation: error.operation }).pipe(
        Effect.as(new Map<string, string>()),
      ),
  }),
);

/** Where the plan history lives: in the app's own data folder, on this machine. */
export const historyFolder = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return path.join(config.stateDir, "stemcells", "plans");
});
