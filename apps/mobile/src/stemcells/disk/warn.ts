// How little free space warns about a machine: set on its own server (`POST
// /api/stemcells/disk/warn`) with the token the phone paired with, as push registers. The choice
// stands on the phone for a minute, so the card and the menus follow it before the machine's
// next figures carry it (they're read every 30 s, from a snapshot cached for 5).

import { useSyncExternalStore } from "react";

import { SOON_BELOW } from "./kit";

const HOLD_MS = 60_000;
const PATH = "/api/stemcells/disk/warn";

const held = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

function publish() {
  version += 1;
  for (const listener of listeners) listener();
}

function hold(environmentId: string, warnBelow: number | null) {
  if (warnBelow === null) held.delete(environmentId);
  else {
    held.set(environmentId, warnBelow);
    setTimeout(() => {
      if (held.get(environmentId) !== warnBelow) return;
      held.delete(environmentId);
      publish();
    }, HOLD_MS);
  }
  publish();
}

/** A machine's threshold: the phone's choice of the last minute, else what the machine said. */
export function useWarnBelow(environmentId: string, reported: number | undefined): number {
  useSyncExternalStore(subscribe, () => version);
  return held.get(environmentId) ?? reported ?? SOON_BELOW;
}

/** Chooses `warnBelow` for the machine; false when it didn't take it, and the choice is let go. */
export async function chooseWarnBelow(
  environmentId: string,
  connection: { readonly httpBaseUrl: string; readonly bearerToken: string | null },
  warnBelow: number,
  request: typeof fetch = fetch,
): Promise<boolean> {
  hold(environmentId, warnBelow);
  const taken = await send(connection, warnBelow, request);
  if (!taken) hold(environmentId, null);
  return taken;
}

async function send(
  connection: { readonly httpBaseUrl: string; readonly bearerToken: string | null },
  warnBelow: number,
  request: typeof fetch,
): Promise<boolean> {
  if (connection.bearerToken === null) return false;
  try {
    const answer = await request(new URL(PATH, connection.httpBaseUrl).toString(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${connection.bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ warnBelow }),
    });
    return answer.ok;
  } catch {
    return false;
  }
}
