// Replaces `features/threads/threadFeedEndFollow.ts` (`substitutes.cjs`): the feed keeps its end
// when its footer grows too, as when a Cell's chat comes to end on its ask (`line/ChatAsk.tsx`),
// as it does for a new message. With its triggers named, LegendList follows a footer only when
// told (`on.footerLayout`).
import { THREAD_FEED_MAINTAIN_SCROLL_AT_END as UPSTREAM } from "../../../features/threads/threadFeedEndFollow";

export * from "../../../features/threads/threadFeedEndFollow";

export const THREAD_FEED_MAINTAIN_SCROLL_AT_END = {
  ...UPSTREAM,
  on: { ...UPSTREAM.on, footerLayout: true },
} as const;
