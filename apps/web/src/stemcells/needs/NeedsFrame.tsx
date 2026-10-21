import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { COMPOSER_SURFACE_SELECTOR, observeResize, useDraftText } from "../upstream/needs";
import { hingeAcross, sameHinge, type Box, type Hinge, type Screen } from "./hinge";
import { useHolds } from "./holds";
import { holds, page } from "./live";
import { NeedCard } from "./NeedCard";

import "../tokens/stemcells.css";
import "./needs.css";

/** Aski's pane is wide enough for the chat and the column side by side. */
const WIDE_PANE = 880;

const SEGMENTS = "(horizontal-viewport-segments: 2), (vertical-viewport-segments: 2)";
const segments = typeof matchMedia === "function" ? matchMedia(SEGMENTS) : null;
const subscribeSegments = (listener: () => void) => {
  segments?.addEventListener("change", listener);
  return () => segments?.removeEventListener("change", listener);
};
const onTwoScreens = () => segments?.matches ?? false;
const screens = (): ReadonlyArray<Screen> =>
  (window as { viewport?: { segments?: ReadonlyArray<DOMRectReadOnly> | null } }).viewport
    ?.segments ?? [];

/**
 * Where the page sits in the window when it is on stage: offsets, unlike a
 * measured box, leave out the transforms that slide pages along the strip.
 */
function restingBox(element: HTMLElement): Box {
  let left = 0;
  let top = 0;
  for (let at: Element | null = element; at instanceof HTMLElement; at = at.offsetParent) {
    left += at.offsetLeft;
    top += at.offsetTop;
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}

type Layout = "wide" | "narrow" | "dual";

/** Wide, narrow, or split at the hinge of two screens (a foldable held open). */
function useLayout(root: RefObject<HTMLElement | null>): {
  readonly layout: Layout;
  readonly hinge: Hinge | null;
} {
  const [wide, setWide] = useState(true);
  const [hinge, setHinge] = useState<Hinge | null>(null);
  const twoScreens = useSyncExternalStore(subscribeSegments, onTwoScreens, onTwoScreens);
  useLayoutEffect(() => {
    const element = root.current;
    if (element === null) return;
    return observeResize(element, ([entry]) => {
      if (!entry) return;
      setWide(entry.contentRect.width >= WIDE_PANE);
      const next = twoScreens ? hingeAcross(restingBox(element), screens()) : null;
      setHinge((was) => (sameHinge(was, next) ? was : next));
    });
  }, [root, twoScreens]);
  return { layout: hinge !== null ? "dual" : wide ? "wide" : "narrow", hinge };
}

/** ⌘Z takes back the newest held answer, unless the keys belong to a field. */
function useUndoKey(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const keydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== "z") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (holds.undoNewest()) event.preventDefault();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [active]);
}

const needYou = (count: number) => (count === 1 ? "1 needs you" : `${count} need you`);

/**
 * Aski's page around its chat: the column of what needs the person on the
 * right while anything does (stemcells/tasks/aski-room.md, decisions 9 and
 * 10). Narrow, it is a count over the chat that opens the list as a sheet;
 * on two screens, the list keeps the second screen.
 */
