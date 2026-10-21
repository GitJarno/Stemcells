import { POINTS_PER_PIXEL } from "../cell/look";
import { SIDE_REACH } from "../cell/scene";

/**
 * CSS pixels the Cell on a composer's ledge stands in from where the
 * ledge's words start (its name's left edge): the farthest any piece it
 * wears can draw lands on that edge, never past it.
 */
export const CELL_STANDS_IN = SIDE_REACH * POINTS_PER_PIXEL;
