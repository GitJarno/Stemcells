import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import {
  type OrchestrationV2ProviderCapabilities,
  type OrchestrationV2ProviderThread,
  ProviderDriverKind,
  ProviderInstanceId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { decideProviderSessionTransition } from "../../orchestration-v2/ProviderSessionTransitionPolicy.ts";
import { makeClaudeContinuationGroupKey } from "../../provider/Drivers/ClaudeHome.ts";
import { claudeContinuationKey, resumeWithTranscript } from "./claudeAccounts.ts";

// Contract: two Claude accounts on Claude Code's own login share upstream's continuation key, so
// upstream resumes a thread in place when it moves between them; a router keeps its own key and
// upstream's handoff; and upstream's resume finds the transcript in its account's folder, or
// fails, so upstream falls back to a fresh session with a handoff.

const claude = ProviderDriverKind.make("claudeAgent");

const keyFor = (instanceId: string, homePath: string, env: NodeJS.ProcessEnv = {}) =>
  Effect.gen(function* () {
    const config = { homePath, launchArgs: "" };
    return yield* claudeContinuationKey(yield* makeClaudeContinuationGroupKey(config, env), {
      instanceId,
      config,
      env,
    });
  });

const transition = (fromKey: string, toKey: string) => {
  const side = (instanceId: string, continuationKey: string) => ({
    driver: claude,
    continuationIdentity: { driverKind: claude, continuationKey },
    modelSelection: { instanceId: ProviderInstanceId.make(instanceId), model: "claude-opus-5-5" },
    runtimeMode: "full-access" as const,
    interactionMode: "default" as const,
    workspace: "/projects/example",
    capabilities: {} as OrchestrationV2ProviderCapabilities,
  });
  return decideProviderSessionTransition({
    current: side("claudeWork", fromKey),
    target: { ...side("claudePersonal", toKey), available: true },
  }).type;
};

describe("a thread moving between two Claude accounts", () => {
  it.effect("resumes in place between two logins, each in its own config folder", () =>
    Effect.gen(function* () {
      const work = yield* keyFor("claudeWork", "/Users/example/.claude");
      const personal = yield* keyFor("claudePersonal", "/Users/example/.claude-personal");
      assert.equal(work, personal);
      assert.equal(transition(work, personal), "restart_and_resume");
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("is still handed off to a router, as upstream does", () =>
    Effect.gen(function* () {
      const work = yield* keyFor("claudeWork", "/Users/example/.claude");
      const router = yield* keyFor("claudeRouter", "/Users/example/.claude-router", {
        ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
      });
      assert.notEqual(work, router);
      assert.equal(transition(work, router), "create_with_handoff");

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const folder = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-accounts-" });
      yield* fs.writeFileString(
        path.join(folder, "settings.json"),
        JSON.stringify({ env: { ANTHROPIC_BASE_URL: "http://127.0.0.1:8317" } }),
      );
      assert.notEqual(work, yield* keyFor("claudeRouterSettings", folder));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("finds its transcript in the new account's folder when upstream resumes", () =>
    Effect.gen(function* () {
      const { fs, personal, transcriptIn, resume } = yield* twoAccounts;
      const seen: Array<boolean> = [];
      yield* resume(
        fs.exists(transcriptIn(personal)).pipe(Effect.map((found) => seen.push(found))),
      );
      assert.deepEqual(seen, [true]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("fails the resume when the transcript can't be brought along", () =>
    Effect.gen(function* () {
      const { fs, path, personal, resume } = yield* twoAccounts;
      // A file where the account's projects folder belongs: the copy can't land.
      yield* fs.writeFileString(path.join(personal, "projects"), "");
      let resumed = false;
      const error = yield* resume(Effect.sync(() => (resumed = true))).pipe(Effect.flip);
      assert.instanceOf(error, ProviderAdapter.ProviderAdapterResumeThreadError);
      assert.isFalse(resumed);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});

const twoAccounts = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-accounts-" });
  const work = path.join(root, "claude-work");
  const personal = path.join(root, "claude-personal");
  yield* fs.makeDirectory(personal);
  yield* keyFor("claudeWork", work);
  yield* keyFor("claudePersonal", personal);
  const session = "11111111-2222-4333-8444-555555555555";
  const transcriptIn = (folder: string) =>
    path.join(folder, "projects", "-projects-example", `${session}.jsonl`);
  yield* fs.makeDirectory(path.dirname(transcriptIn(work)), { recursive: true });
  yield* fs.writeFileString(transcriptIn(work), "turn\n");

  const providerThread = {
    id: "provider-thread",
    nativeThreadRef: { driver: claude, nativeId: session, strength: "strong" },
  } as unknown as OrchestrationV2ProviderThread;
  const resume = <A, E>(upstream: Effect.Effect<A, E>) =>
    resumeWithTranscript({
      session: {
        instanceId: ProviderInstanceId.make("claudePersonal"),
        driver: claude,
        providerSessionId: "session" as never,
        resumeThread: () => upstream.pipe(Effect.as(providerThread), Effect.orDie),
      },
      fileSystem: fs,
      path,
    })({ providerThread });
  return { fs, path, personal, transcriptIn, resume };
});
