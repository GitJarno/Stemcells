// The phone's line to a machine's own server, authorized as upstream authorizes its own requests:
// the bearer token it paired with, or one bound to this phone's key, renewed with the machine and
// signed with a proof per request (`machines.contract.test.ts`).

import { EnvironmentSupervisor } from "@t3tools/client-runtime/connection";
import { RemoteEnvironmentAuthFetchError } from "@t3tools/client-runtime/rpc";
import {
  type EnvironmentHttpAuthHeaders,
  executeConnectedEnvironmentHttpRequest,
} from "@t3tools/client-runtime/state/environmentHttpAuth";
import {
  createEnvironmentCommand,
  runAtomCommand,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { connectionAtomRuntime } from "../../connection/runtime";
import type { SavedRemoteConnection } from "../../lib/connection";
import { appAtomRegistry } from "../../state/atom-registry";
import { environmentSession } from "../../state/session";

export type { SavedRemoteConnection };

/** A saved machine, as the phone reaches it now. */
export interface MachineConnection {
  readonly environmentId: string;
  /** Its own server; T3's relay, which nothing of ours goes through; or neither until it connects. */
  readonly reach: "direct" | "relay" | "away";
}

/** How the phone reaches `saved` now; upstream makes a new one each time that may have changed. */
export function machineConnectionOf(
  saved: Pick<SavedRemoteConnection, "environmentId" | "relayManaged">,
): MachineConnection {
  const { environmentId } = saved;
  const prepared = appAtomRegistry.get(
    environmentSession.preparedConnectionValueAtom(environmentId),
  );
  const direct = Option.isSome(prepared) ? "direct" : "away";
  return { environmentId, reach: saved.relayManaged === true ? "relay" : direct };
}

const ANSWER_WITHIN_MS = 30_000;

const request = createEnvironmentCommand(connectionAtomRuntime, {
  label: "stemcells:machine-request",
  execute: Effect.fnUntraced(function* (asked: {
    readonly path: string;
    readonly method: "GET" | "POST";
    readonly send: (
      url: string,
      headers: EnvironmentHttpAuthHeaders,
      interrupted: AbortSignal,
    ) => Promise<Response>;
  }) {
    const supervisor = yield* EnvironmentSupervisor.EnvironmentSupervisor;
    const prepared = Option.getOrNull(yield* SubscriptionRef.get(supervisor.prepared));
    if (prepared === null || prepared.target._tag === "RelayConnectionTarget") return null;
    const url = new URL(asked.path, prepared.httpBaseUrl).toString();
    return yield* executeConnectedEnvironmentHttpRequest({
      group: "auth",
      method: asked.method,
      url: () => url,
      timeoutMs: ANSWER_WITHIN_MS,
      request: ({ headers }) =>
        Effect.tryPromise({
          try: (interrupted) => asked.send(url, headers, interrupted),
          catch: (cause) =>
            new RemoteEnvironmentAuthFetchError({ message: "It couldn't be reached.", cause }),
        }),
      isUnauthorizedResponse: (response) => response.status === 401,
    });
  }),
});

/**
 * What a machine's own server answers at `path`; null while the phone has no direct line to it.
 * Rejects, as `fetch` does, when it can't be reached.
 */
export async function askMachine(
  environmentId: string,
  path: string,
  init: Pick<RequestInit, "body" | "signal"> & {
    readonly method?: "GET" | "POST";
    readonly headers?: Readonly<Record<string, string>>;
  } = {},
): Promise<Response | null> {
  const { method = "GET" } = init;
  const answers: Response[] = [];
  const result = await runAtomCommand(
    appAtomRegistry,
    request,
    {
      environmentId: environmentId as EnvironmentId,
      input: {
        path,
        method,
        send: async (url, headers, interrupted) => {
          const answer = await fetch(url, {
            ...init,
            method,
            signal: init.signal ?? interrupted,
            headers: { ...init.headers, ...headers },
          });
          answers.push(answer);
          return answer;
        },
      },
    },
    { reportFailure: false },
  );
  if (result._tag === "Success") return result.value;
  // What it said when it refused the renewed token too.
  const refusal = answers.at(-1);
  if (refusal !== undefined) return refusal;
  throw squashAtomCommandFailure(result);
}
