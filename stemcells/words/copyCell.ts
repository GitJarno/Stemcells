/**
 * Copying a Cell, in the words a person reads. Stemcells has no hosted app, so a copied Cell is
 * its name and its own `t3-thread://` link, never upstream's link through T3's: it opens the Cell
 * from a message and pastes back as its chip in any composer. The web's and the phone's
 * substitutes say it with these (`stemcells/seams.md`, Copy Cell).
 */
export const COPY_CELL = {
  /** The command palette's action. */
  action: "Copy Cell",
  /** Under the Cell menu's Copy, as the phone's card says "Copy Cell" and "Copy Cell ID". */
  menu: "Cell",
  menuId: "Cell ID",
  /** What the clipboard holds, when a write fails. */
  target: "Cell",
  copied: "Cell copied",
  failed: "Failed to copy Cell",
} as const;
