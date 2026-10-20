import { CellFigure } from "../cell/CellFigure";
import { wornPixels } from "../cell/looks";
import looks from "../cell/looks.json" with { type: "json" };
import { useCellStatus } from "../upstream/status";
import { activityOfStatus, moodOfStatus } from "./cellMood";
import type { CellRef } from "./layout";

/** Points a sprite pixel is drawn in a tab or a pane header: small beside a label. */
const POINTS = 1;

/**
 * How many sprite pixels the tallest piece any Cell may wear rises above its
 * body. Every mark keeps that room above its Cell, so bodies line up across
 * tabs and a hat never reaches past the mark's own box.
 */
const HEAD_ROOM = -wornPixels(
  Object.entries(looks.themes).flatMap(([theme, { pieces }]) =>
    Object.keys(pieces).map((piece) => `${theme}/${piece}`),
  ),
).reduce((top, pixel) => Math.min(top, pixel.y), 0);

/**
 * A chat's Cell, small: its look dealt by the chat's thread id (a draft
 * keeps it once sent), its face from the chat's status, the "?" over it
 * while it waits on you. It wears the ink of the text beside it, and its
 * box holds all of it, so centring the box centres the whole Cell.
 */
export function CellMark(props: { cell: CellRef | null }) {
  const status = useCellStatus(props.cell);
  return (
    <span
      className="flex shrink-0"
      style={{ paddingTop: HEAD_ROOM * POINTS }}
      data-stemcells-cell-status={status ?? "idle"}
    >
      <CellFigure
        name={props.cell?.threadId ?? ""}
        mood={moodOfStatus(status)}
        activity={activityOfStatus(status)}
        hue="currentColor"
        points={POINTS}
      />
    </span>
  );
}
