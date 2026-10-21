// Replaces `lib/visibleAnimation` (`plugin.ts`). Upstream hands it each box
// it lights while a row runs, as the row starts, and takes it back as it
// stops; ours also joins the box to its pane's wave (`glow/liveRows.ts`).
// Every other name is upstream's.
import { observeVisibleAnimation as observeUpstream } from "../../../lib/visibleAnimation";
import { joinLiveRow } from "../../glow/liveRows";

export * from "../../../lib/visibleAnimation";

export function observeVisibleAnimation(element: HTMLElement | SVGElement | null) {
  const unobserve = observeUpstream(element);
  // Upstream's own tests hand it bare stand-ins: only a box in the page joins.
  if (element === null || typeof element.closest !== "function" || !("offsetParent" in element)) {
    return unobserve;
  }
  const leave = joinLiveRow(element);
  if (leave === undefined) return unobserve;
  return () => {
    leave();
    unobserve?.();
  };
}
