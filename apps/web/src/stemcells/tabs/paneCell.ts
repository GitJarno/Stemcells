import { createContext } from "react";

import type { CellRef } from "./layout";

/**
 * The Cell a pane holds, for what we draw inside upstream's chat view (the
 * line over its composer). Null outside a Cell's pane: Aski's, and
 * upstream's own routes.
 */
export const PaneCellContext = createContext<CellRef | null>(null);
