/**
 * Pushes to the person's phone, as Settings › Aski shows them
 * (stemcells/tasks/phone-push.md): the key, the phones, and how the last
 * push went, from the server's `push/http.ts`.
 */
import { useSyncExternalStore } from "react";

import { getFromPrimary, sendToPrimary } from "../upstream/disk";

const PATH = "/api/stemcells/push";

// The wire, as the server's `push/Push.ts` sends it.
export interface PushStatus {
  readonly key: { readonly keyId: string; readonly teamId: string } | null;
  readonly devices: ReadonlyArray<{
    readonly token: string;
    readonly label: string;
    readonly environment: "development" | "production";
    readonly addedAt: string;
  }>;
  readonly last: { readonly at: string; readonly ok: boolean; readonly why: string | null } | null;
}

export interface Tested {
  readonly label: string;
  readonly sent: { readonly status: number; readonly reason: string | null };
}

/** What a refused request says, in the server's words when it gave any. */
async function refusal(response: Response): Promise<string> {
  const text = (await response.text().catch(() => "")).trim();
  return text.length > 0 && text.length < 200 ? text : "Try again in a moment.";
}

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly why: string };

async function call<T>(response: Promise<Response>): Promise<Outcome<T>> {
  try {
    const answer = await response;
    if (!answer.ok) return { ok: false, why: await refusal(answer) };
    return { ok: true, value: (await answer.json()) as T };
  } catch {
    return { ok: false, why: "This Mac didn't answer. Try again in a moment." };
  }
}

let status: PushStatus | null = null;
const listeners = new Set<() => void>();

function publish<T>(outcome: Outcome<T>, statusOf: (value: T) => PushStatus): Outcome<T> {
  if (!outcome.ok) return outcome;
  status = statusOf(outcome.value);
  for (const listener of listeners) listener();
  return outcome;
}

const same = (value: PushStatus) => value;

/** Reads the status again, as after a phone is removed. */
export const readAgain = async () => publish(await call<PushStatus>(getFromPrimary(PATH)), same);

export const setKey = async (key: { keyId: string; teamId: string; p8: string }) =>
  publish(await call<PushStatus>(sendToPrimary("PUT", `${PATH}/key`, key)), same);

export const forgetKey = async () =>
  publish(await call<PushStatus>(sendToPrimary("DELETE", `${PATH}/key`)), same);

export const sendTest = async () =>
  publish(
    await call<{ results: ReadonlyArray<Tested>; status: PushStatus }>(
      sendToPrimary("POST", `${PATH}/test`),
    ),
    (value) => value.status,
  );

export async function forgetPhone(token: string): Promise<Outcome<null>> {
  try {
    const answer = await sendToPrimary("DELETE", `${PATH}/devices`, { token });
    if (!answer.ok) return { ok: false, why: await refusal(answer) };
  } catch {
    return { ok: false, why: "This Mac didn't answer. Try again in a moment." };
  }
  await readAgain();
  return { ok: true, value: null };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) void readAgain();
  return () => listeners.delete(listener);
}

const read = () => status;

/** Null until the status arrives, or on a server without pushes. */
export function usePushStatus(): PushStatus | null {
  return useSyncExternalStore(subscribe, read, read);
}
