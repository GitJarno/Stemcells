/**
 * A phone paired since upstream's `#37990` holds a token bound to its key, not a bearer token:
 * upstream's own client signs each request to that machine and renews its token with the machine
 * itself. Ours go the same way (`machines.ts`). A failure here after a sync names what moved: the
 * line, the collection, pushes and drives of a machine would go dark.
 */
import {
  BearerConnectionTarget,
  type EnvironmentPresentation,
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
import { Atom, AtomRegistry } from "effect/reactivity";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRemoteEnvironmentProjectionAtoms } from "../../state/remote-environment-projections";
import { askMachine, machineConnectionOf } from "./machines";

const mac = vi.hoisted(() => ({
  prepared: null as PreparedConnection | null,
  renews: [] as Array<{ readonly direct: unknown; readonly rejected: string | undefined }>,
}));

vi.mock("../../connection/runtime", () => {
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
      Effect.flatMap(SubscriptionRef.make(Option.fromNullishOr(mac.prepared)), (prepared) =>
        Effect.provideService(
          effect,
          EnvironmentSupervisor.EnvironmentSupervisor,
          EnvironmentSupervisor.EnvironmentSupervisor.of({
            target: mac.prepared?.target,
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
            mac.renews.push({ direct, rejected });
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

vi.mock("../../state/session", () => ({
  environmentSession: {
    preparedConnectionValueAtom: () => Atom.make(Option.fromNullishOr(mac.prepared)),
  },
}));

const id = EnvironmentId.make("mac");
const httpBaseUrl = "http://mac.example.com:3773";
const direct = { connectionId: "bearer:mac", httpBaseUrl };
const address = new BearerConnectionTarget({
  environmentId: id,
  label: "Mac",
  connectionId: direct.connectionId,
});
const relay = new RelayConnectionTarget({ environmentId: id, label: "Mac" });

const preparedWith = (
  httpAuthorization: PreparedHttpAuthorization,
  target: PreparedConnection["target"] = address,
): PreparedConnection => ({
  environmentId: id,
  label: "Mac",
  httpBaseUrl,
  socketUrl: "ws://mac.example.com:3773/ws",
  httpAuthorization,
  target,
});

/** What the phone saved when it paired, kept by the connection after its token is renewed. */
const paired: PreparedHttpAuthorization = {
  _tag: "Dpop",
  accessToken: "from pairing",
  expiresAtEpochMs: 0,
  directConnection: direct,
};
const relayed: PreparedHttpAuthorization = {
  _tag: "Dpop",
  accessToken: "relayed",
  expiresAtEpochMs: 0,
};

function setup(prepared: PreparedConnection | null, answers: ReadonlyArray<() => Response>) {
  mac.prepared = prepared;
  mac.renews.length = 0;
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

const ok = () => new Response(null, { status: 200 });
const refused = () => Response.json({ _tag: "EnvironmentAuthInvalidError" }, { status: 401 });

describe("a request to a machine paired with this phone's key", () => {
  it("is signed as upstream signs its own, for the address asked and the token it holds now", async () => {
    const asked = setup(preparedWith(paired), [ok]);
    expect((await askMachine(id, "/api/stemcells/disk/drive?id=disk%202"))?.status).toBe(200);
    const url = `${httpBaseUrl}/api/stemcells/disk/drive?id=disk%202`;
    expect(asked).toEqual([
      {
        url,
        method: "GET",
        headers: { authorization: "DPoP current", dpop: `proof of GET ${url} for current` },
      },
    ]);
    expect(mac.renews).toEqual([{ direct, rejected: undefined }]);
  });

  it("is sent once more with a renewed token when the machine refuses the one it held", async () => {
    const asked = setup(preparedWith(paired), [refused, refused]);
    const answer = await askMachine(id, "/api/stemcells/push/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    // Refused again: the machine's own answer, and no third try.
    expect(answer?.status).toBe(401);
    const url = `${httpBaseUrl}/api/stemcells/push/devices`;
    expect(asked.map((each) => each.headers)).toEqual([
      {
        authorization: "DPoP current",
        "content-type": "application/json",
        dpop: `proof of POST ${url} for current`,
      },
      {
        authorization: "DPoP after current",
        "content-type": "application/json",
        dpop: `proof of POST ${url} for after current`,
      },
    ]);
    expect(mac.renews.map((each) => each.rejected)).toEqual([undefined, "current"]);
  });
});

describe("a request to a machine reached another way", () => {
  it("carries the bearer token a phone paired before holds, and asks once", async () => {
    const asked = setup(preparedWith({ _tag: "Bearer", token: "held" }), [refused]);
    expect((await askMachine(id, "/api/stemcells/needs"))?.status).toBe(401);
    expect(asked.map((each) => each.headers)).toEqual([{ authorization: "Bearer held" }]);
  });

  it("is never made through the relay, or before a route connects", async () => {
    for (const prepared of [preparedWith(relayed, relay), null]) {
      const asked = setup(prepared, []);
      expect(await askMachine(id, "/api/stemcells/needs")).toBeNull();
      expect(asked).toEqual([]);
    }
  });

  it("fails as a fetch does when the machine doesn't answer", async () => {
    setup(preparedWith(paired), []);
    await expect(askMachine(id, "/api/stemcells/needs")).rejects.toThrow();
  });
});

/** The connection upstream saves for each machine, as it stands while `prepared` is its route. */
function savedWith(target: PreparedConnection["target"]) {
  const prepared = Atom.make(Option.none<PreparedConnection>());
  const registry = AtomRegistry.make();
  const presentationAtom = Atom.make<EnvironmentPresentation | null>(() => {
    return { entry: { target, profile: Option.none() } } as never;
  });
  const { savedConnectionAtom } = createRemoteEnvironmentProjectionAtoms({
    presentationAtom: () => presentationAtom,
    preparedConnectionAtom: () => prepared,
    serverConfigAtom: () => Atom.make(null),
  });
  const saved = savedConnectionAtom(id);
  registry.mount(saved);
  return (next: PreparedConnection | null) => {
    mac.prepared = next;
    registry.set(prepared, Option.fromNullishOr(next));
    return registry.get(saved)!;
  };
}

describe("how the phone reaches a saved machine", () => {
  it("is direct once its route connects, by key or by bearer token, and away before", () => {
    const saved = savedWith(address);
    expect(machineConnectionOf(saved(null)).reach).toBe("away");
    expect(machineConnectionOf(saved(preparedWith(paired)))).toEqual({
      environmentId: "mac",
      reach: "direct",
    });
    const held = preparedWith({ _tag: "Bearer", token: "held" });
    expect(machineConnectionOf(saved(held)).reach).toBe("direct");
  });

  it("is the relay only through T3's relay", () => {
    const saved = savedWith(relay);
    expect(machineConnectionOf(saved(null)).reach).toBe("relay");
    expect(machineConnectionOf(saved(preparedWith(relayed, relay))).reach).toBe("relay");
  });

  it("comes with a saved connection of its own each time the route connects, or takes another", () => {
    const saved = savedWith(address);
    const away = saved(null);
    const first = saved(preparedWith(paired));
    expect(saved(mac.prepared)).toBe(first);
    expect(new Set([away, first, saved(preparedWith(paired))]).size).toBe(3);
  });
});
