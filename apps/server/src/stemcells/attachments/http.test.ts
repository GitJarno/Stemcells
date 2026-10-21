// @effect-diagnostics nodeBuiltinImport:off - real files and a real local web server.
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeHttpPlatform from "@effect/platform-node/NodeHttpPlatform";
import * as NodeFS from "node:fs";
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeTimersPromises from "node:timers/promises";
import { EnvironmentHttpApi, ThreadId } from "@t3tools/contracts";
import { expect, it } from "@effect/vitest";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { HttpRouter } from "effect/http";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { afterAll, beforeAll } from "vite-plus/test";

import { issueAssetUrl } from "../../assets/AssetAccess.ts";
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
import * as WorkspacePaths from "../../workspace/WorkspacePaths.ts";
import { publicAddresses } from "../upstream/attachments.ts";
import * as AttachmentsHttp from "./http.ts";
import type { Resolve } from "./import.ts";

// The import route over HTTP: only a caller allowed to operate this
// environment brings files in, and what it brings is a pending attachment
// of its own in this server's store.

const DEV_TOKEN = "reusable-dev-auth-token-that-is-long-enough";
class AuthApi extends HttpApi.make("environment").add(EnvironmentHttpApi.groups.auth) {}

const baseDir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-carry-route-"));
const shown = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-carry-shown-"));

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
).pipe(Layer.provide(ServerConfig.layerTest(process.cwd(), baseDir)));

const layerEnvironmentAuth = EnvironmentAuth.layer.pipe(
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
      HttpPlatform.layer.pipe(
        Layer.provideMerge(NodeServices.layer),
        Layer.provideMerge(Etag.layerWeak),
      ),
    ),
    Layer.provide(NodeServices.layer),
  );

/** This test's own web server, let through the public check every web import makes. */
const testServerToo: Resolve = async (host) =>
  host === "127.0.0.1" ? [{ address: "127.0.0.1", family: 4 }] : publicAddresses(host);
const limits = (more: Partial<AttachmentsHttp.Limits> = {}): AttachmentsHttp.Limits => ({
  ...AttachmentsHttp.LIMITS,
  resolve: testServerToo,
  ...more,
});

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

