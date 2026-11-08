import { Globe2, Smartphone } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";

import {
  browserViewOf,
  closeFloater,
  FaviconImage,
  observeResize,
  openFloaterInPanel,
  threadKeyOf,
  UpstreamThreadPreviewMiniPlayer,
  useBrowserMark,
  useFloaterFace,
  useFloaterFrame,
  useFloaterHasNoRoom,
  showMenu,
  type FloaterSource,
} from "../upstream/floater";
import { reducedMotion, timed, timing } from "../tokens/motion";
import "../tokens/stemcells.css";
import "./floater.css";
import { PUT_AWAY_PAST, TuckPress } from "./tuck";

/**
 * A chat's floating browser or device (upstream's mini player), as a card. Where the chat has
 * room beside its lane it is upstream's live floater; where upstream would lay it over the chat's
 * words, most panes, it tucks at the chat's right edge instead (`Tucked`). Either way a click
 * opens it in the workbench, and it flies there and back (`flight.ts`).
 */
export function ThreadPreviewMiniPlayer(
  props: ComponentProps<typeof UpstreamThreadPreviewMiniPlayer>,
) {
  const noRoom = useFloaterHasNoRoom(props.miniPlayer.source);
  if (noRoom === null) return null;
  return (
    <div data-stemcells-floater={threadKeyOf(props.threadRef)}>
      {noRoom ? (
        <Tucked threadRef={props.threadRef} source={props.miniPlayer.source} />
      ) : (
        <Card {...props} />
      )}
    </div>
  );
}

/**
 * Upstream's floater, a live page beside the chat, made a card: a click on the page opens it in
 * the workbench rather than reaching the page, and pointed at, it lifts. Upstream's grip, edges
 * and buttons stay above it. The desktop browser's page is drawn at the app's root, over its
 * slot, so it is lifted with the card by name.
 */
