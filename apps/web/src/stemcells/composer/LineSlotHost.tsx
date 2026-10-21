import { type Context, type ReactNode, useState } from "react";

import type { LineSlot } from "./slot";

/**
 * Holds one of the line's slots for a pane (`slot.ts`): the element the line
 * draws it in, set when the line mounts it. Only what reads the slot
 * renders again when it does; the chat under it doesn't.
 */
export function LineSlotHost(props: { slot: Context<LineSlot | null>; children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  // The React Compiler keeps the value one object until the element changes.
  const value = { element, setElement };
  const Slot = props.slot;
  return <Slot value={value}>{props.children}</Slot>;
}
