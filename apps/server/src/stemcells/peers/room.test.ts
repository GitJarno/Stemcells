import { describe, expect, it } from "vite-plus/test";

import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import { type Edit, makeRoom, noteEdit, noticeText, WINDOW_MS } from "./room.ts";

const MIN = 60_000;
const edit = (cell: string, file: string, at: number, overrides: Partial<Edit> = {}): Edit => ({
  cell,
  repo: "github.com/example/app",
  checkout: `/work/${cell}`,
  file,
  at,
  ...overrides,
});

describe("two Cells stepping on each other", () => {
  it("is a same-file collision once both edited one file within the window, in any worktree", () => {
    const room = makeRoom();
    expect(noteEdit(room, edit("otter", "src/a.ts", 0))).toEqual([]);
    expect(noteEdit(room, edit("badger", "src/b.ts", 5 * MIN))).toEqual([]);
    expect(noteEdit(room, edit("badger", "src/a.ts", 10 * MIN))).toEqual([
      { kind: "file", cells: ["badger", "otter"], files: ["src/a.ts"] },
    ]);
  });

  it("says it once while they stay together: the next shared file is not news", () => {
    const room = makeRoom();
    noteEdit(room, edit("otter", "src/a.ts", 0));
    noteEdit(room, edit("otter", "src/b.ts", 0));
    expect(noteEdit(room, edit("badger", "src/a.ts", MIN))).toHaveLength(1);
    expect(noteEdit(room, edit("badger", "src/b.ts", 2 * MIN))).toEqual([]);
    expect(noteEdit(room, edit("otter", "src/a.ts", 3 * MIN))).toEqual([]);
  });

  it("says it again only after the pair has been apart for a whole window", () => {
    const room = makeRoom();
    noteEdit(room, edit("otter", "src/a.ts", 0));
    noteEdit(room, edit("badger", "src/a.ts", MIN));
    // Still together 29 minutes after they last met.
    expect(noteEdit(room, edit("otter", "src/a.ts", 30 * MIN))).toEqual([]);
    const later = 30 * MIN + WINDOW_MS + 1;
    noteEdit(room, edit("otter", "src/a.ts", later));
    expect(noteEdit(room, edit("badger", "src/a.ts", later + MIN))).toEqual([
      { kind: "file", cells: ["badger", "otter"], files: ["src/a.ts"] },
    ]);
  });

  it("forgets an edit older than the window", () => {
    const room = makeRoom();
    noteEdit(room, edit("otter", "src/a.ts", 0));
    expect(noteEdit(room, edit("badger", "src/a.ts", WINDOW_MS + 1))).toEqual([]);
  });

  it("is a same-checkout collision when both edit in one working tree, shared files or not", () => {
    const room = makeRoom();
    noteEdit(room, edit("otter", "src/a.ts", 0, { checkout: "/repo" }));
    expect(noteEdit(room, edit("badger", "src/b.ts", MIN, { checkout: "/repo" }))).toEqual([
      { kind: "checkout", cells: ["badger", "otter"], files: [] },
    ]);
  });

  it("keeps repositories apart", () => {
    const room = makeRoom();
    noteEdit(room, edit("otter", "src/a.ts", 0));
    expect(
      noteEdit(room, edit("badger", "src/a.ts", MIN, { repo: "github.com/example/other" })),
    ).toEqual([]);
  });

  it("follows a Cell into the worktree it handed off to", () => {
    const room = makeRoom();
    noteEdit(room, edit("otter", "src/a.ts", 0, { checkout: "/repo" }));
    noteEdit(room, edit("otter", "src/b.ts", MIN, { checkout: "/work/otter" }));
    expect(noteEdit(room, edit("badger", "src/c.ts", 2 * MIN, { checkout: "/repo" }))).toEqual([]);
  });
});

describe("what a Cell in a collision reads", () => {
  // Another agent may set a title or a branch: their line breaks and hidden characters never reach the notice.
  const badger = {
    id: "thread-badger",
    title: "Schema\nwork\u202E",
    branch: "stemcells/schema\u2028",
  };
  const name = cellNameOf(badger.id);

  it("leads with the notice, names the other Cell, and says what to do", () => {
    const text = noticeText(
      {
        kind: "file",
        cells: ["otter", badger.id],
        files: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"],
      },
      badger,
    );
    expect(text.split("\n")[0]).toBe(`⚠ Same file as ${name}: a.ts, b.ts, c.ts and 2 more`);
    expect(text).toContain(
      `${name}, the Cell “Schema work” (thread thread-badger, branch stemcells/schema) also edited`,
    );
    expect(text).toContain("not the person");
    expect(text).toContain(`ask ${name} with t3_thread_send`);
  });

  it("warns a shared checkout off the moves that would take the other's work", () => {
    const text = noticeText(
      { kind: "checkout", cells: ["otter", badger.id], files: [] },
      { ...badger, branch: null },
    );
    expect(text.split("\n")[0]).toBe(`⚠ Same checkout as ${name}`);
    expect(text).toContain("(thread thread-badger) is also editing in this working tree.");
    expect(text).toContain("don't stash, reset, switch branches or commit its work");
  });

  it("names the other Cells the same edit ran into, in the same notice", () => {
    const puma = { id: "thread-puma", title: "Docs", branch: null };
    const text = noticeText(
      { kind: "file", cells: ["otter", badger.id], files: ["a.ts"] },
      badger,
      [puma],
    );
    expect(text.split("\n").at(-1)).toBe(
      `The same goes for ${cellNameOf(puma.id)} (thread thread-puma).`,
    );
  });
});
