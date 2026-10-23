import {
  type MessageId,
  type ModelSelection,
  type OrchestrationV2ConversationMessage,
  type OrchestrationV2Run,
  orchestrationV2RunWorkStartedAt,
  type ThreadId,
} from "@t3tools/contracts";
import type { Runner } from "@t3tools/provider-core/server/textGenerationOperations";
import { assistantCitationsToPlainText } from "@t3tools/shared/assistantCitations";
import * as Effect from "effect/Effect";

import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import * as ProviderInstanceRegistry from "../../provider/ProviderInstanceRegistry.ts";
import * as ServerSettings from "../../serverSettings.ts";

// What the next-prompt suggestion takes from upstream: a thread's runs and
// the messages of the last few, the driver a run went to, and the lean call
// (`runLean`, a seam in provider-core) of the text generation model, the one
// that names threads.

export type SuggestionRun = Pick<
  OrchestrationV2Run,
  | "id"
  | "ordinal"
  | "status"
  | "providerInstanceId"
  | "userMessageId"
  | "completedAt"
  | "requestedAt"
  | "startedAt"
  | "workStartedAt"
>;

/** When the run began its work, as upstream reads it. */
export const runStartedAt = (run: SuggestionRun) => orchestrationV2RunWorkStartedAt(run);

export type SuggestionMessage = Pick<
  OrchestrationV2ConversationMessage,
  "id" | "role" | "text" | "streaming" | "createdAt"
>;

export interface SuggestionSource {
  /** The thread's runs; none when the thread isn't one this server holds. */
  readonly runs: (threadId: ThreadId) => Effect.Effect<ReadonlyArray<SuggestionRun>>;
  /**
   * The assistant messages of `replyRun`, and the person's messages
   * `userMessageIds` names, as plain text; null when they can't be read.
   */
  readonly messages: (
    threadId: ThreadId,
    replyRun: SuggestionRun["id"],
    userMessageIds: ReadonlyArray<MessageId>,
  ) => Effect.Effect<{
    readonly replies: ReadonlyArray<SuggestionMessage>;
    readonly asked: ReadonlyArray<SuggestionMessage>;
  } | null>;
  /** The driver of an instance ("claudeAgent", "codex"…); null when it's gone. */
  readonly driver: (
    instanceId: SuggestionRun["providerInstanceId"],
  ) => Effect.Effect<string | null>;
  /** The text generation model and its lean call; null when it has none or is off. */
  readonly writer: Effect.Effect<{
    readonly run: Runner;
    readonly modelSelection: ModelSelection;
  } | null>;
}

const plainText = (message: SuggestionMessage): SuggestionMessage => ({
  ...message,
  text: message.role === "assistant" ? assistantCitationsToPlainText(message.text) : message.text,
});

export const makeSuggestionSource = Effect.gen(function* () {
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const registry = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  const settings = yield* ServerSettings.ServerSettingsService;

  return {
    runs: (threadId) =>
      threads.getThreadRecords(threadId, ["runs"]).pipe(
        Effect.map((records): ReadonlyArray<SuggestionRun> => records.runs),
        Effect.orElseSucceed((): ReadonlyArray<SuggestionRun> => []),
      ),
    messages: (threadId, replyRun, userMessageIds) =>
      Effect.all({
        replies: threads.getThreadRecords(threadId, ["messages"], {
          messageRoles: ["assistant"],
          messageRunIds: [replyRun],
        }),
        asked: threads.getThreadRecords(threadId, ["messages"], {
          messageRoles: ["user"],
          messageIds: userMessageIds,
        }),
      }).pipe(
        Effect.map(({ replies, asked }) => ({
          replies: replies.messages.map(plainText),
          asked: asked.messages.map(plainText),
        })),
        Effect.orElseSucceed(() => null),
      ),
    driver: (instanceId) =>
      registry
        .getInstance(instanceId)
        .pipe(Effect.map((instance) => (instance === undefined ? null : instance.driverKind))),
    writer: Effect.gen(function* () {
      const current = yield* settings.getSettings.pipe(Effect.option);
      if (current._tag === "None") return null;
      const modelSelection = current.value.textGenerationModelSelection;
      const instance = yield* registry.getInstance(modelSelection.instanceId);
      const run = instance?.enabled ? instance.textGeneration.runLean : undefined;
      return run === undefined ? null : { run, modelSelection };
    }),
  } satisfies SuggestionSource;
});
