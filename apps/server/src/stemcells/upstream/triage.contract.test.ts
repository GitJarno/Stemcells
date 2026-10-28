// @effect-diagnostics nodeBuiltinImport:off - reads the server's source on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import { TriageService } from "../../triage/TriageService.ts";
import { triage } from "../layer.ts";

// Contract: Stemcells offers no in-app triage, which clones T3's repository and has the person's
// agent file the problem on T3's tracker. If this fails after a sync, that path is open again.

const serverSrc = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);

it.layer(NodeServices.layer)("in-app triage", (it) => {
  it.effect("the server says it has none, so no client offers it", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({ prefix: "stemcells-triage-" });
      const descriptor = yield* Effect.gen(function* () {
        return yield* (yield* ServerEnvironment.ServerEnvironment).getDescriptor;
      }).pipe(
        Effect.provide(
          ServerEnvironment.layer.pipe(
            Layer.provide(ServerSecretStore.layer),
            Layer.provide(ServerConfig.layerTest(process.cwd(), baseDir)),
          ),
        ),
      );
      assert.notStrictEqual(descriptor.capabilities.triage, true);
    }),
  );

  it.effect("a call that asks anyway prepares nothing", () =>
    Effect.gen(function* () {
      const service = yield* TriageService;
      const exit = yield* Effect.exit(service.prepare({ client: {} }));
      assert.isTrue(Exit.isFailure(exit));
    }).pipe(Effect.provide(triage)),
  );
});

it("the server provides Stemcells' triage, and nothing provides upstream's", () => {
  const server = NodeFS.readFileSync(NodePath.join(serverSrc, "server.ts"), "utf8");
  assert.include(server, "Layer.provideMerge(Stemcells.triage)");

  const live = /TriageService\.layer\b/;
  const offenders = NodeFS.readdirSync(serverSrc, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter((file) => live.test(NodeFS.readFileSync(NodePath.join(serverSrc, file), "utf8")));
  assert.deepEqual(offenders, []);
});
