import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as KeyEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { useColumnShowsCards } from "../rail/LeftColumn";
import { COMPOSER_SURFACE_SELECTOR, observeResize, useDraftText } from "../upstream/needs";
import { CardList, useOnList } from "./CardList";
import { hingeAcross, sameHinge, type Box, type Hinge, type Screen } from "./hinge";
import { page } from "./live";
import { DoneList } from "./Roster";
import { enter } from "./walk";

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
  // oxlint-disable-next-line t3code/react-effect-budget -- Track the frame's width and the two-screen hinge as it resizes; stop observing on unmount.
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

const needYou = (count: number) => (count === 1 ? "1 needs you" : `${count} need you`);

/**
 * Aski's page around its chat, with what needs the person always on the right
 * (stemcells/tasks/aski-manager.md, decision 1): narrow, a count that opens it as a sheet; on
 * two screens, the second screen. While the Cells' column shows the cards, the page is the chat
 * alone: the cards live in one place (stemcells/tasks/left-column.md, decision 11).
 */
export function NeedsFrame(props: {
  /** Aski's chat, whose composer holds the page still while it has text. */
  aski: { readonly environmentId: string; readonly threadId: string } | null;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const { layout, hinge } = useLayout(root);
  const view = useSyncExternalStore(page.subscribe, page.read, page.read);
  const draft = useDraftText(props.aski);
  const inColumn = useColumnShowsCards();
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  // The pointer or keyboard focus in the list holds it still; a click's focus doesn't.
  const onPerson = (pointer: boolean | null, focus: boolean | null) => {
    if (pointer !== null) setPointerIn(pointer);
    if (focus !== null) setFocusIn(focus);
  };
  const frozen = draft !== "" || pointerIn || focusIn;
  // The Cells' column holds the cards still while they're there.
  // oxlint-disable-next-line t3code/react-effect-budget -- Sync the shared page's frozen flag to this frame's draft, pointer and focus.
  useEffect(() => {
    if (!inColumn) page.setFrozen(frozen);
  }, [frozen, inColumn]);
  const waiting = useOnList(view).filter((each) => each.goneAt === null).length;
  // ↓ in Aski's empty composer steps onto the first open card.
  const enterKeys = (event: KeyEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.shiftKey || draft !== "" || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (!target.closest(COMPOSER_SURFACE_SELECTOR) || !target.isContentEditable) return;
    if (enter(target)) event.preventDefault();
  };
  const list = (
    <CardList
      view={view}
      onPerson={onPerson}
      head={
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
      }
      foot={<DoneList />}
    />
  );

  const showColumn = layout !== "narrow" && !inColumn;
  const showCount = waiting > 0 && layout === "narrow" && !inColumn;
  const showSheet = layout === "narrow" && view.sheet && !inColumn;

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
      <div ref={main} data-stemcells-needs-main="" onKeyDown={enterKeys}>
        {props.children}
        {showCount ? (
          <button
            type="button"
            data-stemcells-needs-count=""
            aria-expanded={showSheet}
            onClick={() => page.setSheet(!view.sheet)}
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
  // oxlint-disable-next-line t3code/react-effect-budget -- Keep the sheet's bottom above Aski's perch or the composer as the main pane resizes.
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
