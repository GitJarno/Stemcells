// Where the stages' pill stands (stemcells/tasks/awake-asleep.md): on a candybar phone under the
// header with the sky behind it, going up with the title; elsewhere (the folded Duo, a sidebar, a
// tablet) at the home's foot, level with the rail's lowest group or over the search, riding the
// keyboard (`StagePill.tsx`), so a slept Cell leaps down into it.

import { useUprightPhone } from "../upstream/home";
import { PILL_ROOM, STAGE_ROOM } from "./state";

export function usePillOnTop(): boolean {
  return useUprightPhone() === "phone";
}

/** The room over each stage's first row, under the header: the pill's too when it stands there. */
export function useStageRoom(): number {
  return STAGE_ROOM + (usePillOnTop() ? PILL_ROOM : 0);
}

/** What the pill takes of the home's foot, for what stands over it and the list's last row. */
export function usePillFoot(): number {
  return usePillOnTop() ? 0 : PILL_ROOM;
}
