/**
 * A device paired since upstream's `#37990` holds a token bound to its key, not a bearer token:
 * upstream's own client signs each request to that machine and renews its token with the machine
 * itself. Ours go the same way (`machineRequest.ts`). A failure here after a sync names what
 * moved: drives, Cell links, suggestions and settles of another machine would go dark.
 */
import {
  BearerConnectionTarget,
  EnvironmentRegistry,
  EnvironmentSupervisor,
  type PreparedConnection,
  type PreparedHttpAuthorization,
  RelayConnectionTarget,
} from "@t3tools/client-runtime/connection";
import { ManagedRelay } from "@t3tools/client-runtime/relay";
import { layerRemoteHttpClient } from "@t3tools/client-runtime/rpc";
import { EnvironmentId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { Atom } from "effect/reactivity";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { describe, expect, it, vi } from "vite-plus/test";

import { callMachine } from "./machines";
import { openEnvironmentStream } from "./needs";

const studio = vi.hoisted(() => ({
  prepared: null as PreparedConnection | null,
  /** The token its machine gives for the one rejected, if any. */
  renews: [] as Array<{ readonly direct: unknown; readonly rejected: string | undefined }>,
}));

vi.mock("~/connection/runtime", () => {
  type Dpop = Extract<PreparedHttpAuthorization, { readonly _tag: "Dpop" }>;
  // Services resolve by key, and client-runtime does not export this one.
  class RemoteEnvironmentAuthorization extends Context.Service<
    RemoteEnvironmentAuthorization,
    {
      readonly authorizeDirectDpopHttp: (
        direct: Dpop["directConnection"],
        rejectedAccessToken?: string,
      ) => Effect.Effect<Dpop>;
    }
    // @effect-diagnostics-next-line deterministicKeys:off
  >()("@t3tools/client-runtime/authorization/service/RemoteEnvironmentAuthorization") {}
  const registry = EnvironmentRegistry.EnvironmentRegistry.of({
    run: (_environmentId: EnvironmentId, effect: Effect.Effect<unknown>) =>
      Effect.flatMap(SubscriptionRef.make(Option.fromNullishOr(studio.prepared)), (prepared) =>
        Effect.provideService(
          effect,
          EnvironmentSupervisor.EnvironmentSupervisor,
          EnvironmentSupervisor.EnvironmentSupervisor.of({
            target: studio.prepared?.target,
            prepared,
          } as never),
        ),
      ),
  } as never);
  return {
    connectionAtomRuntime: Atom.runtime(
      Layer.mergeAll(
        layerRemoteHttpClient((input, init) => globalThis.fetch(input, init)),
        Layer.succeed(EnvironmentRegistry.EnvironmentRegistry, registry),
        Layer.succeed(ManagedRelay.ManagedRelayDpopSigner, {
          thumbprint: Effect.succeed("thumbprint"),
          createProof: (proof) =>
            Effect.succeed(`proof of ${proof.method} ${proof.url} for ${proof.accessToken}`),
        }),
        Layer.succeed(RemoteEnvironmentAuthorization, {
          authorizeDirectDpopHttp: (direct, rejected) => {
            studio.renews.push({ direct, rejected });
            return Effect.succeed({
              _tag: "Dpop",
              accessToken: rejected === undefined ? "current" : `after ${rejected}`,
              expiresAtEpochMs: Number.MAX_SAFE_INTEGER,
              ...(direct === undefined ? {} : { directConnection: direct }),
            });
          },
        }),
      ),
    ),
  };
});

vi.mock("~/state/session", async (original) => ({
  ...(await original<typeof import("~/state/session")>()),
  environmentSession: {
    preparedConnectionValueAtom: () => Atom.make(Option.fromNullishOr(studio.prepared)),
  },
}));

const id = EnvironmentId.make("studio");
const httpBaseUrl = "http://studio.example.com:3773";
const direct = { connectionId: "bearer:studio", httpBaseUrl };

function setup(
  httpAuthorization: PreparedHttpAuthorization | null,
  answers: ReadonlyArray<() => Response>,
  target: PreparedConnection["target"] = new BearerConnectionTarget({
    environmentId: id,
    label: "Studio Mac",
    connectionId: direct.connectionId,
  }),
) {
  studio.renews.length = 0;
  studio.prepared = {
    environmentId: id,
    label: "Studio Mac",
    httpBaseUrl,
    socketUrl: "ws://studio.example.com:3773/ws",
    httpAuthorization,
    target,
  };
  const asked: Array<{ url: string; method: string; headers: Record<string, string> }> = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    asked.push({
      url,
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers)),
    });
    return answers[asked.length - 1]!();
  });
  return asked;
}

