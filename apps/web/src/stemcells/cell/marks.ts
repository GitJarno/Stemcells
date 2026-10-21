// The marks a landing raises over its cheer: a `+` when its run added lines
// and a `−` when it removed some (`art/moves/marks.json`). They stand on the
// box, not the body, and rise once from the landing on the sprite clock's
// beat, whatever the cheer is doing; then they are gone.

import { DIFF_MARKS, type Mark } from "./kit.ts";
import { DETAIL, MARGIN, type MiniFrame } from "./scene.ts";
import { type Point, round } from "./sprite.ts";

/** What a landing's run did to the lines of the files it changed. */
export interface Diff {
  readonly added: boolean;
  readonly removed: boolean;
}

/** `rows` with `art` drawn over them, its top-left cell at `at`; what falls off is clipped. */
function over(rows: readonly string[], art: readonly string[], at: Point): readonly string[] {
  return rows.map((row, y) => {
    const line = art[y - at.y];
    if (line === undefined) return row;
    let drawn = "";
    for (let x = 0; x < row.length; x++) {
      const cell = line[x - at.x];
      drawn += cell === undefined || cell === "." ? row[x] : cell;
    }
    return drawn;
  });
}

/**
 * `frame` with `diff`'s marks `beats` after the landing: risen as far as the
 * rise says by then, and gone past its end (`frame` as it was). With no
 * beats (Reduce Motion), they hold at the top.
 */
export function withMarks(frame: MiniFrame, diff: Diff, beats: number | undefined): MiniFrame {
  if (DIFF_MARKS === undefined) return frame;
  const { rise } = DIFF_MARKS;
  const up = beats === undefined ? rise.at(-1) : rise[Math.max(0, beats)];
  const marks: Mark[] = [
    ...(diff.added ? [DIFF_MARKS.added] : []),
    ...(diff.removed ? [DIFF_MARKS.removed] : []),
  ];
  if (up === undefined || marks.length === 0) return frame;
  // Each picture of the frame is a crop: its origin on the hero grid or the miniature's.
  const hero = (rows: readonly string[], origin: Point) =>
    marks.reduce(
      (drawn, mark) =>
        over(drawn, mark.art, { x: mark.at.x - origin.x, y: mark.at.y - up - origin.y }),
      rows,
    );
  const mini = (rows: readonly string[], origin: Point) =>
    marks.reduce(
      (drawn, mark) =>
        over(drawn, mark.mini, {
          x: mark.miniAt.x - origin.x,
          y: mark.miniAt.y - round(up / 2) - origin.y,
        }),
      rows,
    );
  return {
    rows: mini(frame.rows, { x: 0, y: 0 }),
    detail: hero(frame.detail, DETAIL),
    drawn: {
      rows: mini(frame.drawn.rows, { x: -MARGIN.x, y: -MARGIN.y }),
      detail: hero(frame.drawn.detail, {
        x: DETAIL.x - MARGIN.x * 2,
        y: DETAIL.y - MARGIN.y * 2,
      }),
    },
  };
}
