/**
 * The asks the person put off, which wait dimmed at the end of the room's line
 * (stemcells/tasks/one-ask.md, decision 5). One pulled back early is an ask again at once,
 * while upstream's unsnooze runs, until the server's list has it back; if the unsnooze
 * fails it waits with the others again.
 */
import { useSyncExternalStore } from "react";

import type { CommandOutcome } from "../upstream/needs";
import { answered, type Hold } from "./holds";
import type { NeedsState } from "./stream";
import type { LaterNeed } from "./wire";

/**
 * The server's put-off asks, less those pulled back, and those whose Later the person just
 * gave: on the undo line or on its way, before the server's list says so. Soonest back first.
 */
export function laterOf(
  state: NeedsState,
  holds: ReadonlyMap<string, Hold>,
  pulled: ReadonlyMap<string, LaterNeed>,
): ReadonlyArray<LaterNeed> {
  const putOff = (state.needs ?? []).flatMap((need): Array<LaterNeed> => {
    const hold = holds.get(need.key);
    if (!answered(hold)) return [];
    const snooze = hold?.commands.find((command) => command.type === "snooze");
    return snooze?.type === "snooze" ? [{ ...need, until: snooze.until }] : [];
  });
  return [...(state.later ?? []).filter((need) => !pulled.has(need.key)), ...putOff].toSorted(
    (a, b) => Date.parse(a.until) - Date.parse(b.until),
  );
}

export interface PullingDeps {
  readonly needs: () => NeedsState;
  /** Follows the server's list; returns the unsubscribe. */
  readonly subscribeNeeds: (listener: () => void) => () => void;
  readonly unsnooze: (threadId: string) => Promise<CommandOutcome>;
}

export function createPulling(deps: PullingDeps) {
  let pulled: ReadonlyMap<string, LaterNeed> = new Map();
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | null = null;

  function set(next: ReadonlyMap<string, LaterNeed>) {
    pulled = next;
    if (pulled.size > 0 && unsubscribe === null) unsubscribe = deps.subscribeNeeds(prune);
    if (pulled.size === 0 && unsubscribe !== null) {
      unsubscribe();
      unsubscribe = null;
    }
    for (const listener of listeners) listener();
  }

  const putOff = (key: string) => deps.needs().later?.some((need) => need.key === key) === true;

  function prune() {
    const still = [...pulled].filter(([key]) => putOff(key));
    if (still.length < pulled.size) set(new Map(still));
  }

  function drop(key: string) {
    if (!pulled.has(key)) return;
    const next = new Map(pulled);
    next.delete(key);
    set(next);
  }

  return {
    /** Brings a put-off ask back now; it waits again if upstream refuses. */
    async pull(need: LaterNeed): Promise<boolean> {
      set(new Map([...pulled, [need.key, need]]));
      const outcome = await deps.unsnooze(need.threadId).catch(() => ({ ok: false }) as const);
      if (!outcome.ok || !putOff(need.key)) drop(need.key);
      return outcome.ok;
    },
    read: (): ReadonlyMap<string, LaterNeed> => pulled,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type Pulling = ReturnType<typeof createPulling>;

export function usePulling(pulling: Pulling): ReadonlyMap<string, LaterNeed> {
  return useSyncExternalStore(pulling.subscribe, pulling.read, pulling.read);
}
