/**
 * Which chat a carried file would land in, for the slate's drop wash. Upstream's thread view
 * draws its own overlay while a file is over its canvas, and the chat showing it takes the drop,
 * so the wash follows it rather than guessing. In a pane the overlay's picture steps aside for
 * the wash (`tabs/drop.css`). `drop.contract.test.ts` pins both.
 */
const CHAT_DROP_OVERLAY = "[data-chat-workspace-drop-overlay]";

/** Whether a chat under `root` would take the file carried over it now. */
export function takesCarriedFile(root: ParentNode): boolean {
  return root.querySelector(CHAT_DROP_OVERLAY) !== null;
}
