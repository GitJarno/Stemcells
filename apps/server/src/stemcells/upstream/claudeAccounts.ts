import * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import type { ClaudeSettings } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { resolveClaudeHomePath } from "../../provider/Drivers/ClaudeHome.ts";
import { carryClaudeTranscript } from "../accounts/carry.ts";
import {
  CLAUDE_LOGIN_CONTINUATION,
  isPlainClaudeLogin,
  knownLoginFolders,
  loginFolderOf,
  noteLoginFolder,
} from "../accounts/claudeLogins.ts";

// A thread moves between two Claude accounts with its whole transcript
// (stemcells/tasks/account-switch.md). Upstream resumes in place only between instances of one
// continuation key and hands off otherwise, so plain-login instances share a key (one line in
// `ClaudeDriver.ts`), and a resume first brings the transcript along (`ProviderTurnStartService.ts`).

type Session = ProviderAdapter.ProviderAdapterV2SessionRuntime;

/** Upstream's continuation key for a Claude instance, or the one every plain-login one shares. */
export const claudeContinuationKey = Effect.fn("Stemcells.claudeContinuationKey")(function* (
  upstreamKey: string,
  {
    instanceId,
    config,
    env,
  }: {
    readonly instanceId: string;
    readonly config: Pick<ClaudeSettings, "homePath" | "launchArgs">;
    readonly env: NodeJS.ProcessEnv;
  },
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const folder = yield* resolveClaudeHomePath(config, env);
  const settingsJson = yield* fs
    .readFileString(path.join(folder, "settings.json"))
    .pipe(Effect.option, Effect.map(Option.getOrUndefined));
  if (!isPlainClaudeLogin({ env, settingsJson, launchArgs: config.launchArgs })) {
    noteLoginFolder(instanceId, null);
    return upstreamKey;
  }
  noteLoginFolder(instanceId, folder);
  return CLAUDE_LOGIN_CONTINUATION;
});

/**
 * Upstream's resume, once the newest copy of the transcript is in the account's folder. A copy
 * that fails fails the resume, so upstream starts a fresh session with a handoff as before.
 */
export const resumeWithTranscript =
  ({
    session,
    fileSystem,
    path,
  }: {
    readonly session: Pick<Session, "instanceId" | "driver" | "providerSessionId" | "resumeThread">;
    readonly fileSystem: FileSystem.FileSystem;
    readonly path: Path.Path;
  }): Session["resumeThread"] =>
  (input) =>
    Effect.gen(function* () {
      const sessionId = input.providerThread.nativeThreadRef?.nativeId ?? undefined;
      const target = loginFolderOf(session.instanceId);
      if (sessionId !== undefined && target !== undefined) {
        const carried = yield* carryClaudeTranscript({
          sessionId,
          target,
          folders: knownLoginFolders(),
        }).pipe(
          Effect.provideService(FileSystem.FileSystem, fileSystem),
          Effect.provideService(Path.Path, path),
          Effect.tapError((cause) =>
            Effect.logWarning("Carrying a Claude transcript failed", cause),
          ),
          Effect.mapError(
            (cause) =>
              new ProviderAdapter.ProviderAdapterResumeThreadError({
                driver: session.driver,
                providerSessionId: session.providerSessionId,
                providerThreadId: input.providerThread.id,
                cause,
              }),
          ),
        );
        if (carried) yield* Effect.logInfo("Carried a Claude transcript to another account");
      }
      return yield* session.resumeThread(input);
    }).pipe(Effect.withSpan("Stemcells.resumeWithTranscript"));
