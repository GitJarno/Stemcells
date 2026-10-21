// A Subcell in the transcript, where upstream draws a subagent's provider
// logo: a Cell of its own, drawn as a tab draws its Cell (`CellFigure`), at
// the size the composer's line draws one, about the logo's own.
// It is dealt by its name, its thread's id, the deal its tab would get: the
// crew's look while its thread is open in a tab, else the look its name is
// dealt alone, so it wears the same one wherever it shows, reload after
// reload. Its face comes from its status (`subcell.ts`), in its provider's
// colours; upstream's status dot stays on it, as upstream draws it.

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
        points={POINTS_PER_PIXEL}
      />
      {props.dot === undefined ? null : (
        <span
          className={`absolute -right-px -bottom-px size-2 rounded-full ring-2 ring-background ${props.dot}`}
        />
      )}
    </span>
  );
}
