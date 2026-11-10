// @effect-diagnostics effectFnOpportunity:off - a test's harness, spared what a test file is.
// @effect-diagnostics globalJsonInEffect:off - a test's harness, spared what a test file is.
/**
 * The import route on upstream's real sign-in and asset signing, for its
 * test (`attachments/http.test.ts`): a caller signs in as the browser does,
 * and the file a chat showed carries a URL signed as the server signs one.
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpPlatform from "@effect/platform-node/NodeHttpPlatform";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { EnvironmentHttpApi, ThreadId } from "@t3tools/contracts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { HttpRouter } from "effect/http";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { issueAssetUrl } from "../../assets/AssetAccess.ts";
import * as AssetSigner from "../../assets/AssetSigner.ts";
import * as NativeAppIconResolver from "../../assets/NativeAppIconResolver.ts";
import * as AuthHttp from "../../auth/http.ts";
import * as EnvironmentAuth from "../../auth/EnvironmentAuth.ts";
import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import * as Orchestrator from "../../orchestration-v2/Orchestrator.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import * as ProjectFaviconResolver from "../../project/ProjectFaviconResolver.ts";
import * as T3ProjectFileLoader from "../../project/T3ProjectFileLoader.ts";
import * as ManagedPolicy from "../../policy/ManagedPolicy.ts";
import * as WorkspacePaths from "../../workspace/WorkspacePaths.ts";
import * as AttachmentsHttp from "../attachments/http.ts";

const DEV_TOKEN = "reusable-dev-auth-token-that-is-long-enough";
class AuthApi extends HttpApi.make("environment").add(EnvironmentHttpApi.groups.auth) {}

/** A string or a stream goes as it is; anything else as JSON. */
export type Bring = (
  body: unknown,
  more?: { readonly headers?: Record<string, string>; readonly signal?: AbortSignal },
) => Promise<Response>;

/**
 * The route over a server whose folders are under `baseDir`, where a chat
 * showed `shownFile`, a video in the workspace `workspaceRoot`.
 */
