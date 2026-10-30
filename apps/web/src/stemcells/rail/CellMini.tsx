import { useState } from "react";

import { CellStill } from "../cell/CellStill";
import { dayOf, lookOf } from "../cell/looks";
import { useRosterLook } from "../tabs/roster";
import { useCellGround } from "../upstream/appearance";
import { useCellDriver } from "../upstream/providers";

/**
 * A Cell held still and small, as a stage's row shows a few and a hop
 * carries one: painted once, with no clock, so a row of them costs no frame.
 * It wears what its tab deals it while a tab shows it, else what it is dealt
 * alone, as everywhere else.
 */
export function CellMini(props: { environmentId: string; threadId: string; points?: number }) {
  const cell = { environmentId: props.environmentId, threadId: props.threadId, draftId: null };
  const provider = useCellDriver(cell);
  const ground = useCellGround();
  const [day] = useState(() => dayOf(new Date()));
  const look = useRosterLook(props.threadId) ?? lookOf(props.threadId, day);
  return (
    <CellStill
      name={props.threadId}
      look={look}
      provider={provider}
      points={props.points ?? 1}
      ground={ground}
    />
  );
}
