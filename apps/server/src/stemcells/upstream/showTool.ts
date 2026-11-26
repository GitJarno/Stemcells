/**
 * `stemcells_show` (stemcells/tasks/aski-side.md): the call is the show, each client reading its
 * input from Aski's chat (`stemcells/aski/show.ts`). It answers only the chat every client takes
 * for Aski's (`askiThreadOf`), so no Cell, earlier Aski or outside client moves a screen.
 */
import { OrchestratorMcpFailure, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as McpSchema from "effect/ai/McpSchema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import { SHOW_TOOL, showOfInput, type ShowInput } from "../../../../../stemcells/aski/show.ts";
import { crumbsFor, placeOf } from "../../../../../stemcells/settings/places.ts";
import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import * as ThreadManagement from "../../orchestration-v2/ThreadManagementService.ts";
import { askiThreadOf } from "../needs/derive.ts";

const ShowTool = Tool.make(SHOW_TOOL, {
  description:
    "Turns the person's screen, on the device they're talking to you from, to a Cell, a place in Settings or a stage of the home. Name exactly one. Only Aski's own chat may call it. It changes nothing.",
  parameters: Schema.Struct({
    cell: Schema.optionalKey(Schema.String.annotate({ description: "A Cell's threadId." })),
    settings: Schema.optionalKey(
      Schema.String.annotate({
        description: "A place as Settings names it, such as `Settings › Providers › Codex`.",
      }),
    ),
    stage: Schema.optionalKey(Schema.Literals(["Input", "Flying", "Landed", "Settled"])),
  }),
  success: Schema.Struct({ shown: Schema.String }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "Show the person a Cell, a setting or a stage")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  // It acts as the chat that calls it, so a client outside the app is never offered it.
  .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenFromOutsideClients);

export const ShowToolkit = Toolkit.make(ShowTool);

const failure = (code: OrchestratorMcpFailure["code"], message: string) =>
  new OrchestratorMcpFailure({ code, message });

const notAski = failure(
  "capability_denied",
  "Only Aski's own chat shows the person things, and this chat isn't it.",
);

const handlers = McpToolAccess.toLayer(
  ShowToolkit,
  Effect.gen(function* () {
    const threads = yield* ThreadManagement.ThreadManagementService;
    return {
      stemcells_show: McpToolAccess.readsAsCaller((input: ShowInput) =>
        Effect.gen(function* () {
          const scope = yield* McpInvocationContext.McpInvocationContext;
          const { threads: shells } = yield* threads.getShellSnapshot();
          if (scope.thread === undefined || askiThreadOf(shells) !== scope.thread.threadId) {
            return yield* notAski;
          }
          const show = showOfInput(input, scope.environmentId);
          if (show === null) {
            return yield* failure(
              "invalid_request",
              "Name exactly one: a Cell's threadId, a place in Settings as Settings names it, or a stage.",
            );
          }
          if (show.kind === "stage") return { shown: `Shown: the home's ${input.stage} stage.` };
          if (show.kind === "settings") {
            const place = placeOf(show.place);
            return {
              shown: `Shown: ${place === null ? show.place : crumbsFor(place).join(" › ")}.`,
            };
          }
          const cell = yield* threads.getThreadShell(ThreadId.make(show.threadId));
          if (cell === null || cell.deletedAt !== null) {
            return yield* failure("thread_not_found", `No Cell ${show.threadId} on this machine.`);
          }
          return { shown: `Shown: the Cell "${cell.title}".` };
        }).pipe(
          Effect.mapError((error) =>
            error._tag === "OrchestratorMcpFailure"
              ? error
              : failure("orchestration_error", error.message),
          ),
        ),
      ),
    };
  }),
);

export const registerShowTool = (register: typeof toolkitRegistration) =>
  register(ShowToolkit, handlers);
