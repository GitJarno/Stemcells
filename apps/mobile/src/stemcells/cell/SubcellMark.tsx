// A Subcell where upstream draws a subagent's provider logo, as the Mac draws it
// (`apps/web/src/stemcells/cell/SubcellMark.tsx`): a Cell of its own, dealt by its name, its
// face from its status, in its provider's colours. Held still: a card shows several at once.

import { useThemeAppearance } from "../upstream/cells";
import { CellFigure } from "./CellFigure";
import { subcellFace } from "./kit";
import { useSubcellLook } from "./roster";

export function SubcellMark(props: {
  /** The Subcell's thread id; its subagent id while it has no thread. */
  readonly name: string;
  readonly provider?: string | null | undefined;
  readonly status?: string | undefined;
}) {
  const look = useSubcellLook(props.name);
  const ground = useThemeAppearance() === "light" ? "light" : "black";
  const { mood, activity } = subcellFace(props.status);
  return (
    <CellFigure
      name={props.name}
      look={look}
      provider={props.provider}
      ground={ground}
      mood={mood}
      activity={activity}
      held
    />
  );
}
