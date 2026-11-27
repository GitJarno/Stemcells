/**
 * A provider for tests that drive upstream's orchestrator: it writes down what it reads, and
 * a turn ends at once, or runs until its steer when the message ends with `KEEP_WORKING`.
 */
import {
  type OrchestrationV2ProviderThread,
  ProviderDriverKind,
  ProviderInstanceId,
  ProviderThreadId,
  ProviderTurnId,
} from "@t3tools/contracts";
import * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { CodexProviderCapabilitiesV2 } from "../../orchestration-v2/Adapters/CodexAdapterV2.ts";

export const driver = ProviderDriverKind.make("codex");
export const instanceId = ProviderInstanceId.make("codex");

/** The message that keeps a turn running until a steer arrives. */
export const KEEP_WORKING = "Keep working until I steer you.";

export interface Read {
  readonly via: "start" | "steer";
  readonly text: string;
}

/** A provider that writes down what it reads; a turn ends at once, or at its steer. */
export function readingAdapter(reads: Ref.Ref<ReadonlyArray<Read>>) {
  return {
    instanceId,
    driver,
    getCapabilities: () => Effect.succeed(CodexProviderCapabilitiesV2),
    planSelectionTransition: () => Effect.succeed({ type: "apply_on_next_turn" as const }),
    openSession: (session) =>
      Effect.gen(function* () {
        const events = yield* Queue.unbounded<ProviderAdapter.ProviderAdapterV2Event>();
        const active = yield* Ref.make<ProviderAdapter.ProviderAdapterV2TurnInput | null>(null);
        const now = yield* DateTime.now;
        const turnOf = (input: ProviderAdapter.ProviderAdapterV2TurnInput) =>
          ProviderTurnId.make(`provider-turn:${input.attemptId}`);
        const publish = (
          input: ProviderAdapter.ProviderAdapterV2TurnInput,
          status: "running" | "completed",
        ) =>
          Effect.gen(function* () {
            const at = yield* DateTime.now;
            yield* Queue.offer(events, {
              type: "provider_turn.updated",
              driver,
              providerTurn: {
                id: turnOf(input),
                providerThreadId: input.providerThread.id,
                nodeId: input.rootNodeId,
                runAttemptId: input.attemptId,
                nativeTurnRef: {
                  driver,
                  nativeId: `native:${input.attemptId}`,
                  strength: "strong",
                },
                ordinal: input.providerTurnOrdinal,
                status,
                startedAt: at,
                completedAt: status === "running" ? null : at,
              },
            });
            if (status === "running") return;
            yield* Queue.offer(events, {
              type: "turn.terminal",
              driver,
              providerThreadId: input.providerThread.id,
              providerTurnId: turnOf(input),
              runOrdinal: input.runOrdinal,
              status,
              failure: null,
              threadDisposition: "reusable",
            });
          });
        return {
          instanceId,
          driver,
          providerSessionId: session.providerSessionId,
          providerSession: {
            id: session.providerSessionId,
            driver,
            providerInstanceId: instanceId,
            status: "ready",
            cwd: session.runtimePolicy.cwd ?? "/fallback",
            model: session.modelSelection.model,
            capabilities: CodexProviderCapabilitiesV2,
            createdAt: now,
            updatedAt: now,
            lastError: null,
          },
          events: Stream.fromQueue(events),
          ensureThread: (thread) =>
            Effect.succeed({
              id: ProviderThreadId.make(`provider-thread:${thread.threadId}`),
              driver,
              providerInstanceId: instanceId,
              providerSessionId: session.providerSessionId,
              appThreadId: thread.threadId,
              ownerNodeId: null,
              nativeThreadRef: {
                driver,
                nativeId: `native:${thread.threadId}`,
                strength: "strong",
              },
              nativeConversationHeadRef: null,
              status: "idle",
              firstRunOrdinal: null,
              lastRunOrdinal: null,
              handoffIds: [],
              forkedFrom: null,
              createdAt: now,
              updatedAt: now,
            } satisfies OrchestrationV2ProviderThread),
          resumeThread: ({ providerThread }) => Effect.succeed(providerThread),
          startTurn: (input) =>
            Effect.gen(function* () {
              yield* Ref.update(reads, (all) => [
                ...all,
                { via: "start" as const, text: input.message.text },
              ]);
              if (input.message.text.endsWith(KEEP_WORKING)) {
                yield* Ref.set(active, input);
                return yield* publish(input, "running");
              }
              yield* publish(input, "completed");
            }),
          steerTurn: (input) =>
            Effect.gen(function* () {
              yield* Ref.update(reads, (all) => [
                ...all,
                { via: "steer" as const, text: input.message.text },
              ]);
              const running = yield* Ref.get(active);
              if (running !== null) yield* publish(running, "completed");
            }),
          interruptTurn: () => Effect.void,
          respondToRuntimeRequest: () => Effect.void,
          readThreadSnapshot: () => Effect.die("unused readThreadSnapshot"),
          rollbackThread: () => Effect.die("unused rollbackThread"),
          forkThread: () => Effect.die("unused forkThread"),
        };
      }),
  } satisfies ProviderAdapter.ProviderAdapterV2["Service"];
}
