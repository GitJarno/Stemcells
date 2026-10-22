// @effect-diagnostics nodeBuiltinImport:off - reads server.ts and walks the server's source on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { ProviderDriverKind } from "@t3tools/contracts";
import * as ModelCatalog from "@t3tools/provider-core/server/ModelCatalog";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";

import * as ServerConfig from "../../config.ts";
import * as ModelManifest from "../../provider/ModelManifest.ts";
import * as ServerSettings from "../../serverSettings.ts";
import { modelList as stemcellsModelList } from "../layer.ts";

// Contract: Stemcells never fetches the model list from T3's GitHub
// repository. The server runs the list bundled at build time, which each
// upstream sync refreshes; upstream's own service, which the server no
// longer provides, asks T3's repository for a newer one. If this fails after
// a sync, a request to T3 is open again (stemcells/seams.md, No model list
// from T3; stemcells/outbound.txt forbids the address).

const serverSrc = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);

/** An HTTP client that answers every request with a newer list, and keeps its URL. */
const recordingClient = () => {
  const urls: Array<string> = [];
  const newer: ModelManifest.ModelManifestData = {
    version: 1,
    updatedAt: "2099-01-01T00:00:00Z",
    currentModels: { codex: ["a-model-from-the-network"] },
  };
  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      urls.push(request.url);
      return HttpClientResponse.fromWeb(request, Response.json(newer));
    }),
  );
  return { urls, layer: Layer.succeed(HttpClient.HttpClient, client) };
};

it.layer(NodeServices.layer)("Stemcells' model list", (it) => {
  it.effect("is the bundled list, however it's asked, and never reaches an HTTP client", () =>
    Effect.gen(function* () {
      const { urls, layer: layerClient } = recordingClient();
      // Typed to need nothing: an HTTP client (or anything else) it asked for
      // would fail the type check here.
      const layerList: Layer.Layer<ModelManifest.ModelManifest | ModelCatalog.ModelCatalog> =
        stemcellsModelList;
      yield* Effect.gen(function* () {
        const list = yield* ModelManifest.ModelManifest;
        assert.strictEqual(yield* list.current, ModelManifest.BUNDLED_MODEL_MANIFEST);
        assert.strictEqual(yield* list.refresh, ModelManifest.BUNDLED_MODEL_MANIFEST);
        assert.strictEqual(yield* list.forceRefresh, ModelManifest.BUNDLED_MODEL_MANIFEST);
        yield* list.refreshInBackground;

        const catalog = yield* ModelCatalog.ModelCatalog;
        yield* catalog.refreshInBackground;
        for (const kind of Object.keys(ModelManifest.BUNDLED_MODEL_MANIFEST.providers ?? {})) {
          const driver = ProviderDriverKind.make(kind);
          assert.deepStrictEqual(yield* catalog.current(driver), catalog.bundled(driver));
        }
      }).pipe(Effect.provide(Layer.merge(layerList, layerClient)));
      assert.deepEqual(urls, []);
    }),
  );

  it.effect("upstream's own list asks T3's repository, the request Stemcells cuts", () =>
    Effect.gen(function* () {
      const { urls, layer: layerClient } = recordingClient();
      const layerUpstream = ModelManifest.layer.pipe(
        Layer.provideMerge(
          ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-model-list-" }),
        ),
        Layer.provideMerge(ServerSettings.layerTest({})),
        Layer.provide(layerClient),
      );
      yield* Effect.gen(function* () {
        const list = yield* ModelManifest.ModelManifest;
        yield* list.forceRefresh;
      }).pipe(Effect.scoped, Effect.provide(layerUpstream));
      assert.lengthOf(urls, 1);
      assert.match(urls[0]!, /^https:\/\/raw\.githubusercontent\.com\/pingdotgg\//);
    }),
  );
});

it("the server provides Stemcells' model list, and nothing provides upstream's", () => {
  const server = NodeFS.readFileSync(NodePath.join(serverSrc, "server.ts"), "utf8");
  assert.include(server, "Stemcells.modelList,");

  const live = /ModelManifest\.(?:layer|make)\b/;
  const offenders = NodeFS.readdirSync(serverSrc, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter((file) => live.test(NodeFS.readFileSync(NodePath.join(serverSrc, file), "utf8")));
  assert.deepEqual(offenders, []);
});
