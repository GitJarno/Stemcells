// When two Cells step on each other (stemcells/tasks/peers.md, decision 3):
// both edited one file within the window, in any checkout of the repository,
// or both edited in one checkout. Said once, when it starts; a pair is told
// again only after it has been apart for a whole window. A Cell's next file
// in a collision already said is not news.

import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import { titleOf } from "./frame.ts";

/** How long an edit keeps a Cell in its file, and how long a pair must be apart to be told again. */
export const WINDOW_MS = 30 * 60_000;

/** Files a notice names before "and N more". */
const FILES_NAMED = 3;

/** One finished edit, owned by the Cell whose work it is (a Subcell's top Cell). */
export interface Edit {
  readonly cell: string;
  /** Its repository's key: projects of one repository share their Cells' files. */
  readonly repo: string;
  /** The working tree the edit landed in. */
  readonly checkout: string;
  /** Relative to the checkout when inside it, so one file matches across worktrees. */
  readonly file: string;
  readonly at: number;
}

export interface Collision {
  readonly kind: "file" | "checkout";
  /** The Cell whose edit started it, then the other. */
  readonly cells: readonly [string, string];
  /** The files both edited in the window, sorted; none for a checkout they only share. */
  readonly files: ReadonlyArray<string>;
}

interface Presence {
  repo: string;
  checkout: string;
  readonly files: Map<string, number>;
}

/** What the room remembers: each Cell's recent edits, and when each pair last overlapped. */
export interface Room {
  readonly cells: Map<string, Presence>;
  readonly met: Map<string, number>;
}

export const makeRoom = (): Room => ({ cells: new Map(), met: new Map() });

const pairOf = (a: string, b: string) => (a < b ? `${a}\n${b}` : `${b}\n${a}`);

function forget(room: Room, now: number) {
  for (const [cell, presence] of room.cells) {
    for (const [file, at] of presence.files) if (now - at > WINDOW_MS) presence.files.delete(file);
    if (presence.files.size === 0) room.cells.delete(cell);
  }
  for (const [pair, at] of room.met) if (now - at > WINDOW_MS) room.met.delete(pair);
}

/** Takes in an edit; returns the collisions it starts. */
export function noteEdit(room: Room, edit: Edit): Collision[] {
  forget(room, edit.at);
  const mine = room.cells.get(edit.cell) ?? {
    repo: edit.repo,
    checkout: edit.checkout,
    files: new Map<string, number>(),
  };
  // A Cell handed off to a worktree edits there from now on.
  mine.repo = edit.repo;
  mine.checkout = edit.checkout;
  mine.files.set(edit.file, edit.at);
  room.cells.set(edit.cell, mine);

  const started: Collision[] = [];
  for (const [other, theirs] of room.cells) {
    if (other === edit.cell || theirs.repo !== edit.repo) continue;
    const sameCheckout = theirs.checkout === mine.checkout;
    const files = [...mine.files.keys()].filter((file) => theirs.files.has(file)).toSorted();
    if (!sameCheckout && files.length === 0) continue;
    const pair = pairOf(edit.cell, other);
    const together = room.met.has(pair);
    room.met.set(pair, edit.at);
    if (together) continue;
    started.push({ kind: sameCheckout ? "checkout" : "file", cells: [edit.cell, other], files });
  }
  return started;
}

/** The other Cell, as a notice names it. */
export interface OtherCell {
  readonly id: string;
  readonly title: string;
  readonly branch: string | null;
}

function fileList(files: ReadonlyArray<string>): string {
  const named = files.slice(0, FILES_NAMED).join(", ");
  const more = files.length - FILES_NAMED;
  return more > 0 ? `${named} and ${more} more` : named;
}

/**
 * What a Cell in a collision reads, and its chat shows: the first line is
 * the notice, the rest tells the model what it is and what to do. `also`
 * are the other Cells the same edit ran into, told in the same notice.
 */
export function noticeText(
  collision: Collision,
  other: OtherCell,
  also: ReadonlyArray<OtherCell> = [],
): string {
  const name = cellNameOf(other.id);
  const who = `${name}, the Cell “${titleOf(other.title)}” (thread ${other.id}${
    other.branch === null ? "" : `, branch ${titleOf(other.branch)}`
  })`;
  const files = fileList(collision.files);
  const more =
    also.length === 0
      ? []
      : [
          `The same goes for ${also.map((cell) => `${cellNameOf(cell.id)} (thread ${cell.id})`).join(", ")}.`,
        ];
  if (collision.kind === "file") {
    return [
      `⚠ Same file as ${name}: ${files}`,
      `Stemcells saw this, not the person: ${who} also edited ${files} in the last 30 minutes, in another checkout of this repository. ` +
        `Agree who lands it first before either of you commits: ask ${name} with t3_thread_send, or rebase onto its work once it lands.`,
      ...more,
    ].join("\n");
  }
  return [
    `⚠ Same checkout as ${name}${files === "" ? "" : `: ${files}`}`,
    `Stemcells saw this, not the person: ${who} is also editing in this working tree${
      files === "" ? "" : `, ${files} among its files`
    }. You share its index, branch and uncommitted changes: don't stash, reset, switch branches or commit its work. ` +
      `Agree with ${name} who goes first (t3_thread_send), or move to a worktree of your own (t3_worktree_handoff).`,
    ...more,
  ].join("\n");
}
