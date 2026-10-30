import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { AuthOrchestrationOperateScope, AuthOrchestrationReadScope } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { HttpRouter } from "effect/http";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";

import * as EnvironmentAuth from "../../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../../config.ts";
import * as UpstreamDiskWarn from "../upstream/diskWarn.ts";
import { choicesLayer } from "./http.ts";
import { readHiddenAt } from "./notice.ts";

/** A caller's scopes ride a test header; none is no credential. */
const auth = Layer.succeed(EnvironmentAuth.EnvironmentAuth, {
  authenticateHttpRequest: (request: { readonly headers: Record<string, string | undefined> }) => {
    const scopes = request.headers["x-test-scopes"];
    return scopes === undefined
      ? Effect.fail(new EnvironmentAuth.ServerAuthMissingCredentialError())
      : Effect.succeed({
          sessionId: "session",
          subject: "test",
          method: "browser-session-cookie",
          scopes: scopes.split(",").filter(Boolean),
        });
  },
} as never);

const hide = (body: unknown, scopes: string | null = AuthOrchestrationOperateScope) =>
  new Request("http://127.0.0.1/api/stemcells/disk/notice", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(scopes === null ? {} : { "x-test-scopes": scopes }),
    },
    body: JSON.stringify(body),
  });

it.layer(NodeServices.layer)("the disk notice's route", (it) => {
  it.effect("hides the notice for a caller who may start work, and shows it again", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-disk-http-" });
      const config = ServerConfig.layerTest(process.cwd(), baseDir).pipe(
        Layer.provide(NodeServices.layer),
      );
      const file = yield* UpstreamDiskWarn.diskNoticeFile.pipe(Effect.provide(config));
      const web = HttpRouter.toWebHandler(
        choicesLayer.pipe(
          Layer.provideMerge(auth),
          Layer.provideMerge(config),
          Layer.provideMerge(
            HttpPlatform.layer.pipe(
              Layer.provideMerge(NodeServices.layer),
              Layer.provideMerge(Etag.layerWeak),
            ),
          ),
          Layer.provide(NodeServices.layer),
        ),
        { disableLogger: true },
      );
      yield* Effect.addFinalizer(() => Effect.promise(() => web.dispose()));
      const send = (request: Request) => Effect.promise(() => web.handler(request));
      const status = (request: Request) => Effect.map(send(request), (answer) => answer.status);

      assert.strictEqual(yield* status(hide({ hiddenAt: 8e9 }, null)), 401);
      assert.strictEqual(yield* status(hide({ hiddenAt: 8e9 }, AuthOrchestrationReadScope)), 403);
      assert.strictEqual(yield* status(hide({ hiddenAt: -1 })), 400);
      assert.isNull(yield* readHiddenAt(file));

      const answer = yield* send(hide({ hiddenAt: 8e9 }));
      assert.deepStrictEqual(yield* Effect.promise(() => answer.json()), { hiddenAt: 8e9 });
      assert.strictEqual(yield* readHiddenAt(file), 8e9);
      assert.strictEqual(yield* status(hide({ hiddenAt: null })), 200);
      assert.isNull(yield* readHiddenAt(file));
    }).pipe(Effect.scoped),
  );
});
