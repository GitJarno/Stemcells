// @effect-diagnostics nodeBuiltinImport:off - reads server.ts and walks the server's source on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { buildRemoteLaunchScript } from "@t3tools/ssh/tunnel";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as TestClock from "effect/testing/TestClock";

import * as ServerConfig from "../../config.ts";
import * as UpstreamAnalyticsService from "../../telemetry/AnalyticsService.ts";
import { analytics as stemcellsAnalytics } from "../layer.ts";
import { forgetTelemetryId } from "../privacy/telemetry.ts";

// Contract: Stemcells sends no telemetry. The server runs Stemcells' analytics
// service, which records nothing; upstream's own service, if a sync wired it
// back, has nowhere to send by default; and an SSH environment, which runs
// upstream's released server on the remote machine, starts with its
// telemetry off. If this fails after a sync, a path to T3's analytics is
// open again.

const serverSrc = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);

/** An HTTP client that answers every request and keeps its URL. */
const recordingClient = () => {
  const urls: Array<string> = [];
  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      urls.push(request.url);
      return HttpClientResponse.fromWeb(request, new Response(null, { status: 204 }));
    }),
  );
  return { urls, layer: Layer.succeed(HttpClient.HttpClient, client) };
};

/** Records like a busy server, then lets ten minutes of background flushes run. */
const recordAndWait = Effect.gen(function* () {
  const analytics = yield* UpstreamAnalyticsService.AnalyticsService;
  for (let index = 0; index < 50; index += 1) {
    yield* analytics.record("client.turn.requested", { index });
  }
  yield* analytics.recordOwners([{ source: "device", ownerId: "a".repeat(64) }], "client");
  yield* analytics.flush;
  for (let second = 0; second < 600; second += 1) {
    yield* TestClock.adjust("1 second");
  }
});

it.layer(NodeServices.layer)("Stemcells' analytics", (it) => {
  it.effect("records nothing and never reaches the HTTP client", () =>
    Effect.gen(function* () {
      const { urls, layer: layerClient } = recordingClient();
      // Typed to need nothing: an HTTP client (or anything else) it asked for
      // would fail the type check here.
      const layerAnalytics: Layer.Layer<UpstreamAnalyticsService.AnalyticsService> =
        stemcellsAnalytics;
      yield* recordAndWait.pipe(Effect.provide(Layer.merge(layerAnalytics, layerClient)));
      assert.deepEqual(urls, []);
    }),
  );

  it.effect("makes and reads no telemetry id, and removes one left from before", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const layerConfig = ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-telemetry-" });
      yield* Effect.gen(function* () {
        const { anonymousIdPath } = yield* ServerConfig.ServerConfig;
        yield* recordAndWait.pipe(Effect.provide(stemcellsAnalytics));
        assert.isFalse(yield* fs.exists(anonymousIdPath));

        yield* fs.writeFileString(anonymousIdPath, "an-id-from-an-earlier-build");
        yield* forgetTelemetryId;
        assert.isFalse(yield* fs.exists(anonymousIdPath));
        // Nothing left: a second start is quiet.
        yield* forgetTelemetryId;
      }).pipe(Effect.provide(layerConfig));
    }),
  );

  it.effect("upstream's own service sends nothing when nothing is configured", () =>
    Effect.gen(function* () {
      const { urls, layer: layerClient } = recordingClient();
      const layerUpstream = UpstreamAnalyticsService.layer.pipe(
        Layer.provideMerge(
          ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-upstream-telemetry-" }),
        ),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(HostProcess.Platform, "darwin"),
            Layer.succeed(HostProcess.Architecture, "arm64"),
            layerClient,
          ),
        ),
      );
      yield* recordAndWait.pipe(Effect.provide(layerUpstream));
      assert.deepEqual(urls, []);
    }),
  );
});

it("the server provides Stemcells' analytics, and nothing provides upstream's", () => {
  const server = NodeFS.readFileSync(NodePath.join(serverSrc, "server.ts"), "utf8");
  assert.include(server, "Layer.provideMerge(Stemcells.analytics)");

  const live = /AnalyticsService\.(?:layer|make)\b(?!Test)/;
  const offenders = NodeFS.readdirSync(serverSrc, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter((file) => live.test(NodeFS.readFileSync(NodePath.join(serverSrc, file), "utf8")));
  assert.deepEqual(offenders, []);
});

it("an SSH environment starts upstream's server with telemetry off", () => {
  const script = buildRemoteLaunchScript({ archiveVersion: "1.2.3" });
  const serves = script.split("\n").filter((line) => /"\$RUNNER_FILE" serve\b/.test(line));
  assert.isNotEmpty(serves);
  for (const line of serves) {
    assert.include(line, "T3CODE_TELEMETRY_ENABLED=false");
  }
});
