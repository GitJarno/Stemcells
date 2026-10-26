/**
 * `stemcells_disk_report`: the cleanup Cell's measurement, from the machine it runs on. Every
 * client sends the same ask to any machine, so the walk runs here, not in a client, where
 * only the client on this machine could run it. Registered beside upstream's toolkits, as
 * `peerTool.ts` is.
 */
import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import { diskBytes } from "../../../../../stemcells/words/disk.ts";
import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import * as StemcellsDisk from "../disk/StemcellsDisk.ts";

const DiskReportTool = Tool.make("stemcells_disk_report", {
  description:
    "What Stemcells measured on the disk of the machine you run on: where the space is, and candidates to free with their paths, sizes and risk. Measured within the last 30 minutes, or walked now, which can take a few minutes: until it ends, it answers measured false, and you call it again. Evidence for proposing, never permission to delete.",
  parameters: Tool.EmptyParams,
  success: Schema.Struct({ measured: Schema.Boolean, report: Schema.String }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "Read this machine's disk")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false);

const DiskToolkit = Toolkit.make(DiskReportTool);

const handlers = McpToolAccess.toLayer(
  DiskToolkit,
  Effect.gen(function* () {
    const disk = yield* StemcellsDisk.StemcellsDisk;
    return {
      stemcells_disk_report: McpToolAccess.readsAsCaller(() =>
        disk.report().pipe(
          Effect.map((look) =>
            look.measured
              ? { measured: true, report: look.report }
              : {
                  measured: false,
                  report: `Still measuring: ${diskBytes(look.counted)} counted so far. Call stemcells_disk_report again.`,
                },
          ),
          Effect.mapError(
            (error) =>
              new OrchestratorMcpFailure({ code: "orchestration_error", message: error.message }),
          ),
        ),
      ),
    };
  }),
);

export const registerDiskTool = (register: typeof toolkitRegistration) =>
  register(DiskToolkit, handlers).pipe(Layer.provide(StemcellsDisk.layer));
