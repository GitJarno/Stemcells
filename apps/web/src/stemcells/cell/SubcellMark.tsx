// A Subcell in the transcript, where upstream draws a subagent's provider logo: a Cell of its
// own, its face from its status (`subcell.ts`). It is dealt by its thread's id as its tab would
// be (the crew's look while open in a tab, else its name's alone), so it wears one look
// everywhere, reload after reload. Upstream's status dot stays, except on a bud (`CellBuds`).

import { useCellGround } from "../upstream/appearance";
import { useRosterLook } from "../tabs/roster";
import { CellFigure } from "./CellFigure";
import { POINTS_PER_PIXEL } from "./look";
import { subcellFace } from "./subcell";

export function SubcellMark(props: {
  /** The Subcell's thread id; its subagent id while it has no thread. */
  readonly name: string;
  readonly provider?: string | null | undefined;
  readonly status?: string | undefined;
  /** Upstream's status dot, its colour's classes; none draws no dot. */
  readonly dot?: string | undefined;
  /** CSS pixels a cell of its miniature is drawn; the composer's line's Cell's unless told. */
  readonly points?: number | undefined;
}) {
  const ground = useCellGround();
  const look = useRosterLook(props.name);
  const { mood, activity } = subcellFace(props.status);
  return (
    <span className="relative inline-flex shrink-0" data-stemcells-subcell={props.name} aria-hidden>
      <CellFigure
        name={props.name}
        look={look}
        provider={props.provider}
        ground={ground}
        mood={mood}
        activity={activity}
        points={props.points ?? POINTS_PER_PIXEL}
      />
      {props.dot === undefined ? null : (
        <span
          className={`absolute -right-px -bottom-px size-2 rounded-full ring-2 ring-background ${props.dot}`}
        />
      )}
    </span>
  );
}
