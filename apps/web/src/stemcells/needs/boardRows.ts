/**
 * Aski's room as a board (stemcells/tasks/aski-board.md): every Cell in reach by stage, each
 * landing with how it landed and what shows it, so "how is it going" is read at a glance and
 * never asked. From the needs list's `cells`. Pure.
 */
import { barOf, changedWords, factsOf, type BarCell, type Fact } from "./facts";
import type { CellStanding, Landing } from "./wire";

type Verdict = Landing["verdict"];

export interface BoardRow {
  readonly threadId: string;
  readonly projectId: string;
  readonly title: string;
  /** When its stage began; null from a server before it said. */
  readonly since: string | null;
  /** Its own word: what it delivered, or what it waits on. */
  readonly line: string | null;
  /** How it landed; null while it flies, or from a server before verdicts. */
  readonly verdict: Verdict | null;
  /** Why it landed so, when no fact below already says it. */
  readonly why: string | null;
  readonly changed: { readonly bar: ReadonlyArray<BarCell>; readonly words: string } | null;
  readonly facts: ReadonlyArray<Fact>;
}

interface Board {
  readonly flying: ReadonlyArray<BoardRow>;
  readonly landed: ReadonlyArray<BoardRow>;
  /** How many Cells of each stage the board holds, shown or not. */
  readonly counts: { readonly flying: number; readonly landed: number };
}

/** A landing's mark and its name, as the board and a Cell's hover card say them. */
export const VERDICTS: Readonly<Record<Verdict, { readonly mark: string; readonly name: string }>> =
  {
    shown: { mark: "✓", name: "Shown" },
    claimed: { mark: "~", name: "Its word" },
    short: { mark: "!", name: "Short" },
  };

/** What a landing stands on, in words, where the facts drawn beside it don't already say so. */
const WHY: Readonly<Partial<Record<Landing["proof"], string>>> = {
  stopped: "Stopped before it finished",
  "rolled-back": "Rolled back",
  failed: "Its run failed",
  word: "Nothing it ran or opened shows it",
};

/** A short landing is read first, then one on its word alone; a shown one can wait. */
const RANK: Readonly<Record<Verdict, number>> = { short: 0, claimed: 1, shown: 2 };

/** The most rows a stage shows in the room: past it the column has them all. */
const BOARD_ROWS = 6;

function rowOf(cell: CellStanding): BoardRow {
  const landing = cell.landing ?? null;
  const brief = cell.brief ?? null;
  return {
    threadId: cell.threadId,
    projectId: cell.projectId,
    title: cell.title,
    since: cell.since ?? null,
    line: cell.line,
    verdict: landing?.verdict ?? null,
    why: landing === null ? null : (WHY[landing.proof] ?? null),
    changed:
      brief?.changed == null
        ? null
        : { bar: barOf(brief.changed), words: changedWords(brief.changed) },
    facts: factsOf(brief),
  };
}

/** The server lists the newest Cell first; a stable sort keeps that inside each verdict. */
export function boardOf(cells: ReadonlyArray<CellStanding>, rows = BOARD_ROWS): Board {
  const flying = cells.filter((cell) => cell.stage === "working").map(rowOf);
  const landed = cells
    .filter((cell) => cell.stage === "done")
    .map(rowOf)
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        (a.row.verdict === null ? 3 : RANK[a.row.verdict]) -
          (b.row.verdict === null ? 3 : RANK[b.row.verdict]) || a.index - b.index,
    )
    .map(({ row }) => row);
  return {
    flying: flying.slice(0, rows),
    landed: landed.slice(0, rows),
    counts: { flying: flying.length, landed: landed.length },
  };
}
