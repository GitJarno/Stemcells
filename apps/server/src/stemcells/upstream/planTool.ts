/**
 * Aski's chat and plans (stemcells/tasks/aski-orchestrator.md, decisions 1 and 7).
 * `stemcells_plan` reads what came of the plan Stemcells made from the person's message.
 * `stemcells_propose` is the only way Aski's chat gets Cells started: it makes a plan whose
 * every Cell waits for the person, who sees each word first. Both answer only Aski's own chat.
 */
import { OrchestratorMcpFailure, ProjectId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as McpSchema from "effect/ai/McpSchema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import { proposedPlan } from "../../../../../stemcells/orchestrator/check.ts";
import { CEILING } from "../../../../../stemcells/orchestrator/plan.ts";
import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";
import { markTold, outcomeOf, planOfId, putPlan, standingOf } from "../aski/book.ts";
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";
import { planReport } from "../aski/note.ts";
import { ModelSelection } from "./planner.ts";

/** How long `stemcells_plan` waits for the client to say what came of a plan. */
const OUTCOME_WAIT_MS = 20_000;
/** The longest first message Aski's chat may propose for a Cell. */
const WORDS_MOST = 20_000;

const PlanTool = Tool.make("stemcells_plan", {
  description:
    "Read what came of a plan Stemcells made from the person's message: each Cell it started, as its link, and what still waits for the person. Call it when a note beside the message names a plan id. Read only.",
  parameters: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ report: Schema.String }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "Read what a plan started")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenFromOutsideClients);

const ProposeTool = Tool.make("stemcells_propose", {
  description:
    "Propose Cells to start. Nothing starts from this call: the person sees each Cell with every word of its first message and starts it with a tap. Give each Cell its projectId, a title of at most six words and its first message. Name a modelSelection only when the person asked for a model; leave it out for the project's default. Then show the plan by putting the returned `show` block in your reply as it is.",
  parameters: Schema.Struct({
    cells: Schema.Array(
      Schema.Struct({
        projectId: ProjectId,
        title: Schema.String,
        message: Schema.String,
        modelSelection: Schema.optional(ModelSelection),
      }),
    ),
  }),
  success: Schema.Struct({ planId: Schema.String, show: Schema.String, note: Schema.String }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "Propose Cells for the person to start")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenFromOutsideClients);

export const PlanToolkit = Toolkit.make(PlanTool, ProposeTool);

const failure = (code: OrchestratorMcpFailure["code"], message: string) =>
  new OrchestratorMcpFailure({ code, message });

const notAski = failure(
  "capability_denied",
  "Plans are Aski's own chat's, and this chat isn't it.",
);

/** The calling chat, when it is Aski's own (never a helper Aski started). */
const askiCaller = Effect.gen(function* () {
  const scope = yield* McpInvocationContext.McpInvocationContext;
  const thread = scope.thread;
  if (
    thread === undefined ||
    thread.providerInstanceId !== ASKI_INSTANCE_ID ||
    thread.subagent === true
  )
    return yield* notAski;
  return thread;
});

const handlers = McpToolAccess.toLayer(
  PlanToolkit,
  Effect.gen(function* () {
    const projects = yield* ProjectStore.ProjectStoreV2;
    return {
      stemcells_plan: McpToolAccess.readsAsCaller(({ id }: { readonly id: string }) =>
        Effect.gen(function* () {
          yield* askiCaller;
          const entry = planOfId(id);
          if (entry === null)
            return yield* failure("invalid_request", `No plan ${id}. It may be too old to read.`);
          const outcome = yield* Effect.promise(() => outcomeOf(id, OUTCOME_WAIT_MS));
          // Read again: the outcome just told says which Cells started.
          markTold(planOfId(id) ?? entry);
          return { report: planReport(entry.plan, outcome, standingOf) };
        }),
      ),
      stemcells_propose: McpToolAccess.readsAsCaller(
        (input: {
          readonly cells: ReadonlyArray<{
            readonly projectId: ProjectId;
            readonly title: string;
            readonly message: string;
            readonly modelSelection?: ModelSelection | undefined;
          }>;
        }) =>
          Effect.gen(function* () {
            const caller = yield* askiCaller;
            if (input.cells.length === 0 || input.cells.length > CEILING)
              return yield* failure("invalid_request", `A plan takes 1 to ${CEILING} Cells.`);
            const shells = yield* projects
              .listShells({ projectIds: input.cells.map((cell) => cell.projectId) })
              .pipe(Effect.mapError((error) => failure("orchestration_error", error.message)));
            const names = new Map(shells.map((shell) => [shell.id as string, shell.title]));
            for (const cell of input.cells) {
              if (!names.has(cell.projectId))
                return yield* failure(
                  "invalid_request",
                  `No project ${cell.projectId} here. List them with t3_project_list.`,
                );
              if (cell.message.trim().length === 0 || cell.message.length > WORDS_MOST)
                return yield* failure("invalid_request", "Each Cell needs a first message.");
              if (cell.modelSelection?.instanceId === ASKI_INSTANCE_ID)
                return yield* failure(
                  "invalid_request",
                  `Provider instance "${ASKI_INSTANCE_ID}" is Aski's own, and no Cell runs on it. Leave modelSelection out for the project's default.`,
                );
            }
            const now = DateTime.toEpochMillis(yield* DateTime.now);
            const plan = proposedPlan({
              // @effect-diagnostics-next-line cryptoRandomUUIDInEffect:off -- A plan's id only has to be new; the pure checks take plain values.
              id: crypto.randomUUID(),
              cells: input.cells.map((cell) => ({
                projectId: cell.projectId,
                projectName: names.get(cell.projectId)!,
                title: cell.title,
                words: cell.message,
                ...(cell.modelSelection === undefined
                  ? {}
                  : {
                      selection: {
                        instanceId: cell.modelSelection.instanceId,
                        model: cell.modelSelection.model,
                        ...(cell.modelSelection.options === undefined
                          ? {}
                          : { options: cell.modelSelection.options }),
                      },
                    }),
              })),
              // @effect-diagnostics-next-line cryptoRandomUUID:off -- The pure checks take a plain function to mint with.
              mint: () => crypto.randomUUID(),
            });
            putPlan({
              plan,
              text: input.cells.map((cell) => cell.message).join("\n\n"),
              threadId: caller.threadId,
              at: now,
            });
            return {
              planId: plan.id,
              show: `\`\`\`plan\n${plan.id}\n\`\`\``,
              note: "Nothing has started. Put the show block in your reply as it is, on lines of its own, and say in one line what you propose. The person starts each Cell there.",
            };
          }),
      ),
    };
  }),
);

export const registerPlanTools = (register: typeof toolkitRegistration) =>
  register(PlanToolkit, handlers);