/** What the device saved when it paired, kept by the connection after its token is renewed. */
const paired: PreparedHttpAuthorization = {
  _tag: "Dpop",
  accessToken: "from pairing",
  expiresAtEpochMs: 0,
  directConnection: direct,
};
const ok = (body: unknown) => () => Response.json(body);
const refused = () => Response.json({ _tag: "EnvironmentAuthInvalidError" }, { status: 401 });

describe("a request to a machine paired with this device's key", () => {
  it("is signed as upstream signs its own, for the address asked and the token it holds now", async () => {
    const asked = setup(paired, [ok({ drives: [] })]);
    expect(await callMachine(id, "/api/stemcells/disk/drive", null, { id: "disk 2" })).toEqual({
      ok: true,
      status: 200,
      body: { drives: [] },
    });
    const url = `${httpBaseUrl}/api/stemcells/disk/drive?id=disk+2`;
    expect(asked).toEqual([
      {
        url,
        method: "GET",
        headers: { authorization: "DPoP current", dpop: `proof of GET ${url} for current` },
      },
    ]);
    expect(studio.renews).toEqual([{ direct, rejected: undefined }]);
  });

  it("is sent once more with a renewed token when the machine refuses the one it held", async () => {
    const asked = setup(paired, [refused, ok({ linked: true })]);
    const answer = await callMachine(id, "/api/stemcells/peers/link", { token: "t" });
    expect(answer).toEqual({ ok: true, status: 200, body: { linked: true } });
    const url = `${httpBaseUrl}/api/stemcells/peers/link`;
    expect(
      asked.map(({ method, headers }) => [method, headers.authorization, headers.dpop]),
    ).toEqual([
      ["POST", "DPoP current", `proof of POST ${url} for current`],
      ["POST", "DPoP after current", `proof of POST ${url} for after current`],
    ]);
    expect(studio.renews.map((each) => each.rejected)).toEqual([undefined, "current"]);
  });

  it("says what the machine answered when it refuses the renewed one too", async () => {
    const asked = setup(paired, [refused, refused]);
    expect(await callMachine(id, "/api/stemcells/peers/links")).toMatchObject({
      ok: true,
      status: 401,
    });
    expect(asked).toHaveLength(2);
  });

  it("opens the machine's stream, and reads it after the request is done", async () => {
    const asked = setup(paired, [() => new Response("data: {}\n\n")]);
    const signal = new AbortController().signal;
    const response = await openEnvironmentStream(id, "/api/stemcells/needs/stream", signal);
    expect(await response?.text()).toBe("data: {}\n\n");
    expect(asked[0]?.headers.authorization).toBe("DPoP current");
  });
});

describe("a request to a machine reached another way", () => {
  it("carries the bearer token a device paired before holds, and asks once", async () => {
    const asked = setup({ _tag: "Bearer", token: "held" }, [refused]);
    expect(await callMachine(id, "/api/stemcells/peers/links")).toMatchObject({ status: 401 });
    expect(asked.map((each) => each.headers)).toEqual([{ authorization: "Bearer held" }]);
  });

  it("is never made through the relay", async () => {
    const asked = setup(
      { _tag: "Dpop", accessToken: "relayed", expiresAtEpochMs: 0 },
      [],
      new RelayConnectionTarget({ environmentId: id, label: "Studio Mac" }),
    );
    expect(await callMachine(id, "/api/stemcells/peers/links")).toEqual({
      ok: false,
      reason: expect.stringContaining("through the relay"),
    });
    const signal = new AbortController().signal;
    expect(await openEnvironmentStream(id, "/api/stemcells/needs/stream", signal)).toBeNull();
    expect(asked).toEqual([]);
  });

  it("couldn't be reached when the machine doesn't answer", async () => {
    setup(paired, []);
    expect(await callMachine(id, "/api/stemcells/peers/links")).toEqual({
      ok: false,
      reason: "it couldn't be reached",
    });
    const signal = new AbortController().signal;
    await expect(
      openEnvironmentStream(id, "/api/stemcells/needs/stream", signal),
    ).rejects.toThrow();
  });
});
