import { CellFigure } from "../cell/CellFigure";
import { useCellStatus } from "../upstream/status";
import { activityOfStatus, moodOfStatus } from "./cellMood";
import type { CellRef } from "./layout";

/**
 * A chat's Cell, small: its look dealt by the chat's thread id (a draft
 * keeps it once sent), its face from the chat's status, the "?" over it
 * while it waits on you. It wears the ink of the text beside it.
 */
export function CellMark(props: { cell: CellRef | null }) {
  const status = useCellStatus(props.cell);
  return (
    <span className="flex shrink-0 items-center" data-stemcells-cell-status={status ?? "idle"}>
      <CellFigure
        name={props.cell?.threadId ?? ""}
        mood={moodOfStatus(status)}
        activity={activityOfStatus(status)}
        hue="currentColor"
      />
    </span>
  );
}
