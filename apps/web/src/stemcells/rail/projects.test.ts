import { describe, expect, it } from "vite-plus/test";

import type { RailChat, RailProject } from "../upstream/rail";
import type { CellStatus } from "../upstream/status";
import { badgeLetters, firstChat, railTiles, standingOf, tileSummary } from "./projects";

const project = (key: string, ...memberKeys: string[]): RailProject => ({
  key,
  name: key,
  record: {
    environmentId: "env" as never,
    workspaceRoot: `/Users/example/${key}`,
    title: key,
    faviconPath: null,
    projectIcon: null,
  } as RailProject["record"],
  mark: { kind: "letters", text: key.slice(0, 2), colorClass: "text-blue-600" },
  memberKeys: memberKeys.length > 0 ? memberKeys : [`env:${key}`],
});

const chat = (
  threadId: string,
  projectKey: string,
  status: CellStatus | null,
  updatedAt: string,
): RailChat => ({
  cell: { environmentId: "env", threadId, draftId: null },
  projectKey,
  status,
  updatedAt,
});

describe("where a chat stands", () => {
  it("needs you while it asks, works while it runs, and is otherwise done", () => {
    expect(standingOf("Pending Approval")).toBe("needsYou");
    expect(standingOf("Awaiting Input")).toBe("needsYou");
    expect(standingOf("Plan Ready")).toBe("needsYou");
    expect(standingOf("Working")).toBe("working");
    expect(standingOf("Connecting")).toBe("working");
    expect(standingOf("Waiting")).toBe("working");
    expect(standingOf("Completed")).toBe("done");
    expect(standingOf("Failed")).toBe("done");
    expect(standingOf(null)).toBe("done");
  });
});

describe("the chat a badge opens", () => {
  it("is the one waiting on you longest, before any working or done", () => {
    const opened = firstChat([
      chat("done", "env:a", null, "2026-10-21T10:05:00Z"),
      chat("working", "env:a", "Working", "2026-10-21T10:04:00Z"),
      chat("asked-late", "env:a", "Awaiting Input", "2026-10-21T10:03:00Z"),
      chat("asked-early", "env:a", "Pending Approval", "2026-10-21T10:01:00Z"),
    ]);
    expect(opened?.cell.threadId).toBe("asked-early");
  });

  it("is the newest working chat when none needs you, then the newest done", () => {
    expect(
      firstChat([
        chat("old", "env:a", "Working", "2026-10-21T10:01:00Z"),
        chat("new", "env:a", "Working", "2026-10-21T10:02:00Z"),
        chat("done", "env:a", null, "2026-10-21T10:09:00Z"),
      ])?.cell.threadId,
    ).toBe("new");
    expect(
      firstChat([
        chat("old", "env:a", "Completed", "2026-10-21T10:01:00Z"),
        chat("new", "env:a", null, "2026-10-21T10:02:00Z"),
      ])?.cell.threadId,
    ).toBe("new");
  });
});

describe("the rail's badges", () => {
  it("are the projects with an open chat, in the projects' order", () => {
    const tiles = railTiles(
      [project("b"), project("empty"), project("a")],
      [
        chat("1", "env:a", null, "2026-10-21T10:00:00Z"),
        chat("2", "env:b", null, "2026-10-21T10:00:00Z"),
      ],
      null,
    );
    expect(tiles.map((tile) => tile.project.key)).toEqual(["b", "a"]);
  });

  it("count every project of a group", () => {
    const [tile] = railTiles(
      [project("repo", "env:local", "remote:clone")],
      [
        chat("1", "env:local", "Working", "2026-10-21T10:00:00Z"),
        chat("2", "remote:clone", "Awaiting Input", "2026-10-21T10:00:00Z"),
      ],
      null,
    );
    expect(tile).toMatchObject({ needsYou: 1, working: 1, done: 0, dot: "needsYou" });
    expect(tile?.first.threadId).toBe("2");
  });

  it("light a dot only while a chat needs you: working and done show none", () => {
    const tiles = railTiles(
      [project("a"), project("b")],
      [
        chat("1", "env:a", "Working", "2026-10-21T10:00:00Z"),
        chat("2", "env:b", "Completed", "2026-10-21T10:00:00Z"),
      ],
      null,
    );
    expect(tiles.map((tile) => tile.dot)).toEqual([null, null]);
  });

  it("leave Aski's chat out: Aski has its own tab", () => {
    const aski = { environmentId: "env", threadId: "aski", draftId: null };
    expect(
      railTiles([project("a")], [chat("aski", "env:a", "Working", "2026-10-21T10:00:00Z")], aski),
    ).toEqual([]);
  });
});

describe("a badge's words", () => {
  it("say what its chats are doing, leaving out what is none", () => {
    expect(tileSummary({ needsYou: 2, working: 1, done: 3 })).toBe(
      "2 need you · 1 working · 3 done",
    );
    expect(tileSummary({ needsYou: 1, working: 0, done: 0 })).toBe("1 needs you");
    expect(tileSummary({ needsYou: 0, working: 0, done: 0 })).toBe("");
  });

  it("show at most three letters, capitalised", () => {
    expect(badgeLetters("sr")).toBe("SR");
    expect(badgeLetters("abcd")).toBe("ABC");
    expect(badgeLetters("é1")).toBe("É1");
  });
});
