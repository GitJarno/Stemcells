import * as NodeServices from "@effect/platform-node/NodeServices";
import { EnvironmentHttpApi } from "@t3tools/contracts";
import { expect, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { HttpRouter, HttpServerResponse } from "effect/http";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import * as AuthHttp from "../../auth/http.ts";
import * as EnvironmentAuth from "../../auth/EnvironmentAuth.ts";
import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import * as UpstreamDisk from "./disk.ts";

// Contract: Settings › Disk is answered only to a caller upstream's own
// authentication lets read this environment.

const DEV_TOKEN = "reusable-dev-auth-token-that-is-long-enough";
class AuthApi extends HttpApi.make("environment").add(EnvironmentHttpApi.groups.auth) {}

const layerConfig = Layer.effect(
  ServerConfig.ServerConfig,
  Effect.gen(function* () {
    const config = yield* ServerConfig.ServerConfig;
    return {
      ...config,
      mode: "web",
      devUrl: new URL("http://127.0.0.1:5173"),
      devAuthToken: Redacted.make(DEV_TOKEN),
    } satisfies ServerConfig.ServerConfig["Service"];
  }),
).pipe(Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-disk-auth-" })));

const layerEnvironmentAuth = EnvironmentAuth.layer.pipe(
  Layer.provide(SqlitePersistence.layerMemory),
  Layer.provide(ServerSecretStore.layer),
  Layer.provide(ServerEnvironment.layerIdentity),
  Layer.provide(layerConfig),
);

const layerRoutes = Layer.mergeAll(
  HttpApiBuilder.layer(AuthApi).pipe(
    Layer.provide(AuthHttp.layer),
    Layer.provide(AuthHttp.layerAuthenticatedAuth),
  ),
  HttpRouter.add(
    "GET",
    "/api/stemcells/probe",
    UpstreamDisk.withReadAccess(Effect.succeed(HttpServerResponse.text("measured"))),
  ),
).pipe(
  Layer.provideMerge(layerEnvironmentAuth),
  Layer.provide(layerConfig),
  Layer.provideMerge(
    HttpPlatform.layer.pipe(
      Layer.provideMerge(NodeServices.layer),
      Layer.provideMerge(Etag.layerWeak),
    ),
  ),
  Layer.provide(NodeServices.layer),
);

it.effect("answers a signed-in browser and refuses a caller without credentials", () =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const secretStore = ServerSecretStore.ServerSecretStore.of({
      get: () => Effect.succeedNone,
      set: () => Effect.void,
      create: () => Effect.void,
      getOrCreateRandom: () => Effect.die("Not used by these routes."),
      remove: () => Effect.void,
    });
    const requestContext = Context.make(Crypto.Crypto, crypto).pipe(
      Context.add(ServerSecretStore.ServerSecretStore, secretStore),
    );
    return yield* Effect.acquireUseRelease(
      Effect.sync(() => HttpRouter.toWebHandler(layerRoutes, { disableLogger: true })),
      (web) =>
        Effect.tryPromise(async () => {
          const probe = (headers: Record<string, string> = {}) =>
            web.handler(
              new Request("http://127.0.0.1/api/stemcells/probe", { headers }),
              requestContext,
            );

          expect((await probe()).status).toBe(401);

          const session = await web.handler(
            new Request("http://127.0.0.1/api/auth/browser-session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ credential: DEV_TOKEN }),
            }),
            requestContext,
          );
          expect(session.status).toBe(200);
          const cookie =
            session.headers
              .getSetCookie()
              .find((entry) => entry.startsWith("t3_dev_session_"))
              ?.split(";", 1)[0] ?? "";

          const answered = await probe({ cookie });
          expect(answered.status).toBe(200);
          expect(await answered.text()).toBe("measured");
        }),
      (web) => Effect.promise(() => web.dispose()),
    );
  }).pipe(Effect.provide(NodeServices.layer)),
);
