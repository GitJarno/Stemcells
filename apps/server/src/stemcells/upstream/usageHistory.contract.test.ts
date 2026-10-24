// @effect-diagnostics nodeBuiltinImport:off globalDate:off - the test writes a transcript tree on disk.
/**
 * The usage history adds to upstream's Usage page through the seam in
 * `UsageService.collectDirs`: a transcript the page's own scan or cache holds
 * counts once, from the page; one it never saw counts from the history. Run
 * against upstream's own service, Claude transcript reader and scan cache. A
 * failure after a sync means the seam moved, or the page's cache keeps
 * transcripts on other terms.
 */
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { assert, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  ProviderDriverKind,
  ProviderInstanceId,
  UsageDay,
  type UsageSummary,
} from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as CursorAccountReader from "@t3tools/provider-cursor/server/CursorAccountReader";
import * as CursorKeychain from "@t3tools/provider-cursor/server/CursorKeychain";
import * as CursorUsageAccounts from "@t3tools/provider-cursor/server/CursorUsageAccounts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpClient, HttpClientResponse } from "effect/http";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as BackgroundPolicy from "../../background/BackgroundPolicy.ts";
import * as ServerConfig from "../../config.ts";
import * as Sqlite from "../../persistence/Sqlite.ts";
import * as AntigravityUsage from "../../provider/Drivers/AntigravityUsage.ts";
import * as ProviderHostLive from "../../provider/ProviderHostLive.ts";
import * as ServerSettings from "../../serverSettings.ts";
import * as CodexUsageHistory from "../../usage/CodexUsageHistory.ts";
import * as UsageService from "../../usage/UsageService.ts";
import { HISTORY_FILE_NAME, type HistoryStore } from "../usageHistory/history.ts";

const WINDOW = {
  timeZone: "UTC",
  sinceDay: UsageDay.make("2026-07-31"),
  untilDay: UsageDay.make("2026-08-02"),
};
const AT = Date.parse("2026-08-01T12:00:00Z");

const layerService = (home: string) =>
  Layer.fresh(CursorUsageAccounts.layer).pipe(
    Layer.provide(CursorAccountReader.layer.pipe(Layer.provide(CursorKeychain.layer))),
    Layer.provideMerge(AntigravityUsage.layer),
    Layer.provideMerge(ProviderHostLive.layer),
    Layer.provideMerge(CodexUsageHistory.layer.pipe(Layer.provideMerge(Sqlite.layerMemory))),
    Layer.provideMerge(Layer.mock(BackgroundPolicy.BackgroundPolicy)({})),
    Layer.provideMerge(Layer.mock(ServerSecretStore.ServerSecretStore)({})),
    Layer.provideMerge(ServerConfig.layerTest(process.cwd(), NodePath.join(home, "t3"))),
    Layer.provideMerge(NodeServices.layer),
    Layer.provideMerge(Layer.succeed(HostProcess.Platform, "linux")),
    Layer.provideMerge(
      ServerSettings.layerTest({
        providerInstances: {
          [ProviderInstanceId.make("claudeAgent")]: {
            driver: ProviderDriverKind.make("claudeAgent"),
            config: { homePath: NodePath.join(home, "claude") },
          },
        },
      }),
    ),
    Layer.provideMerge(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(HttpClientResponse.fromWeb(request, Response.json({}))),
        ),
      ),
    ),
    Layer.provideMerge(
      Layer.succeed(HostProcess.Environment, {
        HOME: home,
        XDG_CONFIG_HOME: NodePath.join(home, "config"),
      }),
    ),
  );

const claudeLine = (outputTokens: number) =>
  `${JSON.stringify({
    type: "assistant",
    timestamp: new Date(AT).toISOString(),
    requestId: "req_1",
    sessionId: "live-session",
    message: {
      id: "msg_1",
      model: "claude-fable-5",
      usage: { input_tokens: 10, output_tokens: outputTokens },
    },
  })}\n`;

const history = (files: Record<string, number>): HistoryStore => ({
  version: 1,
  files: Object.fromEntries(
    Object.entries(files).map(([path, output]) => [
      path,
      { provider: "claude", session: path, rows: [[AT, "claude-fable-5", 0, 0, 0, output]] },
    ]),
  ),
});

const outputTokens = (summary: UsageSummary) =>
  summary.buckets
    .filter((bucket) => bucket.provider === "claude")
    .reduce((sum, bucket) => sum + bucket.totals.outputTokens, 0);

it.effect("counts a transcript the page holds once, and one it never saw from the history", () =>
  Effect.gen(function* () {
    const home = yield* Effect.promise(() =>
      NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "usage-history-")),
    );
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => NodeFSP.rm(home, { recursive: true, force: true })),
    );
    const live = NodePath.join(home, "claude", "projects", "proj", "live.jsonl");
    const gone = NodePath.join(home, "claude", "projects", "proj", "gone.jsonl");

    yield* Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      yield* Effect.promise(async () => {
        await NodeFSP.mkdir(NodePath.dirname(live), { recursive: true });
        await NodeFSP.writeFile(live, claudeLine(5));
        const store = NodePath.join(config.stateDir, "stemcells", HISTORY_FILE_NAME);
        await NodeFSP.mkdir(NodePath.dirname(store), { recursive: true });
        await NodeFSP.writeFile(store, JSON.stringify(history({ [live]: 1000, [gone]: 7 })));
      });

      const first = yield* UsageService.make;
      assert.strictEqual(outputTokens(yield* first.readSummary(WINDOW)), 12);
      yield* first.awaitPersisted;

      // The CLI deletes the transcript; the page's cache still holds it.
      yield* Effect.promise(() => NodeFSP.rm(live));
      const restarted = yield* UsageService.make;
      assert.strictEqual(outputTokens(yield* restarted.readSummary(WINDOW)), 12);
    }).pipe(Effect.scoped, Effect.provide(layerService(home)));
  }).pipe(Effect.scoped),
);
