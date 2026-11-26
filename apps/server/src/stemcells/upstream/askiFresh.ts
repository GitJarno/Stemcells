/**
 * New Aski (stemcells/tasks/aski-side.md), made as the web makes Aski's chat (`upstream/aski.ts`)
 * and pinned, which makes it Aski's (`askiThreadOf`). No command id here starts `server:`, so the
 * old chat's settle reads as the person's (`settledByHandAt`) and every Mac closes its panes.
 */
import {
  CommandId,
  ThreadId,
  type OrchestrationV2ServerCommand,
  type OrchestrationV2ThreadShell,
  type ProjectId,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SecureRandom from "effect/crypto/SecureRandom";

import * as ThreadManagement from "../../orchestration-v2/ThreadManagementService.ts";
import * as ManagedProjectFolders from "../../project/ManagedProjectFolders.ts";
import { askiThreadOf } from "../needs/derive.ts";

/** Aski's chat's title; the web's `aski/setup.ts` names the same. */
const ASKI_TITLE = "Aski";

export class AskiFreshError extends Schema.TaggedError<AskiFreshError>()("AskiFreshError", {
  /** `no-aski`: there is no Aski chat yet, which a client makes; `refused`: upstream said no. */
  reason: Schema.Literals(["no-aski", "refused"]),
  message: Schema.String,
}) {}

export class AskiFresh extends Context.Service<
  AskiFresh,
  {
    /** Starts a fresh Aski chat and settles the one before; the fresh one's thread. */
    readonly fresh: Effect.Effect<{ readonly threadId: ThreadId }, AskiFreshError>;
  }
>()("t3/stemcells/upstream/askiFresh") {}

/** The commands that make `threadId` Aski's chat in `projectId` and put `old` away. */
function freshCommands(
  old: OrchestrationV2ThreadShell,
  threadId: ThreadId,
  projectId: ProjectId,
): ReadonlyArray<OrchestrationV2ServerCommand> {
  const id = (step: string) => CommandId.make(`stemcells-aski-fresh:${threadId}:${step}`);
  return [
    {
      type: "thread.create",
      commandId: id("create"),
      createdBy: "user",
      creationSource: "server",
      threadId,
      projectId,
      title: ASKI_TITLE,
      modelSelection: old.modelSelection,
      runtimeMode: old.runtimeMode,
      interactionMode: "default",
      branch: null,
      worktreePath: null,
    },
    { type: "thread.pin", commandId: id("pin"), threadId },
    { type: "thread.unpin", commandId: id("unpin"), threadId: old.id },
    { type: "thread.settle", commandId: id("settle"), threadId: old.id },
  ];
}

export const layer = Layer.effect(
  AskiFresh,
  Effect.gen(function* () {
    const threads = yield* ThreadManagement.ThreadManagementService;
    const folders = yield* ManagedProjectFolders.ManagedProjectFolders;
    const random = yield* SecureRandom.SecureRandom;
    // One at a time: two at once could each pin a chat and leave two Askis pinned.
    const one = yield* Semaphore.make(1);

    const refused = (error: { readonly message: string }) =>
      new AskiFreshError({ reason: "refused", message: error.message });

    const fresh = Effect.gen(function* () {
      const { threads: shells } = yield* threads.getShellSnapshot().pipe(Effect.mapError(refused));
      const oldId = askiThreadOf(shells);
      const old = shells.find((shell) => shell.id === oldId);
      if (old === undefined) {
        return yield* new AskiFreshError({
          reason: "no-aski",
          message: "Aski has no chat on this server to start afresh from.",
        });
      }
      // Where upstream offers a chat without a project, as the web's Aski does; else the old one's.
      const projectId = yield* folders.ensureScratchProject.pipe(
        Effect.map((scratch) => scratch.projectId),
        Effect.orElseSucceed(() => old.projectId),
      );
      const threadId = ThreadId.make(yield* random.uuidV4());
      for (const command of freshCommands(old, threadId, projectId)) {
        yield* threads.dispatch(command).pipe(Effect.mapError(refused));
      }
      return { threadId };
    }).pipe(one.withPermit, Effect.withSpan("AskiFresh.fresh"));

    return { fresh };
  }),
);
