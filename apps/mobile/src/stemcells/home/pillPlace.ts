// Where the stages' pill stands: on an upright phone under the header, with the sky behind it,
// where the eye starts (stemcells/tasks/awake-asleep.md); elsewhere at the home's foot, over its
// search, riding the keyboard (`StagePill.tsx`).

import { useUprightPhoneHome } from "../upstream/home";
import { PILL_ROOM, STAGE_ROOM } from "./state";

export const usePillOnTop = useUprightPhoneHome;

/** The room over each stage's first row, under the header: the pill's too when it stands there. */
export function useStageRoom(): number {
  return STAGE_ROOM + (usePillOnTop() ? PILL_ROOM : 0);
}

/** What the pill takes of the home's foot, for what stands over it and the list's last row. */
export function usePillFoot(): number {
  return usePillOnTop() ? 0 : PILL_ROOM;
}
