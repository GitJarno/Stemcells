// Where the stages' pill stands (stemcells/tasks/awake-asleep.md): on an upright phone under the
// header with the sky behind it, going up with the title on a candybar phone and staying on the
// folded Duo; elsewhere at the home's foot over its search, riding the keyboard (`StagePill.tsx`).

import { useUprightPhone } from "../upstream/home";
import { PILL_ROOM, STAGE_ROOM } from "./state";

export function usePillOnTop(): boolean {
  return useUprightPhone() !== null;
}

/** Whether the pill on top stays as the list scrolls: on the folded Duo, not a candybar phone. */
export function usePillStays(): boolean {
  return useUprightPhone() === "duo-folded";
}

/** The room over each stage's first row, under the header: the pill's too when it stands there. */
export function useStageRoom(): number {
  return STAGE_ROOM + (usePillOnTop() ? PILL_ROOM : 0);
}

/** What the pill takes of the home's foot, for what stands over it and the list's last row. */
export function usePillFoot(): number {
  return usePillOnTop() ? 0 : PILL_ROOM;
}
