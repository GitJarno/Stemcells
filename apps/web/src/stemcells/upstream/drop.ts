/**
 * What the slate's drop wash needs of upstream: which chat a carried file
 * would land in. Upstream's thread view takes files dragged over its canvas
 * and, while one is over it, draws an overlay of its own; the chat showing
 * that overlay is the one a drop lands in, so the wash follows it rather
 * than guessing. In a pane the overlay's picture steps aside for the wash
 * (`tabs/drop.css`). `drop.contract.test.ts` pins both.
 */
const CHAT_DROP_OVERLAY = "[data-chat-workspace-drop-overlay]";

/** Whether a chat under `root` would take the file carried over it now. */
export function takesCarriedFile(root: ParentNode): boolean {
  return root.querySelector(CHAT_DROP_OVERLAY) !== null;
}