const seen: string[] = [];
const closed: string[] = [];
let server: NodeHttp.Server;
let web = "";
beforeAll(async () => {
  server = NodeHttp.createServer((request, response) => {
    seen.push(request.url ?? "");
    response.on("close", () => closed.push(request.url ?? ""));
    if (request.url === "/clips/stall.mp4") {
      response.writeHead(200, { "content-type": "video/mp4" });
      response.write(Buffer.alloc(100));
    } else if (request.url === "/pictures/sky.png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(Buffer.from("png bytes"));
    } else if (request.url === "/clips/rain.mp4") {
      response.writeHead(200, { "content-type": "video/mp4" });
      response.end(Buffer.from("mp4 bytes"));
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  web = `http://127.0.0.1:${(server.address() as NodeNet.AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const dir of [baseDir, shown]) NodeFS.rmSync(dir, { recursive: true, force: true });
});

const waitFor = async (check: () => boolean) => {
  for (let tries = 0; tries < 100 && !check(); tries += 1) await NodeTimersPromises.setTimeout(20);
  return check();
};

/** A string or a stream goes as it is; anything else as JSON. */
type Bring = (
  body: unknown,
  more?: { readonly headers?: Record<string, string>; readonly signal?: AbortSignal },
) => Promise<Response>;

/**
 * Runs `use` against the route with `limits`, signed in as the browser is,
 * with a video a chat showed by its signed URL. Live time: the route checks
 * the URL signed here against the real clock.
 */
const signedIn = (
  routeLimits: AttachmentsHttp.Limits,
  use: (input: {
    readonly bring: Bring;
    readonly signedIn: Bring;
    readonly asset: string;
    readonly attachmentsDir: string;
  }) => Promise<void>,
) =>
  Effect.gen(function* () {
    const { attachmentsDir } = yield* ServerConfig.ServerConfig;
    const videoPath = NodePath.join(shown, "recording.mp4");
    NodeFS.writeFileSync(videoPath, "a video");
    const { relativeUrl: asset } = yield* issueAssetUrl({
      resource: { _tag: "media-file", threadId: ThreadId.make("thread-1"), path: videoPath },
      workspaceRoot: shown,
    });
    // What the route reads per request, as the server hands it.
    const requestContext = yield* Effect.context<
      | Crypto.Crypto
      | ServerSecretStore.ServerSecretStore
      | NativeAppIconResolver.NativeAppIconResolver
      | Orchestrator.OrchestratorV2
      | WorkspacePaths.WorkspacePaths
    >();

    return yield* Effect.acquireUseRelease(
      Effect.sync(() => HttpRouter.toWebHandler(routesWith(routeLimits), { disableLogger: true })),
      (handler) =>
        Effect.tryPromise(async () => {
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
          expect(session.status).toBe(200);
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
  }).pipe(
    Effect.provideService(ServerSecretStore.ServerSecretStore, secretStore),
    Effect.provide(
      Layer.mergeAll(layerAssets, layerConfig).pipe(Layer.provideMerge(NodeServices.layer)),
    ),
  );

const refusalOf = async (answer: Response) => ({
  status: answer.status,
  ...((await answer.json()) as { reason: string }),
});

it.live("brings files in only for a caller allowed to operate, each as its own attachment", () =>
  signedIn(limits(), async ({ bring, signedIn, asset, attachmentsDir }) => {
    expect((await bring({ from: { asset } })).status).toBe(401);
    // Another site can't ride the person's session to write a file here.
    const cookie = { origin: "https://elsewhere.example" };
    expect((await signedIn({ from: { asset } }, { headers: cookie })).status).toBe(401);

    // A file a chat showed: twice, two attachments of their own.
    const first = await signedIn({ from: { asset } });
    expect(first.status).toBe(200);
    const one = (await first.json()) as { attachmentId: string };
    expect(one).toMatchObject({ name: "recording.mp4", mimeType: "video/mp4", sizeBytes: 7 });
    const two = (await (await signedIn({ from: { asset } })).json()) as { attachmentId: string };
    expect(two.attachmentId).not.toBe(one.attachmentId);
    for (const { attachmentId } of [one, two]) {
      expect(attachmentId).toMatch(/^pending-.*-mp4$/);
      expect(
        NodeFS.readFileSync(NodePath.join(attachmentsDir, `${attachmentId}.mp4`), "utf8"),
      ).toBe("a video");
    }

    // A web address: stored once, or a picture's bytes answered.
    const clip = await signedIn({ from: { url: `${web}/clips/rain.mp4` } });
    expect(await clip.json()).toMatchObject({ name: "rain.mp4", sizeBytes: 9 });
    const sky = await signedIn({ from: { url: `${web}/pictures/sky.png` }, as: "picture" });
    expect(sky.status).toBe(200);
    expect(sky.headers.get("content-type")).toBe("image/png");
    expect(sky.headers.get("x-stemcells-name")).toBe("sky.png");
    expect(await sky.text()).toBe("png bytes");

    // Refusals say why, in a few words.
    expect(await refusalOf(await signedIn({ from: { asset: `${asset}x` } }))).toEqual({
      status: 404,
      reason: "No longer there",
    });
    expect(
      await refusalOf(await signedIn({ from: { url: `${web}/clips/rain.mp4` }, as: "picture" })),
    ).toEqual({ status: 415, reason: "Not a PNG, JPEG, GIF or WebP" });
    expect(await refusalOf(await signedIn({ from: { path: "/etc/hosts" } }))).toEqual({
      status: 400,
      reason: "Not understood",
    });
  }),
);

it.live("refuses a request too large to read, and never reads one that says it is", () =>
  signedIn(limits(), async ({ signedIn }) => {
    const tooLarge = { status: 413, reason: "Too large to read" };
    // One that declares gigabytes is answered before a byte of it is taken.
    let pulled = 0;
    const flood = new ReadableStream<Uint8Array>(
      {
        pull: (controller) => {
          if (pulled > AttachmentsHttp.IMPORT_BODY_MOST) return controller.close();
          pulled += 64 * 1024;
          controller.enqueue(new Uint8Array(64 * 1024));
        },
      },
      { highWaterMark: 0 },
    );
    const declared = await signedIn(flood, {
      headers: { "content-length": String(8 * 1024 ** 3) },
    });
    expect(await refusalOf(declared)).toEqual(tooLarge);
    expect(pulled).toBe(0);
    // One that declares nothing is measured as it's read (`http/body.test.ts`
    // shows the reader stopping at the bound).
    const fetched = seen.length;
    const padded = JSON.stringify({
      from: { url: `${web}/clips/rain.mp4` },
      name: "x".repeat(AttachmentsHttp.IMPORT_BODY_MOST),
    });
    expect(await refusalOf(await signedIn(padded))).toEqual(tooLarge);
    expect(seen.length).toBe(fetched);
  }),
);

it.live("never fetches this machine's own addresses, whatever the route is asked", () =>
  signedIn(AttachmentsHttp.LIMITS, async ({ signedIn }) => {
    const before = seen.length;
    expect(await refusalOf(await signedIn({ from: { url: `${web}/clips/rain.mp4` } }))).toEqual({
      status: 502,
      reason: "Couldn't fetch it",
    });
    expect(seen.length).toBe(before);
  }),
);

it.live("runs a few imports at once, and one whose caller went away stops, leaving nothing", () =>
  signedIn(limits({ imports: 1 }), async ({ signedIn, attachmentsDir }) => {
    const away = new AbortController();
    const stalled = signedIn({ from: { url: `${web}/clips/stall.mp4` } }, { signal: away.signal });
    expect(await waitFor(() => seen.includes("/clips/stall.mp4"))).toBe(true);
    expect(await refusalOf(await signedIn({ from: { url: `${web}/clips/rain.mp4` } }))).toEqual({
      status: 503,
      reason: "Busy, try again",
    });
    away.abort();
    await stalled.catch(() => null);
    expect(await waitFor(() => closed.includes("/clips/stall.mp4"))).toBe(true);
    expect(
      await waitFor(
        () => !NodeFS.readdirSync(attachmentsDir).some((entry) => entry.endsWith(".part")),
      ),
    ).toBe(true);
    // Its place is given back.
    expect((await signedIn({ from: { url: `${web}/clips/rain.mp4` } })).status).toBe(200);
  }),
);

it.live("keeps the bytes waiting unsent under a ceiling", () =>
  signedIn(limits({ pendingBytes: 10 }), async ({ signedIn, asset, attachmentsDir }) => {
    for (const entry of NodeFS.readdirSync(attachmentsDir))
      NodeFS.rmSync(NodePath.join(attachmentsDir, entry), { force: true });
    expect((await signedIn({ from: { asset } })).status).toBe(200);
    expect(await refusalOf(await signedIn({ from: { asset } }))).toEqual({
      status: 507,
      reason: "Too many files waiting to send",
    });
  }),
);
