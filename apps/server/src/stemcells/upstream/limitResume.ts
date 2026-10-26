/**
 * What a stopped Cell's resume takes from upstream (stemcells/tasks/limit-resume.md). The
 * resume is upstream's own manual continuation, the composer's "Resume thread", with
 * `manualContinuationOfRunId`. The orchestrator refuses it unless the stopped run is still
 * the latest and failed on a usage limit, so it never lands after another carried the Cell on.
 */
import {
  ClaudeSettings,
  CommandId,
  MessageId,
  RunId,
  ThreadId,
  type OrchestrationV2ServerCommand,
  type ProviderInstanceConfig,
} from "@t3tools/contracts";
import { mergeProviderInstanceEnvironment } from "@t3tools/provider-core/server/instanceEnvironment";
import { expandHomePath } from "@t3tools/provider-core/server/pathExpansion";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import { makeClaudeEnvironment, resolveClaudeHomePath } from "../../provider/Drivers/ClaudeHome.ts";
import { resolveClaudeSdkExecutablePath } from "../../provider/Drivers/ClaudeExecutable.ts";
import { deriveProviderInstanceConfigMap } from "../../provider/ProviderInstanceRegistryHydration.ts";
import * as ServerSettings from "../../serverSettings.ts";
import type { Driver, Reason } from "../limitResume/decide.ts";
import type { ClaudeLogin } from "../limitResume/login.ts";
import { makeNeedsSource, type NeedsSource, type Shell } from "./needs.ts";

export type { Shell };

/** A provider instance as the resume reads it. */
export interface Instance {
  readonly driver: Driver | null;
  /** How a Claude instance's Cells run; null for any other driver. */
  readonly login: ClaudeLogin | null;
}

/** The line every resume sends: upstream's own, the composer's "Resume thread". */
export const CONTINUE_LINE = "Continue where you left off.";

/**
 * The message a resume sends, named so every screen can show it as the row
 * it is ("Continued after …", `apps/web/src/stemcells/limitResume/row.ts`)
 * rather than as words the person typed. `nonce` is fresh for every send, so
 * no id is used twice, across retries and restarts alike.
 */
export const continuedMessageId = (
  reason: Reason,
  threadId: string,
  runId: string,
  nonce: string,
): string => `stemcells-continued:${reason}:${threadId}:${runId}:${nonce}`;

/** The command that carries a stopped Cell on, from the run the limit stopped. */
export function continueCommand(input: {
  readonly threadId: string;
  readonly runId: string;
  readonly reason: Reason;
  readonly nonce: string;
}): OrchestrationV2ServerCommand {
  const messageId = continuedMessageId(input.reason, input.threadId, input.runId, input.nonce);
  return {
    type: "message.dispatch",
    commandId: CommandId.make(messageId),
    threadId: ThreadId.make(input.threadId),
    messageId: MessageId.make(messageId),
    manualContinuationOfRunId: RunId.make(input.runId),
    text: CONTINUE_LINE,
    attachments: [],
    dispatchMode: { type: "start_immediately" },
    createdBy: "user",
    creationSource: "server",
  };
}

const DRIVERS: Readonly<Record<string, Driver>> = { claudeAgent: "claude", codex: "codex" };

const decodeClaudeSettings = Schema.decodeUnknownEffect(ClaudeSettings);

export interface LimitResumeSource {
  readonly ready: NeedsSource["ready"];
  readonly snapshot: NeedsSource["snapshot"];
  readonly changedThreads: NeedsSource["changedThreads"];
  readonly shell: NeedsSource["shell"];
  /** The platform the server runs on. */
  readonly platform: string;
  /** Settings' "Auto-resume limited threads": nothing carries on while it's off. */
  readonly enabled: Effect.Effect<boolean>;
  /** A fresh random id. */
  readonly newId: Effect.Effect<string>;
  /** Every provider instance, configured or upstream's default, by id. */
  readonly instances: Effect.Effect<ReadonlyMap<string, Instance>>;
  /** Sends the command; false when the orchestrator refused it. */
  readonly send: (command: OrchestrationV2ServerCommand) => Effect.Effect<boolean>;
}

export const makeLimitResumeSource = Effect.gen(function* () {
  const needs = yield* makeNeedsSource;
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const settings = yield* ServerSettings.ServerSettingsService;
  const platform = yield* HostProcess.Platform;
  const home = yield* HostProcess.HomeDirectory;
  const hostEnvironment = yield* HostProcess.Environment;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;

  /** As the Claude driver builds its adapter's launch (`createClaudeAdapterV2`). */
  const claudeLogin = Effect.fn("LimitResume.claudeLogin")(
    function* (instance: ProviderInstanceConfig) {
      const config = yield* decodeClaudeSettings(instance.config ?? {});
      const base = yield* mergeProviderInstanceEnvironment(instance.environment, hostEnvironment);
      const env = yield* makeClaudeEnvironment(config, base);
      const binaryPath = yield* resolveClaudeSdkExecutablePath(
        expandHomePath(config.binaryPath, home),
        env,
      );
      const configDir = yield* resolveClaudeHomePath(config, base);
      return { binaryPath, env, configDir } satisfies ClaudeLogin;
    },
    Effect.provideService(Path.Path, path),
    Effect.provideService(HostProcess.HomeDirectory, home),
    Effect.provideService(HostProcess.Platform, platform),
    Effect.orElseSucceed((): ClaudeLogin | null => null),
  );

  const instances = settings.getSettings.pipe(
    Effect.flatMap((current) =>
      Effect.forEach(Object.entries(deriveProviderInstanceConfigMap(current)), ([id, instance]) => {
        const driver = DRIVERS[instance.driver] ?? null;
        return (driver === "claude" ? claudeLogin(instance) : Effect.succeed(null)).pipe(
          Effect.map((login) => [id, { driver, login }] as const),
        );
      }),
    ),
    Effect.map((entries) => new Map<string, Instance>(entries)),
    Effect.orElseSucceed(() => new Map<string, Instance>()),
  );

  const enabled = settings.getSettings.pipe(
    Effect.map((current) => current.autoResumeLimitedThreads),
    Effect.orElseSucceed(() => false),
  );

  const send = (command: OrchestrationV2ServerCommand) =>
    threads.dispatch(command).pipe(
      Effect.as(true),
      Effect.catchCause((cause) =>
        Effect.logInfo("A stopped Cell's resume was refused", { cause }).pipe(Effect.as(false)),
      ),
    );

  return {
    ready: needs.ready,
    snapshot: needs.snapshot,
    changedThreads: needs.changedThreads,
    shell: needs.shell,
    platform,
    enabled,
    newId: crypto.randomUUIDv4().pipe(Effect.orDie),
    instances,
    send,
  } satisfies LimitResumeSource;
});
