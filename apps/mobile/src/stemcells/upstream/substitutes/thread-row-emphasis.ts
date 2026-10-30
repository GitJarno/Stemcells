// Replaces `features/threads/thread-row-emphasis.ts` (`substitutes.cjs`): no Cell recedes. T3 fades
// a working row to 55% so finished ones stand out; here a flying Cell has its own segment and its
// card's light, and its title reads as clearly as a landed one's.
import type * as Upstream from "../../../features/threads/thread-row-emphasis";

export const shouldRecedeThreadRow: typeof Upstream.shouldRecedeThreadRow = () => false;
