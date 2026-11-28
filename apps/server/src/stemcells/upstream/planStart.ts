/**
 * What starting a plan's Cell from the server takes from upstream (stemcells/tasks/
 * aski-orchestrator.md, decisions 16 and 17): the launch a scheduled task's first run uses, the
 * check that a folder is a repository, and where a Cell works. `planStart.contract.test.ts`
 * pins the launch's input.
 */
import {
  CommandId,
  ModelSelection,
  ProjectId,
  ProviderInteractionMode,
  RuntimeMode,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as ThreadLaunch from "../../orchestration-v2/ThreadLaunchService.ts";
import * as ThreadManagement from "../../orchestration-v2/ThreadManagementService.ts";

/** The upstream services a start runs on. */
export type Needed = ThreadLaunch.ThreadLaunchService | ThreadManagement.ThreadManagementService;

/** A launch as a client hands it over, checked before it is kept. */
export const HandedLaunch = Schema.Struct({
  projectId: ProjectId,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
});
const decodeLaunch = Schema.decodeUnknownEffect(HandedLaunch);

export interface PlanStartInput {
  /** The same for every try of one Cell: upstream replays a launch it already took. */
  readonly commandId: string;
  readonly threadId: string;
  readonly title: string;
  readonly text: string;
  /** What the client handed over: project, model and modes. */
  readonly launch: unknown;
  /** In a worktree of its own, when the project's folder is a repository. */
  readonly worktree: boolean;
  /** The worktree of the Cell it came after, to work in; null for none. */
  readonly beside: { readonly worktreePath: string; readonly branch: string | null } | null;
}

export type PlanStarted = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Where a Cell works: its project, and its worktree when it has one. */
export const whereOf = Effect.fn("PlanStart.whereOf")(function* (threadId: string) {
  const threads = yield* ThreadManagement.ThreadManagementService;
  const shell = yield* threads
    .getThreadShell(ThreadId.make(threadId))
    .pipe(Effect.orElseSucceed(() => null));
  return shell === null
    ? null
    : {
        projectId: shell.projectId as string,
        worktreePath: shell.worktreePath,
        branch: shell.branch,
      };
});

/**
 * Starts a plan's Cell with its first message, as the person's own: beside the Cell it came
 * after, else in a worktree from the commit the project's folder is on, else in the folder. A
 * folder that is no repository has no worktree to give.
 */
export const start = Effect.fn("PlanStart.start")(function* (input: PlanStartInput) {
  const launches = yield* ThreadLaunch.ThreadLaunchService;
  const handed = yield* decodeLaunch(input.launch).pipe(Effect.option);
  if (handed._tag === "None")
    return { ok: false, reason: "What it was to start with no longer reads." } as PlanStarted;
  const { projectId, modelSelection, runtimeMode, interactionMode } = handed.value;
  const workspaceStrategy =
    input.beside !== null
      ? {
          type: "existing_worktree" as const,
          worktreePath: input.beside.worktreePath,
          ...(input.beside.branch === null ? {} : { branch: input.beside.branch }),
        }
      : input.worktree && !(yield* launches.isNonGitProject(projectId))
        ? { type: "worktree" as const, baseRef: "HEAD" }
        : { type: "root" as const };
  return yield* launches
    .launch({
      commandId: CommandId.make(input.commandId),
      threadId: ThreadId.make(input.threadId),
      projectId,
      title: input.title,
      titleRenamed: true,
      modelSelection,
      runtimeMode,
      interactionMode,
      workspaceStrategy,
      initialMessage: { text: input.text, attachments: [] },
      createdBy: "user",
      creationSource: "server",
    })
    .pipe(
      Effect.as<PlanStarted>({ ok: true }),
      Effect.catch((error) =>
        Effect.succeed<PlanStarted>({
          ok: false,
          reason: error.message.length > 0 ? error.message.slice(0, 200) : "The Cell didn't start.",
        }),
      ),
    );
});
