import { createContext } from "react";

import type { CellRef } from "./layout";

/**
 * The Cell a pane holds, for what we draw inside upstream's chat view (the
 * line over its composer). Null outside a Cell's pane: Aski's, and
 * upstream's own routes.
 */
export const PaneCellContext = createContext<CellRef | null>(null);

/**
 * Told by the line over a composer when a composer is drawn in the pane
 * (true) and when it goes (false): a pane without one names its Cell in a
 * pill (`CellPill`). Upstream's chat view may show a chat with no composer
 * (while it loads, say), so a chat to show is not enough to say.
 */
export const PaneComposerContext = createContext<((drawn: boolean) => void) | null>(null);
