/**
 * What Aski's autonomy takes from upstream (stemcells/tasks/aski-autonomy.md):
 * a Cell's messages and shell, the orchestrator's dispatch, and the app's own
 * data folder for what autonomy keeps.
 *
 * A take is upstream's own command for the card's choice, as the room sends
 * it: a message, or for a plan upstream's "Implement", out of plan mode with
 * the plan sent back to build. Its command id is the card's key, so a card
 * is taken once however often it is sent.
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

import * as ServerConfig from "../../config.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import type { Answer, AutonomySource } from "../autonomy/Autonomy.ts";
import { PHRASES, PLAN_PREFIX, type Kind } from "../autonomy/kinds.ts";
import * as S from "../autonomy/standing.ts";
import type { Need } from "../needs/derive.ts";

/** Every take's ids start so: a screen can show it as Aski's, not the person's words. */
export const TAKE_PREFIX = "stemcells-autotake:";

/** The person's own messages come from their screens; a server's or an agent's never count. */
const PERSON_SOURCES: ReadonlySet<string> = new Set(["web", "mobile"]);

const decodeStanding = Schema.decodeUnknownEffect(Schema.fromJsonString(S.Standing));
const encodeStanding = Schema.encodeEffect(Schema.fromJsonString(S.Standing));

/** The commands that take `need`'s recommendation. */
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
  if (kind !== "implement") return [message(PHRASES[kind])];
  const plan = need.plan;
  if (plan?.id == null || plan.markdown == null) return [];
  return [
    {
      type: "thread.interaction-mode.set",
      commandId: CommandId.make(`${id}:mode`),
      threadId,
      interactionMode: "default",
    },
    message(`${PLAN_PREFIX}${plan.markdown.trim()}`, {
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

  const load = fs.readFileString(file).pipe(
    Effect.flatMap(decodeStanding),
    Effect.orElseSucceed(() => S.INITIAL),
  );

  // Written beside and renamed into place: a crash mid-write leaves the last whole file.
  const save = Effect.fn("Autonomy.save")(
    function* (standing: S.Standing) {
      yield* fs.makeDirectory(folder, { recursive: true });
      const temporary = `${file}.tmp`;
      yield* fs.writeFileString(temporary, yield* encodeStanding(standing));
      yield* fs.rename(temporary, file);
    },
    Effect.catchCause((cause) => Effect.logWarning("Couldn't keep autonomy's standing", cause)),
  );

  return { answered, take, load, save } satisfies Partial<AutonomySource>;
});
