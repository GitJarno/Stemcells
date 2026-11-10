/**
 * What the planner's route reads of upstream, stood in for its tests: the
 * provider instances a plan may run on and the projects this server holds.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";
import * as ProviderInstanceRegistry from "../../provider/ProviderInstanceRegistry.ts";

/** A registry answering `instanceOf(id)`; undefined is an instance that isn't there. */
export const instancesOf = (instanceOf: (id: string) => unknown) =>
  Layer.succeed(ProviderInstanceRegistry.ProviderInstanceRegistry, {
    getInstance: (id: string) => Effect.succeed(instanceOf(id)),
  } as never);

/** A project store holding `shells`, listed whole or by the ids asked for. */
export const projectsOf = (
  shells: ReadonlyArray<{ readonly id: string; readonly workspaceRoot: string }>,
) =>
  Layer.succeed(ProjectStore.ProjectStoreV2, {
    listShells: (options?: { readonly projectIds?: ReadonlyArray<string> }) =>
      Effect.succeed(shells.filter((shell) => options?.projectIds?.includes(shell.id) ?? true)),
  } as never);
