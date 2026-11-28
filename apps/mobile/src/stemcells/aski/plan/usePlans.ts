import { useSyncExternalStore } from "react";

import { trays } from "./run";
import type { PlanEntry } from "./trays";

/** The plans the phone holds; a view draws again when any of them changes. */
export function usePlans(): ReadonlyMap<string, PlanEntry> {
  return useSyncExternalStore(trays.subscribe, trays.read, trays.read);
}
