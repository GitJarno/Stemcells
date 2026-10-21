import { createContext, type ReactNode } from "react";

/**
 * What stands over the composer in a pane with no Cell, where a Cell's line
 * would (CellComposerLine): Aski, in Aski's pane. Nothing anywhere else.
 */
export const ComposerRoofSlot = createContext<ReactNode>(null);
