/**
 * What Aski's autonomy takes from upstream (stemcells/tasks/aski-autonomy.md): a Cell's
 * messages and shell, the orchestrator's dispatch, and the app's data folder. A take is
 * upstream's own command for the card's choice (a message, or a plan's "Implement"), and its
 * command id is the card's key, so a card is taken once however often it is sent.
 */
import {
  CommandId,
  MessageId,
  PlanId,
  ThreadId,
  type OrchestrationV2ServerCommand,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import * as ServerConfig from "../../config.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import type { Answer, AutonomySource } from "../autonomy/Autonomy.ts";
import {
  askOf,
  BOUNDARY,
  PHRASES,
  PLAN_PREFIX,
  reversible as asksNothingFinal,
  type Kind,
} from "../autonomy/kinds.ts";
import * as S from "../autonomy/standing.ts";
import type { Need } from "../needs/derive.ts";

/** Every take's ids start so: a screen can show it as Aski's, not the person's words. */
export const TAKE_PREFIX = "stemcells-autotake:";

/**
 * The person's own messages come from their screens; a server's or an
 * agent's never count, nor a scheduled task's, which carries its maker's name.
 */
const PERSON_SOURCES: ReadonlySet<string> = new Set(["web", "mobile"]);

const decodeStanding = Schema.decodeUnknownEffect(Schema.fromJsonString(S.Standing));
const encodeStanding = Schema.encodeEffect(Schema.fromJsonString(S.Standing));

/** The commands that take `need`'s recommendation, with the boundary the person granted it under. */
export function takeCommands(need: Need, kind: Kind): ReadonlyArray<OrchestrationV2ServerCommand> {
  const id = `${TAKE_PREFIX}${need.key}`;
  const threadId = ThreadId.make(need.threadId);
  const message = (text: string, sourcePlanRef?: { threadId: ThreadId; planId: PlanId }) =>
    ({
      type: "message.dispatch",
      commandId: CommandId.make(id),
      threadId,
      messageId: MessageId.make(id),
      text,
      attachments: [],
      dispatchMode: { type: "start_immediately" },
      createdBy: "user",
      creationSource: "server",
      ...(sourcePlanRef === undefined ? {} : { sourcePlanRef }),
    }) satisfies OrchestrationV2ServerCommand;
  if (kind !== "implement") return [message(`${PHRASES[kind]} ${BOUNDARY}`)];
  const plan = need.plan;
  if (plan?.id == null || plan.markdown == null) return [];
  return [
    {
      type: "thread.interaction-mode.set",
      commandId: CommandId.make(`${id}:mode`),
      threadId,
      interactionMode: "default",
    },
    message(`${PLAN_PREFIX}${plan.markdown.trim()}\n\n${BOUNDARY}`, {
      threadId,
      planId: PlanId.make(plan.id),
    }),
  ];
}

export const makeAutonomySource = Effect.gen(function* () {
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const config = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const folder = path.join(config.stateDir, "stemcells");
  const file = path.join(folder, "autonomy.json");

  const answered = Effect.fn("Autonomy.answered")(
    function* (threadId: string, since: number) {
      const id = ThreadId.make(threadId);
      const records = yield* threads.getThreadRecords(id, ["messages"], {
        messageRoles: ["user"],
      });
      const first = records.messages
        .filter(
          (message) =>
            message.createdBy === "user" &&
            PERSON_SOURCES.has(message.creationSource) &&
            message.scheduledTaskId === undefined &&
            DateTime.toEpochMillis(message.createdAt) >= since,
        )
        .toSorted(
          (a, b) => DateTime.toEpochMillis(a.createdAt) - DateTime.toEpochMillis(b.createdAt),
        )[0];
      if (first !== undefined) return { said: first.text } satisfies Answer;
      const shell = yield* threads.getThreadShell(id);
      return shell?.settledOverride === "settled" ? ("settled" as const) : null;
    },
    Effect.catchCause(() => Effect.succeed<Answer>(null)),
  );

  // A retry runs the failed request again: what it repeats must name
  // nothing plainly final. A stop and a plan are read on the card itself
  // (`kindOf`). Unreadable, the card stays the person's.
  const reversible = Effect.fn("Autonomy.reversible")(
    function* (need: Need, kind: Kind) {
      if (kind !== "retry") return true;
      const records = yield* threads.getThreadRecords(ThreadId.make(need.threadId), ["messages"], {
        messageRoles: ["user", "assistant"],
      });
      const until = Date.parse(need.since);
      const conversation = records.messages
        .filter((message) => DateTime.toEpochMillis(message.createdAt) <= until)
        .toSorted(
          (a, b) => DateTime.toEpochMillis(b.createdAt) - DateTime.toEpochMillis(a.createdAt),
        )
        .flatMap((message) =>
          message.role === "system" ? [] : [{ role: message.role, text: message.text }],
        );
      return conversation.length > 0 && asksNothingFinal(askOf(conversation));
    },
    Effect.catchCause(() => Effect.succeed(false)),
  );

  const take = Effect.fn("Autonomy.take")(
    function* (need: Need, kind: Kind) {
      const commands = takeCommands(need, kind);
      if (commands.length === 0) return false;
      for (const command of commands) yield* threads.dispatch(command);
      return true;
    },
    Effect.catchCause((cause) =>
      Effect.logInfo("A card Aski took was refused", { cause }).pipe(Effect.as(false)),
    ),
  );

  // No file yet is a fresh start; one that won't read is said so before it is replaced.
  const load = fs.readFileString(file).pipe(
    Effect.orElseSucceed(() => null),
    Effect.flatMap((text) =>
      text === null
        ? Effect.succeed(S.INITIAL)
        : decodeStanding(text).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("Autonomy's standing didn't read; starting afresh", cause).pipe(
                Effect.as(S.INITIAL),
              ),
            ),
          ),
    ),
  );

  // Written beside and renamed into place, one at a time in the order they
  // came: a crash mid-write leaves the last whole file, and an older
  // standing never lands over a newer one.
  const saving = yield* Semaphore.make(1);
  const save = Effect.fn("Autonomy.save")(
    function* (standing: S.Standing) {
      yield* fs.makeDirectory(folder, { recursive: true });
      const temporary = `${file}.tmp`;
      yield* fs.writeFileString(temporary, yield* encodeStanding(standing));
      yield* fs.rename(temporary, file);
    },
    saving.withPermit,
    Effect.catchCause((cause) => Effect.logWarning("Couldn't keep autonomy's standing", cause)),
  );

  return { answered, reversible, take, load, save } satisfies Partial<AutonomySource>;
});
