import { CellFigure } from "../cell/CellFigure";
import { useCellDriver } from "../upstream/providers";
import { useCellStatus } from "../upstream/status";
import { activityOfStatus, moodOfStatus } from "./cellMood";
import type { CellRef } from "./layout";

/** Points a sprite pixel is drawn in a tab or a pane header: small beside a label. */
const POINTS = 1;

/**
 * A chat's Cell, small: its look dealt by the chat's thread id (a draft
 * keeps it once sent), its face from the chat's status, the "?" over it
 * while it waits on you, in its provider's colours. Its box holds all of
 * it, hats too, so centring the box centres the whole Cell. Drawn `points`
 * a sprite pixel; small beside a label unless told.
 */
export function CellMark(props: { cell: CellRef | null; points?: number }) {
  const status = useCellStatus(props.cell);
  const provider = useCellDriver(props.cell);
  return (
    <span className="flex shrink-0" data-stemcells-cell-status={status ?? "idle"}>
      <CellFigure
        name={props.cell?.threadId ?? ""}
        mood={moodOfStatus(status)}
        activity={activityOfStatus(status)}
        provider={provider}
        points={props.points ?? POINTS}
      />
    </span>
  );
}