export function NeedsFrame(props: {
  /** Aski's chat, whose composer holds the page still while it has text. */
  aski: { readonly environmentId: string; readonly threadId: string } | null;
  /** Whether Aski's pane has the keyboard, so ⌘Z is its to take. */
  ownsWindowInput: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const { layout, hinge } = useLayout(root);
  const view = useSyncExternalStore(page.subscribe, page.read, page.read);
  const answers = useHolds(holds);
  const draft = useDraftText(props.aski);
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  // The pointer or keyboard focus in the list holds it still; a click's
  // focus doesn't. Native listeners, because a chosen option's button leaves
  // the page with the focus and the pointer on it: only the browser's own
  // focusout says the focus went, and no pointerleave ever comes, so the
  // pointer is wherever the next pointerover anywhere says it is.
  const watchPerson = (list: HTMLDivElement | null) => {
    if (list === null) return;
    const focusin = (event: FocusEvent) =>
      setFocusIn(event.target instanceof Element && event.target.matches(":focus-visible"));
    const focusout = (event: FocusEvent) => {
      if (!list.contains(event.relatedTarget as Node | null)) setFocusIn(false);
    };
    const over = (event: PointerEvent) => setPointerIn(list.contains(event.target as Node | null));
    const out = (event: PointerEvent) => {
      if (event.relatedTarget === null) setPointerIn(false);
    };
    list.addEventListener("focusin", focusin);
    list.addEventListener("focusout", focusout);
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    return () => {
      list.removeEventListener("focusin", focusin);
      list.removeEventListener("focusout", focusout);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      setFocusIn(false);
      setPointerIn(false);
    };
  };
  const frozen = draft !== "" || pointerIn || focusIn;
  useEffect(() => page.setFrozen(frozen), [frozen]);
  useEffect(() => page.setDraft(draft), [draft]);
  useUndoKey(props.ownsWindowInput);

  const waiting = view.shown.filter((each) => each.goneAt === null).length;
  const list = (
    <div ref={watchPerson} data-stemcells-needs-list="">
      <div data-needs-head="">
        <b>{waiting === 0 ? "Nothing needs you" : needYou(waiting)}</b>
        {frozen && view.shown.some((each) => each.goneAt !== null) ? (
          <span data-needs-still="">Held still while you work</span>
        ) : null}
        {view.live ? null : <span data-needs-still="">Reconnecting…</span>}
        {layout === "narrow" ? (
          <button type="button" data-needs-close="" onClick={() => page.setSheet(false)}>
            Back to the chat
          </button>
        ) : null}
      </div>
      {view.shown.map((each) => (
        <NeedCard
          key={each.need.key}
          shown={each}
          hold={answers.get(each.need.key)}
          seenAt={view.seen.get(each.need.key) ?? null}
        />
      ))}
      {view.cleared !== null ? <p data-needs-cleared="">{view.cleared}</p> : null}
    </div>
  );

  const showColumn = layout === "dual" || (layout === "wide" && view.columnIn);
  const showCount = waiting > 0 && (layout === "narrow" || (layout === "wide" && !view.columnIn));
  const showSheet = layout === "narrow" && view.sheet;

  return (
    <div
      ref={root}
      data-stemcells-needs-frame=""
      data-layout={layout}
      data-hinge={hinge?.axis}
      style={
        hinge === null
          ? undefined
          : ({
              "--stemcells-needs-hinge-start": `${hinge.start}px`,
              "--stemcells-needs-hinge-end": `${hinge.end}px`,
            } as CSSProperties)
      }
    >
      <div ref={main} data-stemcells-needs-main="">
        {props.children}
        {showCount ? (
          <button
            type="button"
            data-stemcells-needs-count=""
            aria-expanded={layout === "narrow" ? showSheet : undefined}
            onClick={() => (layout === "narrow" ? page.setSheet(!view.sheet) : page.openColumn())}
          >
            {needYou(waiting)}
          </button>
        ) : null}
        {showSheet ? <div data-stemcells-needs-band="" /> : null}
        {showSheet ? <Sheet main={main}>{list}</Sheet> : null}
      </div>
      {showColumn ? <aside data-stemcells-needs-column="">{list}</aside> : null}
    </div>
  );
}

/**
 * The list over the chat, from under the pane's buttons down to just above
 * Aski on its composer (aski/AskiPerch.tsx), or the composer when Aski
 * isn't there: Aski stays in sight while you answer.
 */
function Sheet(props: { main: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [bottom, setBottom] = useState<number | null>(null);
  useLayoutEffect(() => {
    const main = props.main.current;
    if (main === null) return;
    return observeResize(main, () => {
      const above =
        main.querySelector<HTMLElement>("[data-stemcells-aski-perch]") ??
        main.querySelector<HTMLElement>(COMPOSER_SURFACE_SELECTOR);
      setBottom(
        above === null
          ? 0
          : main.getBoundingClientRect().bottom - above.getBoundingClientRect().top,
      );
    });
  }, [props.main]);
  return (
    <div data-stemcells-needs-sheet="" style={bottom === null ? undefined : { bottom }}>
      {props.children}
    </div>
  );
}
