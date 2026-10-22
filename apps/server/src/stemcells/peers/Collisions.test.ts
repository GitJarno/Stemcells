import { assert, it } from "@effect/vitest";
import type { OrchestrationV2ServerCommand } from "@t3tools/contracts";
import { ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import type { CollisionsSource, FinishedEdit, Shell } from "../upstream/collisions.ts";
import { noticeMessageId } from "../upstream/collisions.ts";
import { fileIn, follow } from "./Collisions.ts";

const MIN = 60_000;
// Two projects of one repository (its checkout, and a worktree added as a project), and another.
const PROJECTS: Record<string, { readonly root: string; readonly repo: string }> = {
  "project-1": { root: "/repo", repo: "github.com/example/app" },
  "project-2": { root: "/repo-wt", repo: "github.com/example/app" },
  "project-3": { root: "/other", repo: "github.com/example/other" },
};

const shell = (
  id: string,
  status: Shell["status"],
  worktreePath: string | null,
  parent: string | null = null,
  projectId = "project-1",
): Shell =>
  ({
    id: ThreadId.make(id),
    projectId,
    title: `Work of ${id}`,
    branch: `branch/${id}`,
    worktreePath,
    status,
    archivedAt: null,
    deletedAt: null,
    lineage: {
      parentThreadId: parent === null ? null : ThreadId.make(parent),
      relationshipToParent: parent === null ? null : "subagent",
      rootThreadId: ThreadId.make(parent ?? id),
    },
  }) as unknown as Shell;

const run = (shells: ReadonlyArray<Shell>, edits: ReadonlyArray<FinishedEdit>) =>
  Effect.gen(function* () {
    const sent = yield* Ref.make<ReadonlyArray<OrchestrationV2ServerCommand>>([]);
    const ids = yield* Ref.make(0);
    const byId = new Map(shells.map((one) => [one.id as string, one]));
    const source: CollisionsSource = {
      ready: Effect.void,
      sequence: Effect.succeed(0),
      edits: () => Stream.fromIterable(edits),
      shell: (threadId) => Effect.succeed(byId.get(threadId) ?? null),
      project: (projectId) => Effect.succeed(PROJECTS[projectId] ?? null),
      newId: Ref.updateAndGet(ids, (n) => n + 1).pipe(Effect.map(String)),
      send: (command) => Ref.update(sent, (all) => [...all, command]).pipe(Effect.as(true)),
    };
    yield* follow(source);
    return (yield* Ref.get(sent)).map((command) =>
      command.type === "message.dispatch"
        ? {
            to: command.threadId,
            line: command.text.split("\n")[0],
            mode: command.dispatchMode?.type,
            by: `${command.createdBy}/${command.creationSource}`,
          }
        : command,
    );
  });

const edit = (threadId: string, fileName: string, at: number): FinishedEdit => ({
  threadId: ThreadId.make(threadId),
  fileName,
  at,
});

it.effect("tells each Cell at work in a new collision, queued behind its turn, as the app", () =>
  Effect.gen(function* () {
    const sent = yield* run(
      [shell("otter", "running", "/work/otter"), shell("badger", "running", "/work/badger")],
      [
        edit("otter", "/work/otter/src/a.ts", 0),
        edit("badger", "/work/badger/src/a.ts", MIN),
        edit("badger", "/work/badger/src/a.ts", 2 * MIN),
      ],
    );
    assert.deepEqual(sent, [
      {
        to: ThreadId.make("badger"),
        line: `⚠ Same file as ${cellNameOf("otter")}: src/a.ts`,
        mode: "queue_after_active",
        by: "agent/server",
      },
      {
        to: ThreadId.make("otter"),
        line: `⚠ Same file as ${cellNameOf("badger")}: src/a.ts`,
        mode: "queue_after_active",
        by: "agent/server",
      },
    ]);
  }),
);

it.effect("leaves a Cell at rest alone, and counts a Subcell's edit as its top Cell's", () =>
  Effect.gen(function* () {
    const sent = yield* run(
      [
        shell("otter", "running", "/work/otter"),
        shell("badger", "idle", null),
        shell("badger-sub", "running", null, "badger"),
      ],
      [edit("otter", "/work/otter/src/a.ts", 0), edit("badger-sub", "src/a.ts", MIN)],
    );
    // The Subcell at work hears of Otter; Otter hears of Badger, whose work it is; Badger rests.
    assert.deepEqual(
      sent.map((one) => ("to" in one ? [one.to, one.line] : one)),
      [
        ["badger-sub", `⚠ Same file as ${cellNameOf("otter")}: src/a.ts`],
        ["otter", `⚠ Same file as ${cellNameOf("badger")}: src/a.ts`],
      ],
    );
  }),
);

it.effect("tells the editor once per edit, however many Cells it ran into", () =>
  Effect.gen(function* () {
    const sent = yield* run(
      [
        shell("otter", "running", null),
        shell("badger", "running", null),
        shell("puma", "running", "/work/puma"),
      ],
      [
        edit("otter", "src/a.ts", 0),
        edit("puma", "/work/puma/src/b.ts", MIN),
        edit("puma", "/work/puma/src/a.ts", 2 * MIN),
        edit("badger", "src/a.ts", 3 * MIN),
      ],
    );
    const toBadger = sent.filter((one) => "to" in one && one.to === "badger");
    // One notice, led by the shared checkout, naming Puma too.
    assert.equal(toBadger.length, 1);
    assert.deepEqual(
      sent.map((one) => ("to" in one ? [one.to, one.line] : one)),
      [
        ["puma", `⚠ Same file as ${cellNameOf("otter")}: src/a.ts`],
        ["otter", `⚠ Same file as ${cellNameOf("puma")}: src/a.ts`],
        ["badger", `⚠ Same checkout as ${cellNameOf("otter")}: src/a.ts`],
        ["otter", `⚠ Same checkout as ${cellNameOf("badger")}: src/a.ts`],
        ["puma", `⚠ Same file as ${cellNameOf("badger")}: src/a.ts`],
      ],
    );
  }),
);

it.effect("tells a Subcell's Cell at work, not the Subcell, which a notice would run again", () =>
  Effect.gen(function* () {
    const sent = yield* run(
      [
        shell("otter", "running", null),
        shell("badger", "running", null),
        shell("badger-sub", "running", "/work/badger-sub", "badger"),
      ],
      [edit("otter", "src/a.ts", 0), edit("badger-sub", "/work/badger-sub/src/a.ts", MIN)],
    );
    assert.deepEqual(
      sent.map((one) => ("to" in one ? (one.to as string) : one)),
      ["badger", "otter"],
    );
  }),
);

it.effect("pairs Cells across the projects of one repository, and no further", () =>
  Effect.gen(function* () {
    const sent = yield* run(
      [
        shell("otter", "running", null),
        shell("badger", "running", null, null, "project-2"),
        shell("puma", "running", null, null, "project-3"),
      ],
      [
        edit("otter", "src/a.ts", 0),
        edit("badger", "src/a.ts", MIN),
        edit("puma", "src/a.ts", 2 * MIN),
      ],
    );
    assert.deepEqual(
      sent.map((one) => ("to" in one ? (one.to as string) : one)),
      ["badger", "otter"],
    );
  }),
);

it.effect("never pairs a Cell with its own Subcell, even in one checkout", () =>
  Effect.gen(function* () {
    const sent = yield* run(
      [shell("otter", "running", null), shell("otter-sub", "running", null, "otter")],
      [edit("otter", "src/a.ts", 0), edit("otter-sub", "src/a.ts", MIN)],
    );
    assert.deepEqual(sent, []);
  }),
);

it("keys a file by its place in the checkout, whatever the provider wrote", () => {
  assert.equal(fileIn("/work/otter/src/a.ts", "/work/otter/"), "src/a.ts");
  assert.equal(fileIn("./src/a.ts", "/work/otter"), "src/a.ts");
  assert.equal(fileIn("C:\\work\\otter\\src\\a.ts", "C:\\work\\otter"), "src/a.ts");
  assert.equal(fileIn("/elsewhere/a.ts", "/work/otter"), "/elsewhere/a.ts");
});

it("names a notice by its kind and the other Cell, as the web reads it", () => {
  // apps/web/src/stemcells/peers/notice.test.ts reads this same id.
  assert.equal(
    noticeMessageId("file", "thread:badger", "nonce-1"),
    "stemcells-collision:file:thread%3Abadger:nonce-1",
  );
});