export function makeImportRoute(input: {
  readonly baseDir: string;
  readonly workspaceRoot: string;
  readonly shownFile: string;
}) {
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
  ).pipe(Layer.provide(ServerConfig.layerTest(process.cwd(), input.baseDir)));

  const layerNode = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

  const layerEnvironmentAuth = EnvironmentAuth.layer.pipe(
    Layer.provide(ManagedPolicy.layerTest()),
    Layer.provide(SqlitePersistence.layerMemory),
    Layer.provide(ServerSecretStore.layer),
    Layer.provide(ServerEnvironment.layerIdentity),
    Layer.provide(layerConfig),
  );

  const layerAssets = Layer.mergeAll(
    NodeHttpPlatform.layer,
    Layer.mock(Orchestrator.OrchestratorV2)({ getTurnItem: () => Effect.succeed(null) }),
    WorkspacePaths.layer,
    ProjectFaviconResolver.layer.pipe(
      Layer.provide(WorkspacePaths.layer),
      Layer.provide(T3ProjectFileLoader.layer),
    ),
    NativeAppIconResolver.layer.pipe(Layer.provide(layerConfig)),
  );

  const routesWith = (limits: AttachmentsHttp.Limits) =>
    Layer.mergeAll(
      HttpApiBuilder.layer(AuthApi).pipe(
        Layer.provide(AuthHttp.layer),
        Layer.provide(AuthHttp.layerAuthenticatedAuth),
      ),
      AttachmentsHttp.makeLayer(limits),
    ).pipe(
      Layer.provideMerge(layerEnvironmentAuth),
      Layer.provideMerge(layerConfig),
      Layer.provideMerge(
        HttpPlatform.layer.pipe(Layer.provideMerge(layerNode), Layer.provideMerge(Etag.layerWeak)),
      ),
      Layer.provide(layerNode),
    );

  // One store signs the URL the chat was shown and checks it on the way back.
  const secrets = new Map<string, Uint8Array>();
  const secretStore = ServerSecretStore.ServerSecretStore.of({
    get: (name) => Effect.succeed(Option.fromUndefinedOr(secrets.get(name))),
    set: (name, value) => Effect.sync(() => void secrets.set(name, value)),
    create: (name, value) => Effect.sync(() => void secrets.set(name, value)),
    getOrCreateRandom: (name, bytes) =>
      Effect.sync(() => {
        const kept = secrets.get(name) ?? globalThis.crypto.getRandomValues(new Uint8Array(bytes));
        secrets.set(name, kept);
        return kept;
      }),
    remove: (name) => Effect.sync(() => void secrets.delete(name)),
  });

  /**
   * Runs `use` against the route with `routeLimits`, signed in as the
   * browser is, with the shown video's signed URL. Live time: the route
   * checks the URL signed here against the real clock.
   */
  const signedIn = Effect.fn("signedIn")(
    function* (
      routeLimits: AttachmentsHttp.Limits,
      use: (input: {
        readonly bring: Bring;
        readonly signedIn: Bring;
        readonly asset: string;
        readonly attachmentsDir: string;
      }) => Promise<void>,
    ) {
      const { attachmentsDir } = yield* ServerConfig.ServerConfig;
      const { relativeUrl: asset } = yield* issueAssetUrl({
        resource: {
          _tag: "media-file",
          threadId: ThreadId.make("thread-1"),
          path: input.shownFile,
        },
        workspaceRoot: input.workspaceRoot,
      });
      // What the route reads per request, as the server hands it.
      const requestContext = yield* Effect.context<
        | AssetSigner.AssetSigner
        | SecureRandom.SecureRandom
        | ServerSecretStore.ServerSecretStore
        | NativeAppIconResolver.NativeAppIconResolver
        | Orchestrator.OrchestratorV2
        | WorkspacePaths.WorkspacePaths
      >();

      return yield* Effect.acquireUseRelease(
        Effect.sync(() =>
          HttpRouter.toWebHandler(routesWith(routeLimits), { disableLogger: true }),
        ),
        (handler) =>
          Effect.promise(async () => {
            const bring: Bring = (body, more = {}) =>
              handler.handler(
                new Request(`http://127.0.0.1${AttachmentsHttp.IMPORT_PATH}`, {
                  method: "POST",
                  headers: { "content-type": "application/json", ...more.headers },
                  ...(body instanceof ReadableStream
                    ? // Node's fetch needs duplex for streamed bodies.
                      { body, duplex: "half" }
                    : { body: typeof body === "string" ? body : JSON.stringify(body) }),
                  ...(more.signal ? { signal: more.signal } : {}),
                }),
                requestContext,
              );
            const session = await handler.handler(
              new Request("http://127.0.0.1/api/auth/browser-session", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ credential: DEV_TOKEN }),
              }),
              requestContext,
            );
            if (session.status !== 200) {
              throw new Error(`Upstream's sign-in answered ${session.status}`);
            }
            const cookie =
              session.headers
                .getSetCookie()
                .find((entry) => entry.startsWith("t3_dev_session_"))
                ?.split(";", 1)[0] ?? "";
            await use({
              bring,
              signedIn: (body, more = {}) =>
                bring(body, { ...more, headers: { cookie, ...more.headers } }),
              asset,
              attachmentsDir,
            });
          }),
        (handler) => Effect.promise(() => handler.dispose()),
      );
    },
    Effect.provideService(ServerSecretStore.ServerSecretStore, secretStore),
    Effect.provide(
      Layer.mergeAll(
        layerAssets,
        layerConfig,
        AssetSigner.layer.pipe(
          Layer.provide(Layer.succeed(ServerSecretStore.ServerSecretStore, secretStore)),
        ),
      ).pipe(Layer.provideMerge(layerNode)),
    ),
  );

  return { signedIn };
}
