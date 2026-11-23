import { type Context, type ReactNode, useState } from "react";

import { ComposerEnvSlot, type EnvOffer, type LineSlot } from "./slot";

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

/** Holds the line's env slot for a pane (`slot.ts`), as `LineSlotHost` holds the others. */
export function EnvSlotHost(props: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [offer, setOffer] = useState<EnvOffer | null>(null);
  const [open, setOpen] = useState(false);
  const value = { element, setElement, offer, setOffer, open, setOpen };
  return <ComposerEnvSlot value={value}>{props.children}</ComposerEnvSlot>;
}
