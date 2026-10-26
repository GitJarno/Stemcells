import { createContext, type ReactNode } from "react";

/**
 * What stands over the composer in a pane with no Cell, where a Cell's line
 * would (CellComposerLine): Aski, in Aski's pane. Nothing anywhere else.
 */
export const ComposerRoofSlot = createContext<ReactNode>(null);

/** An element our line draws, which upstream's composer can portal into. */
export interface LineSlot {
  readonly element: HTMLElement | null;
  readonly setElement: (element: HTMLElement | null) => void;
}

/**
 * Where the Cell's line takes the composer's stash: the ledge's right end
 * (`upstream/substitutes/ComposerStashBadge.tsx`). Null outside a Cell's
 * pane; its element is null while the pane shows no line (a draft), and
 * upstream's own tab stands on the box instead.
 */
export const ComposerStashSlot = createContext<LineSlot | null>(null);

/**
 * Where the Cell's line takes upstream's branch toolbar: the menu under the ledge's
 * "project · branch ⌄" (`upstream/substitutes/BranchToolbar.tsx`). `offered` while upstream
 * offers the controls in the composer and the checkout is known to be git; `open` is the
 * menu's, which upstream's branch shortcut opens too. Null outside a Cell's pane.
 */
export interface EnvSlot extends LineSlot {
  readonly offered: boolean;
  readonly setOffered: (offered: boolean) => void;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

export const ComposerEnvSlot = createContext<EnvSlot | null>(null);
