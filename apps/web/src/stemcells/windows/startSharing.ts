/**
 * Starts keeping upstream's per-chat stores in step across windows as the
 * app's first modules load (`main.tsx` imports this, a seam), right after
 * the stores read localStorage and in the same turn: a write another window
 * makes from then on is heard, however long the chat route takes to load.
 * Does nothing in a browser.
 */
import { windowsBridge } from "./bridge";
import { shareAcrossWindows } from "./sharedStorage";

if (windowsBridge()) shareAcrossWindows();
