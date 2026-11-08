import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";
import { useContext, useEffect } from "react";
import { AppState } from "react-native";

import { serverEnvironment } from "../../state/server";
import { type DiskFigures, keptDisks } from "../disk/kept";

// Each machine's free space, read from its server. Apart from `disk.ts` because a home row reads
// it, and `disk.ts` brings Settings' screens, whose app bar leads back to the home's list.

/** How often a machine's free space is read again while anything shows it. */
const MACHINE_DISK_EVERY_MS = 30_000;

/** No machine: never read. */
const NO_MACHINE = Atom.make(AsyncResult.initial());

const kept = keptDisks();

/** Each machine's one reader, however many rows and cards show its disk. */
const readers = new Map<EnvironmentId, { count: number; readonly stop: () => void }>();

export function readEvery(
  registry: AtomRegistry.AtomRegistry,
  environmentId: EnvironmentId,
): () => void {
  const reader = readers.get(environmentId);
  if (reader) reader.count += 1;
  else {
    const read = () => {
      if (AppState.currentState !== "active") return;
      registry.refresh(serverEnvironment.hostResources({ environmentId, input: {} }));
    };
    const timer = setInterval(read, MACHINE_DISK_EVERY_MS);
    // Back at the front: a charge from before is no glance at the machine now.
    const back = AppState.addEventListener("change", read);
    readers.set(environmentId, {
      count: 1,
      stop: () => {
        clearInterval(timer);
        back.remove();
      },
    });
  }
  return () => {
    const held = readers.get(environmentId);
    if (held === undefined) return;
    held.count -= 1;
    if (held.count > 0) return;
    held.stop();
    readers.delete(environmentId);
  };
}

/**
 * A machine's home volume, from its host resources: undefined until its
 * first answer of the app's run (and for no machine), null when it gave none
 * (an older server, an unreadable volume). Read on mount and every 30 s while
 * the app is in front, once per machine however many ask.
 */
export function useMachineDisk(environmentIdText: string | null): DiskFigures | null | undefined {
  const environmentId = environmentIdText as EnvironmentId | null;
  const registry = useContext(RegistryContext);
  const result = useAtomValue(
    environmentId === null
      ? NO_MACHINE
      : serverEnvironment.hostResources({ environmentId, input: {} }),
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep the machine's disk figures read on an interval while anything shows them.
  useEffect(
    () => (environmentId === null ? undefined : readEvery(registry, environmentId)),
    [registry, environmentId],
  );
  if (environmentId === null) return undefined;
  if (result._tag === "Initial") return kept(environmentId, undefined);
  // A failed refresh keeps the last figure.
  const snapshot = Option.getOrNull(AsyncResult.value(result));
  return kept(
    environmentId,
    snapshot?.diskFreeBytes === undefined || snapshot.diskTotalBytes === undefined
      ? null
      : {
          free: snapshot.diskFreeBytes,
          total: snapshot.diskTotalBytes,
          ...(snapshot.diskWarnBelowBytes === undefined
            ? {}
            : { warnBelow: snapshot.diskWarnBelowBytes }),
          ...(snapshot.diskHiddenAtBytes === undefined
            ? {}
            : { hiddenAt: snapshot.diskHiddenAtBytes }),
        },
  );
}
