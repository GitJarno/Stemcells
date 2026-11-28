import { createContext } from "react";

/**
 * Whether the pick offers Access. A plan's Cell starts with its project's own access
 * (`aski/plan/launch.ts`), so its pick offers Model and Effort alone.
 */
export const PickOffersAccess = createContext(true);
