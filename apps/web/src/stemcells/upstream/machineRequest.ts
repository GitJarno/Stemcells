// A request of ours to another machine's server, authorized as upstream authorizes its own: the
// bearer token it paired with, or one bound to this device's key, renewed with the machine and
// signed with a proof per request (`machines.contract.test.ts`).

import { EnvironmentSupervisor } from "@t3tools/client-runtime/connection";
import { executeConnectedEnvironmentHttpRequest } from "@t3tools/client-runtime/state/environmentHttpAuth";
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

/** A suggestion waits on a model for up to half of this. */
const ANSWER_WITHIN_MS = 60_000;

interface Asked {
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly init: RequestInit;
  /** The last answer to come, kept when upstream's request fails on it: a refusal renewing didn't help. */
  answer: Response | null;
}

const send = createEnvironmentCommand(connectionAtomRuntime, {
  label: "stemcells:machine-request",
  execute: Effect.fnUntraced(function* (asked: Asked) {
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
        Effect.tryPromise(async (interrupted) => {
          const { signal } = asked.init;
          asked.answer = await fetch(url, {
            ...asked.init,
            method: asked.method,
            signal: signal ? AbortSignal.any([signal, interrupted]) : interrupted,
            credentials: headers.authorization === undefined ? "include" : "omit",
            headers: { ...asked.init.headers, ...headers },
          });
          return asked.answer;
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
  const asked: Asked = { path, method: init.method ?? "GET", init, answer: null };
  const result = await runAtomCommand(
    appAtomRegistry,
    send,
    { environmentId, input: asked },
    { reportFailure: false },
  );
  if (result._tag === "Success") return result.value;
  if (asked.answer !== null) return asked.answer;
  throw squashAtomCommandFailure(result);
}
