/**
 * `stemcells_recall`: what Cells did, found by words, time and project from their cards
 * (`recall/Recall.ts`). Read only. Aski's chat reads every project's; any other Cell its own
 * repository's alone, as who's-here tells it only of those (`peers.ts`). Registered beside
 * upstream's toolkits, as `standingTool.ts` is; its Recall is the instance the HTTP route reads.
 */
import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as McpSchema from "effect/ai/McpSchema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";
import * as Recall from "../recall/Recall.ts";
import { reportOf } from "../recall/report.ts";

const LIMIT = 12;

const RecallTool = Tool.make("stemcells_recall", {
  description:
    'What Cells did, from the card each keeps: what the person asked it, its own close-out, how it landed (checks, pull request, lines changed), when, and whether it is awake or asleep. Use it for any question about past work ("where was the chat about the film page two days ago", "what did we do in Harbor this week") before reading any transcript. Pass the person\'s question as query: the time ("two days ago", "last week", "on Tuesday", "in March") and the project, by ear, are read from it by code, and the rest is searched as free words. Each Cell comes back as a link. Aski reads every project; any other Cell reads its own repository\'s Cells. Read only.',
  parameters: Schema.Struct({
    query: Schema.String.check(Schema.isMaxLength(2000)).annotate({
      description:
        "The person's question, in their words. Its time and project are read by code; leave them in.",
    }),
    from: Schema.optional(
      Schema.String.annotate({
        description:
          "Only Cells touched at or after this ISO date or time. Leave out to use the time the query names.",
      }),
    ),
    to: Schema.optional(
      Schema.String.annotate({ description: "Only Cells touched before this ISO date or time." }),
    ),
    project: Schema.optional(
      Schema.String.annotate({
        description: "A project's name, when the query doesn't say it. Near spellings are fine.",
      }),
    ),
    state: Schema.optional(
      Schema.Literals(["awake", "asleep", "both"]).annotate({
        description: "Awake Cells, asleep Cells, or both (the default).",
      }),
    ),
    limit: Schema.optional(
      Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 30 })).annotate({
        description: `How many Cells to return; ${LIMIT} when left out.`,
      }),
    ),
  }),
  success: Schema.Struct({
    found: Schema.Number,
    more: Schema.Number,
    report: Schema.String,
  }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
  ],
})
  .annotate(Tool.Title, "Recall what Cells did")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  // It answers for the Cell that calls it, so a client outside the app is never offered it.
  .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenFromOutsideClients);

const RecallToolkit = Toolkit.make(RecallTool);

const timeOf = (words: string | undefined): number | null => {
  const read = words === undefined ? Number.NaN : Date.parse(words);
  return Number.isFinite(read) ? read : null;
};

const handlers = McpToolAccess.toLayer(
  RecallToolkit,
  Effect.gen(function* () {
    const recall = yield* Recall.Recall;
    return {
      stemcells_recall: McpToolAccess.readsAsCaller((input) =>
        Effect.gen(function* () {
          const scope = yield* McpInvocationContext.McpInvocationContext;
          const caller = yield* McpInvocationContext.requireThreadScope(scope, "stemcells_recall");
          const threads = yield* ThreadManagementService.ThreadManagementService;
          // Aski's own chat alone reads every project: a Subcell of Aski's is a Cell like any.
          const aski =
            caller.thread.providerInstanceId === ASKI_INSTANCE_ID &&
            caller.thread.subagent !== true;
          const own = aski
            ? null
            : yield* threads.getThreadShell(caller.thread.threadId).pipe(
                Effect.mapError(
                  () =>
                    new OrchestratorMcpFailure({
                      code: "orchestration_error",
                      message: "Could not read the calling Cell's project.",
                    }),
                ),
              );
          if (!aski && own === null) {
            return yield* new OrchestratorMcpFailure({
              code: "thread_not_found",
              message: "The calling Cell's chat is gone.",
            });
          }
          const answer = yield* recall
            .search({
              query: input.query,
              from: timeOf(input.from),
              to: timeOf(input.to),
              project: input.project ?? null,
              state: input.state ?? "both",
              limit: input.limit ?? LIMIT,
              scope: own === null ? "all" : { projectId: own.projectId },
            })
            .pipe(
              Effect.mapError(
                (error) =>
                  new OrchestratorMcpFailure({
                    code: "orchestration_error",
                    message: error.message,
                  }),
              ),
            );
          return { found: answer.cards.length, more: answer.more, report: reportOf(answer) };
        }),
      ),
    };
  }),
);

/** Needs a `Recall`: `mcpTools.ts` gives it the server's one. */
export const registerRecallTool = (register: typeof toolkitRegistration) =>
  register(RecallToolkit, handlers);
