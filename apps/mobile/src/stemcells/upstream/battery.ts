import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, HostResourcesSnapshot } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";
import { useContext, useEffect } from "react";

import { serverEnvironment } from "../../state/server";
import { readEvery } from "./disk";

// What the phone's glance at the laptops takes from upstream: each machine's host resources,
// read once per machine however many ask (`disk.ts`), a deadline's clock, and the theme's
// light or dark, for the charge's colours.

export { useDeadlinePassed } from "../../lib/clock";
export { useAppearancePreferences } from "../../features/settings/appearance/AppearancePreferencesProvider";

const SEPARATOR = "\n";

const snapshotsOf = Atom.family((ids: string) =>
  Atom.make((get) =>
    (ids === "" ? [] : ids.split(SEPARATOR)).map((environmentId) => {
      const result = get(
        serverEnvironment.hostResources({
          environmentId: environmentId as EnvironmentId,
          input: {},
        }),
      );
      const snapshot: HostResourcesSnapshot | null | undefined =
        result._tag === "Initial" ? undefined : Option.getOrNull(AsyncResult.value(result));
      return { environmentId, snapshot };
    }),
  ),
);

/**
 * These machines' host resources: each snapshot undefined until its first answer, null when it
 * gave none. Read on mount and every 30 s while the app is in front.
 */
export function useMachineSnapshots(environmentIds: ReadonlyArray<string>) {
  const registry = useContext(RegistryContext);
  const key = environmentIds.join(SEPARATOR);
  const snapshots = useAtomValue(snapshotsOf(key));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep these machines' resources read on an interval while anything shows them.
  useEffect(() => {
    const stops = (key === "" ? [] : key.split(SEPARATOR)).map((environmentId) =>
      readEvery(registry, environmentId as EnvironmentId),
    );
    return () => {
      for (const stop of stops) stop();
    };
  }, [registry, key]);
  return snapshots;
}
