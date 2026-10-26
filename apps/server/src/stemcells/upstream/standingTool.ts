/**
 * `stemcells_standing`: Aski's room in one read (`needs/standing.ts`), with the numbers the
 * cards show. Read only. Registered beside upstream's toolkits, as `diskTool.ts` is. Its
 * Needs is the instance Aski's room streams: Effect builds a layer once per server, however
 * many layers provide it, so the numbers here are the cards'.
 */
import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";
import * as Needs from "../needs/Needs.ts";
import { standingOf } from "../needs/standing.ts";

const StandingTool = Tool.make("stemcells_standing", {
  description:
    "Where every Cell on this server stands, across every project: what needs the person, under the numbers Aski's room shows on its cards; the Cells at work; and those done but not yet settled. Each Cell is linked. Read only.",
  parameters: Tool.EmptyParams,
  success: Schema.Struct({
    needsYou: Schema.Number,
    atWork: Schema.Number,
    done: Schema.Number,
    report: Schema.String,
  }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "Read where every Cell stands")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false);

export const StandingToolkit = Toolkit.make(StandingTool);

const handlers = McpToolAccess.toLayer(
  StandingToolkit,
  Effect.gen(function* () {
    const needs = yield* Needs.Needs;
    const projects = yield* ProjectStore.ProjectStoreV2;
    return {
      stemcells_standing: McpToolAccess.readsAsCaller(() =>
        Effect.gen(function* () {
          const list = yield* needs.list;
          // Without the project names, the report names projects by id.
          const shells = yield* projects
            .listShells()
            .pipe(Effect.catchTags({ ProjectStoreV2Error: () => Effect.succeed([]) }));
          return standingOf(list, new Map(shells.map((shell) => [shell.id, shell.title])));
        }),
      ),
    };
  }),
);

/** Needs a `Needs`: `mcpTools.ts` gives it the server's one. */
export const registerStandingTool = (register: typeof toolkitRegistration) =>
  register(StandingToolkit, handlers);
