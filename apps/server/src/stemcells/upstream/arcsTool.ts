/**
 * `stemcells_arcs`: how the person's work with Cells is going, week by week
 * (`arcs/arcs.ts`), worked out from T3's records when asked, so Aski answers
 * "how am I doing?" with the numbers. Read only. Registered beside
 * upstream's toolkits, as `standingTool.ts` is.
 */
import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as SqlClient from "effect/sql/SqlClient";

import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import { weekOf, weeksOf } from "../arcs/arcs.ts";
import { arcsReport } from "../arcs/report.ts";
import { readArcRecords } from "./arcs.ts";

const WEEKS = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const ArcsTool = Tool.make("stemcells_arcs", {
  description:
    "How the person's work with Cells is going, this week against the last: Cells run, the person's turns per Cell, minutes of work between their turns, asks on a card against asks in prose, minutes to answer. report says it in three lines; weeks has the last eight, oldest first. Read only.",
  parameters: Tool.EmptyParams,
  success: Schema.Struct({
    report: Schema.String,
    weeks: Schema.Array(
      Schema.Struct({
        week: Schema.String,
        cells: Schema.Number,
        yourTurns: Schema.Number,
        turnsPerCell: Schema.NullOr(Schema.Number),
        flightMinutes: Schema.NullOr(Schema.Number),
        stops: Schema.Record(Schema.String, Schema.Number),
        asksThroughTool: Schema.Number,
        permissions: Schema.Number,
        answerMinutes: Schema.NullOr(Schema.Number),
      }),
    ),
  }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "Read how the work with Cells is going")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false);

export const ArcsToolkit = Toolkit.make(ArcsTool);

const handlers = McpToolAccess.toLayer(
  ArcsToolkit,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return {
      stemcells_arcs: McpToolAccess.readsAsCaller(() =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const from = Date.parse(weekOf(now - (WEEKS - 1) * WEEK_MS));
          const records = yield* readArcRecords(DateTime.formatIso(DateTime.makeUnsafe(from)));
          const weeks = weeksOf(records, from, now);
          return { report: arcsReport(weeks), weeks };
        }).pipe(
          Effect.provideService(SqlClient.SqlClient, sql),
          Effect.catchTags({
            SqlError: () =>
              Effect.fail(
                new OrchestratorMcpFailure({
                  code: "orchestration_error",
                  message: "Could not read the Cells' records.",
                }),
              ),
          }),
        ),
      ),
    };
  }),
);

export const registerArcsTool = (register: typeof toolkitRegistration) =>
  register(ArcsToolkit, handlers);
