// A choice the phone makes about a machine's disk, set on that machine's own server with the
// token the phone paired with, as push registers. It stands on the phone for a minute, so the
// card and the menus follow it before the machine's next figures carry it (they're read every
// 30 s, from a snapshot cached for 5).

import { useSyncExternalStore } from "react";

const HOLD_MS = 60_000;

export type MachineConnection = {
  readonly httpBaseUrl: string;
  readonly bearerToken: string | null;
};

/** Each machine's choice of one kind, held while its machine's figures catch up. */
export function createChoices<T>() {
  const held = new Map<string, { readonly choice: T }>();
  const listeners = new Set<() => void>();
  let version = 0;

  function publish() {
    version += 1;
    for (const listener of listeners) listener();
  }

  function letGo(environmentId: string, hold: { readonly choice: T }) {
    if (held.get(environmentId) !== hold) return;
    held.delete(environmentId);
    publish();
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    version: () => version,
    read: (environmentId: string) => held.get(environmentId),
    /** Holds `choice` while `send` sets it; false when the machine didn't take it, and it's let go. */
    async choose(environmentId: string, choice: T, send: () => Promise<boolean>) {
      const hold = { choice };
      held.set(environmentId, hold);
      setTimeout(() => letGo(environmentId, hold), HOLD_MS);
      publish();
      const taken = await send();
      if (!taken) letGo(environmentId, hold);
      return taken;
    },
  };
}

/** The phone's choice of the last minute for the machine, if it made one. */
export function useChoice<T>(
  choices: ReturnType<typeof createChoices<T>>,
  environmentId: string,
): { readonly choice: T } | undefined {
  useSyncExternalStore(choices.subscribe, choices.version);
  return choices.read(environmentId);
}

/** Posts `body` to `path` on the machine's own server: whether it took it. */
export async function postToMachine(
  connection: MachineConnection,
  path: string,
  body: object,
): Promise<boolean> {
  if (connection.bearerToken === null) return false;
  try {
    const answer = await fetch(new URL(path, connection.httpBaseUrl).toString(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${connection.bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return answer.ok;
  } catch {
    return false;
  }
}
