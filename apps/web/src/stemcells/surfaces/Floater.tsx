import { Globe2, Smartphone, X } from "lucide-react";
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
  type FloaterSource,
} from "../upstream/floater";
import "../tokens/stemcells.css";
import "./floater.css";

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
  // oxlint-disable-next-line t3code/react-effect-budget -- Clear the lifted mark from the desktop browser view when the card's source changes or unmounts.
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
 * The tucked card on the Cell's shelf, showing its page's mark; pointed at or focused it slides
 * out to its name and ×. A touch has no hover, so there the first tap brings it out. A click
 * opens it in the workbench as upstream's "Open in right panel" does (in a tab of several Cells,
 * Look); × ends the floater, the browser staying in the workbench. Tucked, no live page shows.
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
  const card = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false);
  const pointer = useRef<string | null>(null);
  // oxlint-disable-next-line t3code/react-effect-budget -- Listen for a press outside the slid-out card to tuck it back, removing the listener when it tucks.
  useEffect(() => {
    if (!out) return;
    const away = (event: PointerEvent) => {
      if (event.target instanceof Node && card.current?.contains(event.target)) return;
      setOut(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [out]);
  const open = () => {
    const touched = pointer.current === "touch";
    pointer.current = null;
    if (touched && !out) setOut(true);
    else openFloaterInPanel(threadRef, source);
  };
  const fallback = source.kind === "device" ? <Smartphone aria-hidden /> : <Globe2 aria-hidden />;
  return (
    <div ref={room} data-stemcells-tuck="">
      <div ref={card} data-stemcells-tuck-card="" data-out={out || undefined}>
        <button
          type="button"
          data-stemcells-tuck-open=""
          aria-label={`Look at ${face.name}${face.recording ? ", recording" : ""}`}
          onPointerDown={(event) => {
            pointer.current = event.pointerType;
          }}
          onClick={open}
        >
          <span data-stemcells-tuck-mark="">
            <FaviconImage sources={[mark]} fallback={fallback} />
            {face.recording ? <span data-stemcells-tuck-recording="" /> : null}
          </span>
          <span data-stemcells-tuck-name="">{face.name}</span>
        </button>
        <button
          type="button"
          data-stemcells-tuck-hide=""
          aria-label={`Hide ${face.name}`}
          onClick={() => closeFloater(threadRef)}
        >
          <X aria-hidden />
        </button>
      </div>
    </div>
  );
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
  // oxlint-disable-next-line t3code/react-effect-budget -- Measure the shelf's floor into a style property and observe the canvas and composer resizes.
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
