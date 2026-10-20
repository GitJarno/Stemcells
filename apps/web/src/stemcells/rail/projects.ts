/**
 * The rail's projects, as plain data: which get a badge, what the badge's
 * dot says, which chat a click opens, and the words its tooltip reads.
 */
import { moodOfStatus } from "../tabs/cellMood";
import { sameChat, type CellRef } from "../tabs/layout";
import type { RailChat, RailProject } from "../upstream/rail";
import type { CellStatus } from "../upstream/status";

/** Where a chat stands for the person: it needs them, it works, or it's done. */
export type Standing = "needsYou" | "working" | "done";

export function standingOf(status: CellStatus | null): Standing {
  if (moodOfStatus(status) === "needsYou") return "needsYou";
  return status === "Working" || status === "Connecting" || status === "Waiting"
    ? "working"
    : "done";
}

export interface RailTile {
  readonly project: RailProject;
  readonly needsYou: number;
  readonly working: number;
  readonly done: number;
  /** The chat a click opens. */
  readonly first: CellRef;
  /**
   * The dot on the badge, while a chat there needs you. Only what asks for
   * the person shows: a working chat counts in the tooltip, not as a dot.
   */
  readonly dot: "needsYou" | null;
}

const newestFirst = (left: RailChat, right: RailChat) =>
  right.updatedAt.localeCompare(left.updatedAt);

/**
 * The chat a project's badge opens: the one that has waited on you longest,
 * else the newest working, else the newest done.
 */
export function firstChat(chats: ReadonlyArray<RailChat>): RailChat | null {
  const by = (standing: Standing) => chats.filter((chat) => standingOf(chat.status) === standing);
  const waiting = by("needsYou").toSorted(newestFirst);
  return (
    waiting.at(-1) ??
    by("working").toSorted(newestFirst)[0] ??
    by("done").toSorted(newestFirst)[0] ??
    null
  );
}

/**
 * A badge for each project with an open chat, in the projects' order. Aski's
 * chat counts for none: Aski has a tab of its own.
 */
export function railTiles(
  projects: ReadonlyArray<RailProject>,
  chats: ReadonlyArray<RailChat>,
  aski: CellRef | null,
): RailTile[] {
  const counted = aski ? chats.filter((chat) => !sameChat(chat.cell, aski)) : chats;
  return projects.flatMap((project) => {
    const members = new Set(project.memberKeys);
    const own = counted.filter((chat) => members.has(chat.projectKey));
    const first = firstChat(own);
    if (!first) return [];
    const count = (standing: Standing) =>
      own.filter((chat) => standingOf(chat.status) === standing).length;
    const needsYou = count("needsYou");
    const working = count("working");
    return [
      {
        project,
        needsYou,
        working,
        done: count("done"),
        first: first.cell,
        dot: needsYou > 0 ? "needsYou" : null,
      },
    ];
  });
}

/** "2 need you · 1 working · 3 done", leaving out what is none. */
export function tileSummary(tile: Pick<RailTile, "needsYou" | "working" | "done">): string {
  return [
    tile.needsYou > 0 ? `${tile.needsYou} need${tile.needsYou === 1 ? "s" : ""} you` : null,
    tile.working > 0 ? `${tile.working} working` : null,
    tile.done > 0 ? `${tile.done} done` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** The badge's letters: at most three, as typed or derived. */
export function badgeLetters(text: string): string {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text))
    .slice(0, 3)
    .map((part) => part.segment)
    .join("")
    .toLocaleUpperCase();
}
