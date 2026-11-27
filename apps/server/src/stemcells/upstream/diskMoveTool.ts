/**
 * `stemcells_disk_moves` and `stemcells_disk_move`: Settings › Disk's moves for a Cell, so the
 * cleanup Cell can see what a drive with room could hold and move it when the person asks.
 * Built on the one `StemcellsMoves` the page uses: a layer is built once per server, so a move
 * a Cell starts is the page's move, and one runs at a time (stemcells/tasks/disk-move.md).
 */
import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as McpSchema from "effect/ai/McpSchema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import { diskBytes } from "../../../../../stemcells/words/disk.ts";
import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import * as StemcellsDrives from "../disk/StemcellsDrives.ts";
import * as StemcellsMoves from "../disk/StemcellsMoves.ts";
import type { MovableKind } from "../disk/moves.ts";
import { FINDING_TITLES } from "../disk/rules.ts";

const KINDS = ["simulators", "buildData"] as const satisfies ReadonlyArray<MovableKind>;
const Report = Schema.Struct({ report: Schema.String });

const MovesTool = Tool.make("stemcells_disk_moves", {
  description:
    "Where the folders Stemcells can move to another drive live on the machine you run on (Xcode's simulators, Xcode's build data), the drives with room, and any move under way or just ended. Read this before proposing or starting a move.",
  parameters: Tool.EmptyParams,
  success: Report,
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "See what can move to another drive")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenFromOutsideClients);

const MoveTool = Tool.make("stemcells_disk_move", {
  description:
    "Move one of those folders to another drive, or back to this Mac, as Settings › Disk does: only when the person asked. It copies, checks the copy, leaves a link in its place that Xcode and the simulators follow, and deletes the original only once that works; otherwise it undoes itself. It refuses while a simulator is booted or Xcode runs. It starts and returns; read stemcells_disk_moves for progress and the outcome.",
  parameters: Schema.Struct({
    kind: Schema.Literals(KINDS),
    to: Schema.String.check(Schema.isMaxLength(64)).annotate({
      description: `A drive's name or id from stemcells_disk_moves, or "back" to return it to this Mac.`,
    }),
  }),
  success: Report,
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "Move a folder to another drive")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenFromOutsideClients);

const MovesToolkit = Toolkit.make(MovesTool, MoveTool);

const where = (place: StemcellsMoves.MovePlace) => {
  const size = place.bytes === undefined ? "" : `, ${diskBytes(place.bytes)}`;
  if (place.where === "none") return "none on this Mac";
  if (place.where === "here") return `on this Mac${size}`;
  const drive = place.drive;
  return `on ${drive?.name ?? "another drive"}${drive?.connected === false ? " (not connected)" : ""}${size}`;
};

const movesReport = (
  status: StemcellsMoves.MovesStatus,
  drives: ReadonlyArray<StemcellsDrives.Drive>,
) => {
  const lines = status.places.map(
    (place) => `- ${place.kind} (${FINDING_TITLES[place.kind]}): ${where(place)}`,
  );
  const others = drives.filter((drive) => drive.role !== "startup");
  lines.push(
    "",
    others.length === 0
      ? "No other drive is connected."
      : `Drives: ${others.map((drive) => `${drive.name} (id ${drive.id}, ${diskBytes(drive.free)} free)`).join("; ")}`,
  );
  const job = status.job;
  if (job !== null) {
    const copied = job.total > 0 ? ` ${Math.round((job.done / job.total) * 100)}%` : "";
    lines.push(
      `Under way: ${job.kind} ${job.direction} (${job.driveName}), ${job.phase}${copied}.`,
    );
  }
  const last = status.last;
  if (last !== null && job === null) {
    lines.push(
      `Last: ${last.kind} ${last.direction} ${last.ok ? "done" : `failed: ${last.reason ?? "no reason given"}`}.`,
    );
  }
  return lines.join("\n");
};

const failure = (message: string) =>
  new OrchestratorMcpFailure({ code: "orchestration_error", message });

const handlers = McpToolAccess.toLayer(
  MovesToolkit,
  Effect.gen(function* () {
    const moves = yield* StemcellsMoves.StemcellsMoves;
    const drives = yield* StemcellsDrives.StemcellsDrives;
    const report = Effect.all([moves.status(), drives.list()]).pipe(
      Effect.map(([status, list]) => ({ report: movesReport(status, list) })),
    );
    return {
      stemcells_disk_moves: McpToolAccess.readsAsCaller(() => report),
      stemcells_disk_move: McpToolAccess.writesOwnerWork(
        "move folders to another drive",
        ({ kind, to }: { readonly kind: MovableKind; readonly to: string }) =>
          Effect.gen(function* () {
            if (to === "back") {
              yield* moves.moveBack(kind);
            } else {
              const named = (yield* drives.list()).filter(
                (drive) => drive.role !== "startup" && (drive.id === to || drive.name === to),
              );
              if (named.length !== 1)
                return yield* Effect.fail(
                  failure(
                    named.length === 0
                      ? `No connected drive is named ${to}. Read stemcells_disk_moves for the drives.`
                      : `More than one drive is named ${to}: use its id.`,
                  ),
                );
              yield* moves.moveAway({ kind, driveId: named[0]!.id });
            }
            return yield* report;
          }).pipe(Effect.catchTags({ MoveError: (error) => Effect.fail(failure(error.reason)) })),
      ),
    };
  }),
);

/** The tools on whatever moves and drives the caller provides; a test hands in its own. */
export const moveToolsOn = (register: typeof toolkitRegistration) =>
  register(MovesToolkit, handlers);

export const registerMoveTools = (register: typeof toolkitRegistration) =>
  moveToolsOn(register).pipe(
    Layer.provide(StemcellsMoves.layer),
    Layer.provide(StemcellsDrives.layer),
  );
