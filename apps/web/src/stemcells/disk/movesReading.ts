import { useSyncExternalStore } from "react";

import type { EnvironmentId } from "../upstream/disk";
import { callMachine } from "../upstream/machines";
import { MOVES_EVERY_MS, MOVES_PATH, moveEnded, type MovesAnswer } from "./moves";

// Where a machine's movable folders live, read from its own server: every 10 s while the page
// shows them, every 1.5 s while one moves. A move that ends while watched tells `onEnded`.

type Ended = NonNullable<ReturnType<typeof moveEnded>>;

function makeMovesStore(environmentId: EnvironmentId) {
  let state: MovesAnswer | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reading = false;
  const listeners = new Set<() => void>();
  const endings = new Set<(ended: Ended) => void>();
  const schedule = () => {
    clearTimeout(timer);
    if (listeners.size === 0) return;
    timer = setTimeout(() => void read(), state?.job ? MOVES_EVERY_MS.moving : MOVES_EVERY_MS.idle);
  };
  const take = (next: MovesAnswer) => {
    const ended = moveEnded(state, next);
    state = next;
    for (const listener of listeners) listener();
    if (ended !== null) for (const tell of endings) tell(ended);
  };
  const read = async () => {
    if (reading || document.visibilityState !== "visible") return schedule();
    reading = true;
    const answer = await callMachine(environmentId, MOVES_PATH);
    reading = false;
    if (answer.ok && answer.status === 200) take(answer.body as MovesAnswer);
    schedule();
  };
  return {
    state: () => state,
    take,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1) void read();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) clearTimeout(timer);
      };
    },
    onEnded: (tell: (ended: Ended) => void) => {
      endings.add(tell);
      return () => {
        endings.delete(tell);
      };
    },
    read,
  };
}

const stores = new Map<EnvironmentId, ReturnType<typeof makeMovesStore>>();
const storeOf = (environmentId: EnvironmentId) => {
  const known = stores.get(environmentId);
  if (known !== undefined) return known;
  const store = makeMovesStore(environmentId);
  stores.set(environmentId, store);
  return store;
};

const noSubscription = () => () => undefined;
const nothing = () => null;

export function useMoves(environmentId: EnvironmentId | null): MovesAnswer | null {
  const store = environmentId === null ? null : storeOf(environmentId);
  return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.state ?? nothing);
}

/** Tells `tell` when a move on this machine ends while something watches; returns the unsubscribe. */
export const onMoveEnded = (environmentId: EnvironmentId, tell: (ended: Ended) => void) =>
  storeOf(environmentId).onEnded(tell);

/** Starts a move on the machine; the reason it can't when it won't. */
export async function startMove(
  environmentId: EnvironmentId,
  action: "away" | "back" | "fresh",
  body: { readonly kind: string; readonly driveId?: string },
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string | null }> {
  const answer = await callMachine(environmentId, `${MOVES_PATH}/${action}`, body);
  if (!answer.ok) return { ok: false, reason: null };
  if (answer.status === 202) {
    storeOf(environmentId).take(answer.body as MovesAnswer);
    void storeOf(environmentId).read();
    return { ok: true };
  }
  const reason = (answer.body as { reason?: unknown } | null)?.reason;
  return { ok: false, reason: typeof reason === "string" ? reason : null };
}
