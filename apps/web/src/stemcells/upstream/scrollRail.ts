/**
 * What the chat's scroll rail borrows from upstream: the hand-off its
 * timeline minimap gives a wheel turned over it, so a wheel over the rail
 * scrolls the transcript as it would anywhere else, and its resize watch.
 * `scrollRail.contract.test.ts` pins what the rail relies on.
 */
export { forwardWheelToTimeline } from "../../components/chat/timelineMinimapWheel";
export { observeResize } from "~/lib/observeResize";
