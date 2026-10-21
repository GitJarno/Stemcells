/**
 * A chat's one scroll indicator is T3's ask marks (its timeline minimap: a
 * dash per ask, a preview under the hand); no bar draws anywhere
 * (`scrollbars/scrollbars.css`). The marks are hidden at rest. They show
 * while the reader scrolls the chat and fade half a linger after the last
 * scroll; a hand on them holds them, and they fade that long after it
 * leaves (`scrollIndicator.css`). A reply the list follows to its end
 * scrolls too, many times a second, and shows nothing.
 * `upstream/scrollIndicator.contract.test.ts` pins what this relies on.
 */
import { timing } from "../tokens/motion";

import "./scrollIndicator.css";

const TRANSCRIPT = ".messages-timeline-scroll";
const MARKS = '[data-testid="timeline-minimap"]';
const COMPOSER = '[data-chat-composer-overlay="true"]';
/** On the marks while they show; the stylesheet also shows them under the hand and in focus. */
const SHOWN = "data-stemcells-shown";

/**
 * How long after the reader's own wheel, finger, key or press a scroll
 * counts as theirs.
 */
const INTENT_MS = 400;

/** Shows the marks of the chat in `pane` while the reader scrolls it. Returns the stop. */
export function showMarksWhileScrolling(pane: HTMLElement): () => void {
  const page = pane.ownerDocument;
  let intentAt = -Infinity;
  let shown: Element | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let linger: number | null = null;

  const hide = () => {
    clearTimeout(hideTimer);
    shown?.removeAttribute(SHOWN);
    shown = null;
  };
  /** Shows `marks` for half a notice's linger: a glance at where you are. */
  const show = (marks: Element) => {
    if (shown !== marks) hide();
    shown = marks;
    marks.setAttribute(SHOWN, "");
    clearTimeout(hideTimer);
    linger ??= timing("linger") / 2;
    hideTimer = setTimeout(hide, linger);
  };

  const intend = () => {
    intentAt = performance.now();
  };
  // A key or press in the composer is the reader writing, and a send takes
  // the chat to its end on its own. A key on the page (focus left on the
  // body by a click in the chat) scrolls the focused pane's chat.
  const onKeyOrPress = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && pane.contains(target)) {
      if (!target.closest(COMPOSER)) intend();
    } else if (target === page.body || target === page.documentElement) {
      if (pane.getAttribute("data-focused") === "true") intend();
    }
  };

  const onScroll = (event: Event) => {
    const chat = event.target;
    if (!(chat instanceof Element) || !chat.matches(TRANSCRIPT)) return;
    if (performance.now() - intentAt >= INTENT_MS) return;
    // A chat too short to scroll has nowhere to show.
    if (chat.scrollHeight - chat.clientHeight < 1) return;
    const marks = pane.querySelector(MARKS);
    if (marks) show(marks);
  };
  // The hand, or the focus, leaving the marks.
  const onLeave = (event: PointerEvent | FocusEvent) => {
    const marks = event.target instanceof Element ? event.target.closest(MARKS) : null;
    const to = event.relatedTarget;
    if (!marks || (to instanceof Node && marks.contains(to))) return;
    show(marks);
  };

  pane.addEventListener("scroll", onScroll, { capture: true, passive: true });
  pane.addEventListener("wheel", intend, { capture: true, passive: true });
  pane.addEventListener("touchmove", intend, { capture: true, passive: true });
  pane.addEventListener("pointerdown", onKeyOrPress, { capture: true, passive: true });
  page.addEventListener("keydown", onKeyOrPress, { capture: true, passive: true });
  pane.addEventListener("pointerout", onLeave);
  pane.addEventListener("focusout", onLeave);
  return () => {
    hide();
    pane.removeEventListener("scroll", onScroll, { capture: true });
    pane.removeEventListener("wheel", intend, { capture: true });
    pane.removeEventListener("touchmove", intend, { capture: true });
    pane.removeEventListener("pointerdown", onKeyOrPress, { capture: true });
    page.removeEventListener("keydown", onKeyOrPress, { capture: true });
    pane.removeEventListener("pointerout", onLeave);
    pane.removeEventListener("focusout", onLeave);
  };
}
