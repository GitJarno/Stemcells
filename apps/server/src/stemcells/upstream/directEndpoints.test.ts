import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { describe, expect } from "vite-plus/test";

import * as ServerConfig from "../../config.ts";
import * as DirectEndpoints from "../../environment/DirectEndpoints.ts";
import { directEndpoints } from "./directEndpoints.ts";
import { onMarkPath } from "./tailscale.ts";

const STATUS_JSON = JSON.stringify({
  Self: { DNSName: "studio.tail1234.ts.net.", TailscaleIPs: ["100.64.1.2"] },
});

/** Tailscale answering `status --json`, counting each time it's asked. */
const tailscaleUp = (asked: Ref.Ref<number>) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() =>
      Ref.update(asked, (n) => n + 1).pipe(
        Effect.as(
          ChildProcessSpawner.makeHandle({
            pid: ChildProcessSpawner.ProcessId(1),
            exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
            isRunning: Effect.succeed(false),
            kill: () => Effect.void,
            unref: Effect.succeed(Effect.void),
            stdin: Sink.drain,
            stdout: Stream.make(new TextEncoder().encode(STATUS_JSON)),
            stderr: Stream.empty,
            all: Stream.empty,
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
          }),
        ),
      ),
    ),
  );

/** Serve answering for this server on the tailnet name. */
const serveAnswers = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: 200 }))),
  ),
);

const onLoopback = Layer.effect(
  ServerConfig.ServerConfig,
  Effect.map(ServerConfig.ServerConfig, (config) => ({ ...config, host: "127.0.0.1" })),
).pipe(Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "sc-direct-" })));

/** What the server tells clients, with phones over Tailscale `on` or not, and how often it asked Tailscale. */
const told = (on: boolean) =>
  Effect.gen(function* () {
    const asked = yield* Ref.make(0);
    const endpoints = yield* Effect.gen(function* () {
      if (on) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const mark = yield* onMarkPath;
        yield* fs.makeDirectory(path.dirname(mark), { recursive: true });
        yield* fs.writeFileString(mark, "");
      }
      const service = yield* DirectEndpoints.DirectEndpoints;
      return yield* service.resolve();
    }).pipe(
      Effect.provide(
        directEndpoints(DirectEndpoints.make).pipe(
          Layer.provideMerge(Layer.mergeAll(onLoopback, tailscaleUp(asked), serveAnswers)),
          Layer.provideMerge(NodeServices.layer),
        ),
      ),
    );
    return { endpoints, asked: yield* Ref.get(asked) };
  });

describe("the server's addresses for clients", () => {
  it.effect("names this computer's Tailscale address while phones over Tailscale are on", () =>
    Effect.gen(function* () {
      expect((yield* told(true)).endpoints).toEqual([
        { kind: "tailnet", httpBaseUrl: "https://studio.tail1234.ts.net/" },
      ]);
    }),
  );

  it.effect("leaves it out, without asking Tailscale, while they're off", () =>
    Effect.gen(function* () {
      expect(yield* told(false)).toEqual({ endpoints: [], asked: 0 });
    }),
  );
});
