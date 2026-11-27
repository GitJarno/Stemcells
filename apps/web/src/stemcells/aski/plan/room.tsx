/**
 * Aski's chat is where a message becomes a plan (stemcells/tasks/aski-orchestrator.md). Aski's
 * pane says so around its chat: its composer reads a message for Cells to start only there
 * (`AskiPlans.tsx`), and a plan's cards know whose chat they stand in.
 */
import { createContext } from "react";

import type { CellRef } from "../../tabs/layout";

/** Aski's chat, inside Aski's pane; null anywhere else. */
export const PlanRoom = createContext<CellRef | null>(null);

/** A chat as the plans key it. */
export const chatKeyOf = (cell: CellRef): string => `${cell.environmentId}/${cell.threadId}`;
