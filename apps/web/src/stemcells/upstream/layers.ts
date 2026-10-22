/**
 * Upstream's open layers: a dialog, menu, select, popover or list that is
 * open, or still leaving. A closed one kept mounted (Base UI's
 * `keepMounted`, as the composer line's popover and the right panel's
 * sheet are) doesn't count. Upstream keeps this rule to itself, for its
 * panel's shortcuts (`components/RightPanelTabs.tsx`); this is the same
 * rule, and `layers.contract.test.ts` holds the two together.
 */
export const LAYER_SLOTS = [
  "dialog-popup",
  "alert-dialog-popup",
  "command-dialog-popup",
  "menu-popup",
  "select-popup",
  "popover-popup",
  "combobox-popup",
  "autocomplete-popup",
] as const;

const OPEN_LAYERS = LAYER_SLOTS.map(
  (slot) => `[data-slot="${slot}"]:is([data-open],[data-ending-style])`,
).join(",");

/** Whether a layer is open on the page now: it takes Esc, as upstream's own shortcuts let it. */
export function layerOpen(root: ParentNode = document): boolean {
  return root.querySelector(OPEN_LAYERS) !== null;
}
