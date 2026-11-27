import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { useMachineConnection } from "../upstream/disk";
import { callLine } from "./drives";
import { MOVES_EVERY_MS, MOVES_PATH, moveEnded, type MovesAnswer } from "./kit";

// Where a machine's movable folders live, from its own server, as the Mac's page reads them
// (`apps/web/src/stemcells/disk/movesReading.ts`): every 10 s while shown and in front, every
// 1.5 s while one moves. A move that ends while watched tells `onMoveEnded`.

type Ended = NonNullable<ReturnType<typeof moveEnded>>;

function makeMovesStore(environmentId: string) {
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
    if (reading || AppState.currentState !== "active") return schedule();
    reading = true;
    const answer = await callLine(environmentId, MOVES_PATH);
    reading = false;
    if (answer.ok && answer.status === 200) take(answer.body as MovesAnswer);
    schedule();
  };
  return {
    state: () => state,
    take,
    read,
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
  };
}

const stores = new Map<string, ReturnType<typeof makeMovesStore>>();
const storeOf = (environmentId: string) => {
  const known = stores.get(environmentId);
  if (known !== undefined) return known;
  const store = makeMovesStore(environmentId);
  stores.set(environmentId, store);
  return store;
};

const noSubscription = () => () => undefined;
const nothing = () => null;

/** Where a machine's movable folders live; null without a direct line to it. */
export function useMoves(environmentId: string): MovesAnswer | null {
  const reached = useMachineConnection(environmentId)?.reach === "direct";
  const store = reached ? storeOf(environmentId) : null;
  return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.state ?? nothing);
}

export const onMoveEnded = (environmentId: string, tell: (ended: Ended) => void) =>
  storeOf(environmentId).onEnded(tell);

/** Starts a move on the machine; the reason it can't when it won't. */
export async function startMove(
  environmentId: string,
  action: "away" | "back" | "fresh",
  body: { readonly kind: string; readonly driveId?: string },
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string | null }> {
  const answer = await callLine(environmentId, `${MOVES_PATH}/${action}`, body);
  if (!answer.ok) return { ok: false, reason: null };
  if (answer.status === 202) {
    storeOf(environmentId).take(answer.body as MovesAnswer);
    void storeOf(environmentId).read();
    return { ok: true };
  }
  const reason = (answer.body as { reason?: unknown } | null)?.reason;
  return { ok: false, reason: typeof reason === "string" ? reason : null };
}
