// A machine's Cell held still and small, as the Mac's `rail/CellMini.tsx`: in what it wears
// with the crew while the phone knows its chat, else what it is dealt alone, in its provider's
// colours where the phone knows them.

import { useSyncExternalStore } from "react";

import { chosenVersion, lookOf, onChosen } from "../cell/kit";
import { useCellLook, useCrewDay } from "../cell/roster";
import { instanceOf } from "../cell/ThreadCell";
import { useEnvironmentProvidersSelected, useThreadShellsSelected } from "../upstream/cells";
import { CellStill } from "./CellStill";

/** The driver of the provider the Cell `threadId` of `environmentId` runs on; null for a chat the phone doesn't hold. */
export function useCellDriver(environmentId: string, threadId: string | null): string | null {
  const instanceId = useThreadShellsSelected((threads) => {
    const thread =
      threadId === null ? undefined : threads.find((one) => String(one.id) === threadId);
    return thread === undefined ? null : instanceOf(thread);
  });
  return useEnvironmentProvidersSelected((byEnvironment) => {
    if (instanceId === null) return null;
    const providers = [...byEnvironment].find(([id]) => id === environmentId)?.[1];
    return providers?.find((provider) => provider.instanceId === instanceId)?.driver ?? null;
  });
}

/** `lookOf` as of `_chosen`: the kit reads the person's choice itself, so a new choice asks again. */
const lookAsOf = (threadId: string, day: string, _chosen: number) => lookOf(threadId, day);

/** What the Cell `threadId` wears today, the person's choice first: as its crew deals it, else alone. */
export function useLookOf(threadId: string): readonly string[] {
  const dealt = useCellLook(threadId);
  const day = useCrewDay();
  const chosen = useSyncExternalStore(onChosen, chosenVersion);
  return dealt ?? lookAsOf(threadId, day, chosen);
}

export function CellMini(props: {
  readonly environmentId: string;
  readonly threadId: string;
  readonly points?: number | undefined;
}) {
  const driver = useCellDriver(props.environmentId, props.threadId);
  const look = useLookOf(props.threadId);
  return (
    <CellStill name={props.threadId} look={look} provider={driver} points={props.points ?? 1.5} />
  );
}
