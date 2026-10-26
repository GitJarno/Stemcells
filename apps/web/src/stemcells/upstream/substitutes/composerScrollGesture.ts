// Replaces `components/chat/composerScrollGesture.ts` (`plugin.ts`): the composer never rests
// into one line when the chat scrolls; it keeps one height, a text row over its control row,
// growing only with what is typed. Upstream's gesture bookkeeping still runs; only its verdict
// changes, so its "Collapse composer on scroll" setting has nothing left to turn on.
import * as Upstream from "../../../components/chat/composerScrollGesture";

export * from "../../../components/chat/composerScrollGesture";

export function shouldCollapseComposerForScrollKey(
  _input: Parameters<typeof Upstream.shouldCollapseComposerForScrollKey>[0],
): boolean {
  return false;
}

export function recordComposerScrollGestureEvent(
  ...args: Parameters<typeof Upstream.recordComposerScrollGestureEvent>
): boolean {
  Upstream.recordComposerScrollGestureEvent(...args);
  return false;
}
