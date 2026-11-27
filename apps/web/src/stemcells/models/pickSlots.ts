import { createContext, type ReactNode } from "react";

/**
 * What T3's docked picker lays beside its list (the effort column, the footer), handed to the
 * pick to stack under its lines instead: the picker gets no column of its own to draw.
 */
export const PickSlots = createContext<{
  readonly effort: ReactNode;
  readonly footer: ReactNode;
} | null>(null);

/**
 * The family's baked levels (Antigravity's Flash High, Medium, Low), drawn by the pick and handed
 * to the effort column so they sit in its Effort section with the model's switches.
 */
export const PickLevels = createContext<ReactNode>(null);
