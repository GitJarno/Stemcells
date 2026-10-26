/**
 * Upstream's open layers: a dialog, menu, select, popover or list open or still leaving; one
 * kept mounted closed (Base UI's `keepMounted`) doesn't count. Upstream keeps this rule private
 * to its panel's shortcuts (`components/RightPanelTabs.tsx`); `layers.contract.test.ts` holds
 * the two together.
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
