// Aski's instance is Aski's, as on the Mac (the web's `stemcells/upstream/cellInstance.ts`): a
// Cell is never offered it, nor counts it as a second account of its driver, and a Cell's chat
// still on it reads as its driver's own instance, where the server carries it at its next send.
import {
  defaultInstanceIdForDriver,
  type ModelSelection,
  type ServerConfig,
} from "@t3tools/contracts";

import { ASKI_INSTANCE } from "../aski/chat";

export const isAskisInstance = (instanceId: string | null | undefined) =>
  instanceId === ASKI_INSTANCE;

/** The config a Cell picks from: every provider instance but Aski's. */
export function cellConfig<C extends ServerConfig | null | undefined>(config: C): C {
  if (!config?.providers.some((provider) => isAskisInstance(provider.instanceId))) return config;
  return {
    ...config,
    providers: config.providers.filter((provider) => !isAskisInstance(provider.instanceId)),
  };
}

/** A Cell's selection: one on Aski's instance moves to its driver's own. */
export function cellSelection<S extends ModelSelection | null | undefined>(
  config: ServerConfig | null | undefined,
  selection: S,
): S {
  if (selection == null || !isAskisInstance(selection.instanceId)) return selection;
  const driver =
    config?.providers.find((provider) => isAskisInstance(provider.instanceId))?.driver ??
    config?.settings?.providerInstances[selection.instanceId]?.driver;
  return driver === undefined
    ? selection
    : { ...selection, instanceId: defaultInstanceIdForDriver(driver) };
}
