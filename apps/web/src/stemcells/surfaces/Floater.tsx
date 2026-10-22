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
  closeFloater,
  FaviconImage,
  observeResize,
  openFloaterInPanel,
  UpstreamThreadPreviewMiniPlayer,
  useBrowserMark,
  useFloaterHasNoRoom,
  useFloaterFace,
  type FloaterSource,
} from "../upstream/floater";
import "../tokens/stemcells.css";
import "./tuck.css";

/**
 * A chat's floating browser or device (upstream's mini player). It floats
 * only where it leaves the chat its lane. Where upstream would lay it over
 * the chat's words, which is most panes, it tucks instead: a card at the
 * chat's right edge, most of it behind the edge (`Tucked`).
 */
export function ThreadPreviewMiniPlayer(
  props: ComponentProps<typeof UpstreamThreadPreviewMiniPlayer>,
) {
  const noRoom = useFloaterHasNoRoom(props.miniPlayer.source);
  if (noRoom === null) return null;
  if (!noRoom) return <UpstreamThreadPreviewMiniPlayer {...props} />;
  return <Tucked threadRef={props.threadRef} source={props.miniPlayer.source} />;
}

/**
 * The tucked card. It stands on the Cell's shelf, showing its page's mark;
 * pointed at or focused it slides out to its name and ×. A touch has no
 * hover, so there the first tap brings it out and the next opens it, as
 * upstream's floater shows its buttons on a tap. A click opens it in
 * the chat's workbench as upstream's "Open in right panel" does: in a tab of
 * several Cells that is Look, half the slate. × ends the floater, as
 * upstream's own × does; the browser stays among the workbench's tabs.
 * Tucked, a browser shows no live page.
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