function Card(props: ComponentProps<typeof UpstreamThreadPreviewMiniPlayer>) {
  const { threadRef, miniPlayer } = props;
  const { source } = miniPlayer;
  const frame = useFloaterFrame(source);
  const face = useFloaterFace(threadRef, source);
  const threadKey = threadKeyOf(threadRef);
  // The desktop page lifts with the card, as its style does: pointed at or
  // focused within (upstream's buttons included).
  const hovered = useRef(false);
  const focused = useRef(false);
  const lift = () => {
    const up = hovered.current || focused.current;
    browserViewOf(threadKey, source)?.toggleAttribute("data-stemcells-lifted", up);
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Clear the lifted mark from the desktop browser view when the card's source changes or unmounts.
  useEffect(
    () => () => browserViewOf(threadKey, source)?.removeAttribute("data-stemcells-lifted"),
    [threadKey, source],
  );
  return (
    <div
      data-stemcells-card=""
      onPointerEnter={() => {
        hovered.current = true;
        lift();
      }}
      onPointerLeave={() => {
        hovered.current = false;
        lift();
      }}
      onFocus={() => {
        focused.current = true;
        lift();
      }}
      onBlur={(event) => {
        focused.current = event.currentTarget.contains(event.relatedTarget);
        lift();
      }}
    >
      {frame ? (
        <button
          type="button"
          data-stemcells-card-open=""
          aria-label={`Look at ${face.name}`}
          style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
          onClick={() => openFloaterInPanel(threadRef, source)}
        />
      ) : null}
      <UpstreamThreadPreviewMiniPlayer {...props} />
    </div>
  );
}

/**
 * The tucked tab on the Cell's shelf, its page's mark at the chat's edge; it unfolds toward the
 * chat from behind the mark, which never moves. The whole tab opens it in the workbench (Look in
 * a tab of several Cells); it is put away only on purpose: pushed into the edge, its menu, Delete.
 */
function Tucked(
  props: Pick<ComponentProps<typeof UpstreamThreadPreviewMiniPlayer>, "threadRef"> & {
    source: FloaterSource;
  },
) {
  const { threadRef, source } = props;
  const face = useFloaterFace(threadRef, source);
  const mark = useBrowserMark(threadRef, face.url);
  const room = useRef<HTMLDivElement>(null);
  useShelf(room);
  const tab = useTuckTab(
    () => openFloaterInPanel(threadRef, source),
    () => closeFloater(threadRef),
  );
  const fallback = source.kind === "device" ? <Smartphone aria-hidden /> : <Globe2 aria-hidden />;
  const label = [face.name, face.detail, face.recording ? "recording" : null].filter(Boolean);
  return (
    <div ref={room} data-stemcells-tuck="">
      <button
        {...tab.props}
        type="button"
        data-stemcells-tuck-card=""
        data-out={tab.out || undefined}
        aria-label={`Look at ${label.join(", ")}`}
        aria-description="Push it into the edge, or press Delete, to put it away."
      >
        <span data-stemcells-tuck-ground="" />
        <span data-stemcells-tuck-face="">
          <span data-stemcells-tuck-name="">{face.name}</span>
          {face.detail ? <span data-stemcells-tuck-detail="">{face.detail}</span> : null}
        </span>
        <span data-stemcells-tuck-mark="">
          <span data-stemcells-tuck-icon="">
            <FaviconImage sources={[mark]} fallback={fallback} />
            {face.recording ? <span data-stemcells-tuck-recording="" /> : null}
          </span>
        </span>
      </button>
    </div>
  );
}

/** A press under way on the tab: its pointer, what it has done, and a touch's wait to hold. */
interface Press {
  readonly pointerId: number;
  readonly gesture: TuckPress;
  hold: number | undefined;
}

/**
 * The tucked tab's gestures. A pointer resting on it a beat unfolds it, as keyboard focus does
 * at once (its style); leaving folds it. A press opens it, a drag pushes it into the edge, a
 * right-click or a touch held still opens its menu. The drag moves it by a style property,
 * never React state.
 */
function useTuckTab(open: () => void, putAway: () => void) {
  const tab = useRef<HTMLButtonElement>(null);
  const [out, setOut] = useState(false);
  const intent = useRef<number | undefined>(undefined);
  const press = useRef<Press | null>(null);
  const leaving = useRef(false);
  const pulled = useRef(0);
  /** The click that ends a drag or a press held for the menu opens nothing. */
  const swallow = useRef(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Cancel the hover and hold timers when the tab goes.
  useEffect(
    () => () => {
      clearTimeout(intent.current);
      clearTimeout(press.current?.hold);
    },
    [],
  );

  const pull = (pixels: number) => {
    pulled.current = pixels;
    const element = tab.current;
    if (!element) return;
    element.style.setProperty("--tuck-pull", `${pixels}px`);
    element.toggleAttribute("data-past", pixels >= PUT_AWAY_PAST);
  };
  const springBack = () => {
    tab.current?.removeAttribute("data-dragging");
    pull(0);
  };
  /** Slides behind the edge from where it is, then ends the floater. */
  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    const element = tab.current;
    if (!element || reducedMotion()) {
      putAway();
      return;
    }
    element.setAttribute("data-leaving", "");
    const { duration, easing } = timed("leave");
    element
      .animate(
        [{ translate: `${pulled.current}px 0` }, { translate: `${element.offsetWidth}px 0` }],
        { duration, easing, fill: "forwards" },
      )
      .finished.catch(() => undefined)
      .then(putAway);
  };
  const showMenuAt = async (at: { x: number; y: number }) => {
    const picked = await showMenu(
      [
        { id: "open", label: "Open" },
        { id: "put-away", label: "Put away" },
      ],
      at,
    );
    if (picked === "open") open();
    else if (picked === "put-away") leave();
  };
  const endPress = (): TuckPress | null => {
    const current = press.current;
    press.current = null;
    if (current === null) return null;
    clearTimeout(current.hold);
    return current.gesture;
  };

  const props = {
    ref: tab,
    onPointerEnter: (event) => {
      if (event.pointerType === "touch") return;
      clearTimeout(intent.current);
      intent.current = window.setTimeout(() => setOut(true), timing("intent"));
    },
    onPointerLeave: () => {
      if (press.current !== null) return;
      clearTimeout(intent.current);
      setOut(false);
    },
    onPointerDown: (event) => {
      if (event.button !== 0 || leaving.current || press.current !== null) return;
      swallow.current = false;
      const { clientX: x, clientY: y, pointerId } = event;
      const current: Press = { pointerId, gesture: new TuckPress(x, y), hold: undefined };
      if (event.pointerType === "touch") {
        current.hold = window.setTimeout(() => {
          if (current.gesture.hold()) void showMenuAt({ x, y });
        }, timing("hold"));
      }
      press.current = current;
      event.currentTarget.setPointerCapture(pointerId);
    },
    onPointerMove: (event) => {
      const current = press.current;
      if (current === null || current.pointerId !== event.pointerId) return;
      const pixels = current.gesture.move(event.clientX, event.clientY);
      if (pixels === null) return;
      clearTimeout(current.hold);
      event.currentTarget.setAttribute("data-dragging", "");
      pull(pixels);
    },
    onPointerUp: (event) => {
      if (press.current?.pointerId !== event.pointerId) return;
      const release = endPress()?.release();
      swallow.current = release !== undefined && release !== "open";
      if (release === "put-away") leave();
      else if (release === "spring-back") springBack();
    },
    onPointerCancel: () => {
      if (endPress()?.wandered) springBack();
    },
    onLostPointerCapture: () => {
      if (endPress()?.wandered) springBack();
    },
    onClick: () => {
      if (swallow.current) swallow.current = false;
      else if (!leaving.current) open();
    },
    onKeyDown: (event) => {
      swallow.current = false;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      leave();
    },
    onContextMenu: (event) => {
      event.preventDefault();
      const current = press.current;
      // A press held for the menu (ctrl-click, a touch held still) shows it once; a drag, never.
      if (current !== null && !current.gesture.hold()) return;
      clearTimeout(current?.hold);
      const rect = event.currentTarget.getBoundingClientRect();
      const pointed = event.clientX !== 0 || event.clientY !== 0;
      void showMenuAt(
        pointed ? { x: event.clientX, y: event.clientY } : { x: rect.left, y: rect.top },
      );
    },
  } satisfies ComponentProps<"button"> & { ref: RefObject<HTMLButtonElement | null> };
  return { props, out };
}

/** Where the Cell stands: its line's ledge, or the composer's top where a chat draws no line. */
const SHELF = "[data-stemcells-composer-line] .composer-line-ledge";
const COMPOSER = "[data-chat-composer-stack]";

/**
 * The card's foot goes where the Cell's does, on the ledge over the
 * composer, so the two stand on one floor at the chat's two ends. Followed
 * as the composer grows, into a style property, never React state.
 */
function useShelf(room: RefObject<HTMLElement | null>) {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Measure the shelf's floor into a style property and observe the canvas and composer resizes.
  useLayoutEffect(() => {
    const element = room.current;
    const canvas = element?.closest<HTMLElement>("[data-chat-canvas]");
    if (!element || !canvas) return;
    const place = () => {
      const floor = canvas.querySelector(SHELF) ?? canvas.querySelector(COMPOSER);
      const height = floor
        ? element.getBoundingClientRect().bottom - floor.getBoundingClientRect().top
        : 0;
      element.style.setProperty("--sc-tuck-floor", `${Math.max(0, height)}px`);
    };
    place();
    // The overlay grows with the composer at the chat's foot; a new chat's
    // composer stands mid-canvas in an overlay that fills it, so the stack.
    const moving = ["[data-chat-composer-overlay]", COMPOSER].flatMap(
      (selector) => canvas.querySelector(selector) ?? [],
    );
    return observeResize([canvas, ...moving], place);
  }, [room]);
}
