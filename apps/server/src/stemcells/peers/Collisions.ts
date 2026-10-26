import type { ThreadId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as Upstream from "../upstream/collisions.ts";
import { type Collision, makeRoom, noteEdit, noticeText } from "./room.ts";

// Tells Cells when they step on each other (stemcells/tasks/peers.md, decision 3): from each
// finished edit, queues a notice for each Cell in a new collision with a run under way. A Cell
// at rest isn't woken: a turn spent on news it can't use costs more than it saves. The room
// lives in memory; after a restart it knows only the edits since.

/** A shell's run is under way: the notice queues behind it. */
const UNDER_WAY: ReadonlySet<Upstream.Shell["status"]> = new Set([
  "preparing",
  "queued",
  "starting",
  "running",
  "waiting",
]);

/** How far up a Subcell's parents its work is followed to its top Cell. */
const MAX_DEPTH = 8;
const RESTART_AFTER = Duration.seconds(5);

/** A path as the room keys it: relative to the checkout when inside it. */
export function fileIn(fileName: string, checkout: string): string {
  const file = fileName.replaceAll("\\", "/");
  const root = checkout.replaceAll("\\", "/").replace(/\/+$/, "");
  if (file.startsWith(`${root}/`)) return file.slice(root.length + 1);
  return file.replace(/^\.\//, "");
}

export const follow = Effect.fn("Stemcells.collisions.follow")(function* (
  source: Upstream.CollisionsSource,
) {
  const room = makeRoom();

  /** The Cell whose work a thread's edit is: a Subcell's top Cell, else the thread. */
  const ownerOf = Effect.fn("Stemcells.collisions.ownerOf")(function* (shell: Upstream.Shell) {
    let current = shell;
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const parentId = current.lineage.parentThreadId;
      if (current.lineage.relationshipToParent !== "subagent" || parentId === null) break;
      const parent = yield* source.shell(parentId);
      if (parent === null) break;
      current = parent;
    }
    return current;
  });

  const tell = Effect.fn("Stemcells.collisions.tell")(function* (
    to: Upstream.Shell | null,
    other: Upstream.Shell,
    collision: Collision,
    also: ReadonlyArray<Upstream.Shell> = [],
  ) {
    if (to === null || to.archivedAt !== null || to.deletedAt !== null) return;
    if (!UNDER_WAY.has(to.status)) return;
    const text = noticeText(collision, other, also);
    yield* source.send(
      Upstream.noticeCommand({
        threadId: to.id,
        kind: collision.kind,
        otherThreadId: other.id,
        text,
        nonce: yield* source.newId,
      }),
    );
  });

  const take = Effect.fn("Stemcells.collisions.take")(function* (edit: Upstream.FinishedEdit) {
    const editor = yield* source.shell(edit.threadId);
    if (editor === null) return;
    const project = yield* source.project(editor.projectId);
    if (project === null) return;
    const checkout = editor.worktreePath ?? project.root;
    const cell = yield* ownerOf(editor);
    const collisions = noteEdit(room, {
      cell: cell.id,
      repo: project.repo,
      checkout,
      file: fileIn(edit.fileName, checkout),
      at: edit.at,
    });
    const met: Array<{ readonly other: Upstream.Shell; readonly collision: Collision }> = [];
    for (const collision of collisions) {
      const other = yield* source.shell(collision.cells[1] as ThreadId);
      if (other !== null) met.push({ other, collision });
    }
    // The Cell whose work it is hears, while it's under way; else the Subcell
    // at work, since a notice queued on a Subcell runs it again and wakes its
    // parent. It hears once per edit however many Cells it ran into: each
    // notice costs a turn. A shared checkout, the riskier, leads.
    const listener = UNDER_WAY.has(cell.status) ? cell : editor;
    met.sort(
      (a, b) => Number(b.collision.kind === "checkout") - Number(a.collision.kind === "checkout"),
    );
    const [first, ...rest] = met;
    if (first !== undefined)
      yield* tell(
        listener,
        first.other,
        first.collision,
        rest.map((one) => one.other),
      );
    for (const { other, collision } of met) yield* tell(other, cell, collision);
  });

  yield* source.ready;
  yield* source.edits(yield* source.sequence).pipe(Stream.runForEach(take));
});

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const source = yield* Upstream.makeCollisionsSource;
    yield* follow(source).pipe(
      Effect.catchCauseIf(
        (cause) => !Cause.hasInterruptsOnly(cause),
        (cause) => Effect.logWarning("Collisions stopped; they start again from now", cause),
      ),
      Effect.andThen(Effect.sleep(RESTART_AFTER)),
      Effect.forever,
      Effect.forkScoped,
    );
  }),
);
