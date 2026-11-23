// A request of ours to another machine's server, authorized as upstream authorizes its own: the
// bearer token it paired with, or one bound to this device's key, renewed with the machine and
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

import { connectionAtomRuntime } from "~/connection/runtime";
import { appAtomRegistry } from "~/rpc/atomRegistry";

const ANSWER_WITHIN_MS = 60_000;

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
    const url = new URL(asked.path, prepared.httpBaseUrl).href;
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
 * What environment `environmentId`'s server answers at `path`; null while it isn't connected, or
 * only through T3's relay, which nothing of ours goes through. Rejects, as `fetch` does, when it
 * can't be reached.
 */
export async function requestMachine(
  environmentId: EnvironmentId,
  path: string,
  init: Omit<RequestInit, "method" | "headers" | "credentials"> & {
    readonly method?: "GET" | "POST";
    readonly headers?: Readonly<Record<string, string>>;
  } = {},
): Promise<Response | null> {
  const { method = "GET", signal } = init;
  const answers: Response[] = [];
  const result = await runAtomCommand(
    appAtomRegistry,
    request,
    {
      environmentId,
      input: {
        path,
        method,
        send: async (url, headers, interrupted) => {
          const answer = await fetch(url, {
            ...init,
            method,
            signal: signal ? AbortSignal.any([signal, interrupted]) : interrupted,
            credentials: headers.authorization === undefined ? "include" : "omit",
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
