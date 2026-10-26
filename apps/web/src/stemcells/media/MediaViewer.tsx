import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import "../tokens/stemcells.css";
import "./media-viewer.css";
import {
  AttachmentImage,
  MediaActions,
  MediaVideoPlayer,
  TIMELINE_ROW,
  composerFloatingLayerProps,
  keybindingCaptureProps,
  useAssetUrlRefresh,
  useAssetUrlState,
  type MediaItem,
} from "../upstream/media";
import type { Size } from "./geometry";
import { itemKey, restand, type Standing } from "./reel";
import type { MediaElement } from "./thumbnails";
import { UNAVAILABLE_SIZE, Viewer } from "./viewer";

/**
 * The media viewer: one picture or video at a time over the whole window, flown out of the
 * thumbnail that opened it, stepping through the chat's reel, and flown home when it closes.
 * The window, not the pane: panes are often a third of it, and a screenshot's words want
 * every pixel (`stemcells/tasks/media-viewer.md`).
 */
export function MediaViewer(props: {
  /** The chat's media, in reading order. */
  reel: readonly MediaItem[];
  /** The list the click came with, for an item the chat's reel doesn't hold (the composer's pictures). */
  own: readonly MediaItem[];
  /** The item clicked. */
  start: MediaItem;
  /** The chat's view, where its thumbnails are. */
  scope: Element | null;
  /** The thumbnail that was clicked. */
  source: MediaElement | null;
  /** What had focus when it opened, for focus to go back to. */
  opener: HTMLElement | null;
  /** The viewer has put its picture away; unmount it. */
  onClosed: () => void;
}) {
  // What shows is held by the item itself: the reel may change under the
  // viewer and never puts another picture up.
  const [at, setAt] = useState<Standing>(() => ({ item: props.start, step: 0 }));
  const { items, index, standing } = restand(at, props.reel, props.own);
  if (standing !== at) setAt(standing);
  const item: MediaItem | undefined = items[index];
  const key = item ? itemKey(item) : null;
  const count = items.length;
  const scope = { root: props.scope, within: items === props.reel ? TIMELINE_ROW : null };

  const [viewer] = useState(() => new Viewer({ source: props.source, opener: props.opener }));
  const { onClosed } = props;
  // oxlint-disable-next-line t3code/react-effect-budget -- Hand the imperative viewer its step and close callbacks before paint.
  useLayoutEffect(() => {
    viewer.listen({
      onStep: (next) => setAt((current) => ({ item: next, step: current.step + 1 })),
      onClosed,
    });
  }, [viewer, onClosed]);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const [popup, setPopup] = useState<HTMLDivElement | null>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);

  const resolved = useResolvedMedia(item);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const failed = resolved.failed || (key !== null && failedKey === key);

  // The portal mounts its contents a beat after the viewer: attach once they are there.
  // oxlint-disable-next-line t3code/react-effect-budget -- Attach the viewer to the portal's nodes, detach on change or unmount, and restore focus after close.
  useLayoutEffect(() => {
    const figure = figureRef.current;
    const scrim = scrimRef.current;
    const caption = captionRef.current;
    if (popup === null || figure === null || scrim === null || caption === null) return;
    viewer.attach({ popup, figure, scrim, caption });
    return () => {
      viewer.detach();
      if (!viewer.closed) return;
      // Once the dialog's own focus handling has let go.
      const focus = viewer.focusAfterClose();
      if (focus) requestAnimationFrame(() => focus.focus({ preventScroll: true }));
    };
  }, [popup, viewer]);

  // oxlint-disable-next-line t3code/react-effect-budget -- Report the item's measured or unavailable size to the imperative viewer before paint.
  useLayoutEffect(() => {
    if (key === null) return;
    if (failed) viewer.measured(key, UNAVAILABLE_SIZE);
    else if (resolved.size) viewer.measured(key, resolved.size);
  }, [viewer, key, failed, resolved.size]);

  // oxlint-disable-next-line t3code/react-effect-budget -- Sync the imperative viewer with this render's items, index, source and scope before paint.
  useLayoutEffect(() => {
    viewer.sync({ items, index, src: resolved.src, scope });
  });

  const name = item?.name ?? "";
  const neighbours = [items[index - 1], items[index + 1]].filter(
    (neighbour): neighbour is MediaItem => neighbour !== undefined,
  );

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) viewer.close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Popup
          ref={(node: HTMLDivElement | null) => {
            popupRef.current = node;
            setPopup(node);
          }}
          {...composerFloatingLayerProps}
          {...keybindingCaptureProps}
          data-stemcells-media=""
          initialFocus={popupRef}
          finalFocus={false}
        >
          <div ref={scrimRef} data-stemcells-media-scrim="" aria-hidden="true" />
          <Dialog.Title className="sr-only">{name}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {count > 1
              ? `${index + 1} of ${count}. The left and right arrow keys move through this chat's pictures and videos; Escape closes.`
              : "Escape closes."}
          </Dialog.Description>
          <div ref={figureRef} data-stemcells-media-figure={item?.type ?? "image"}>
            {item && key ? (
              <OnStage
                key={at.step}
                item={item}
                src={resolved.src}
                refresh={resolved.refresh}
                failed={failed}
                onFailed={() => setFailedKey(key)}
              />
            ) : null}
          </div>
          <div ref={captionRef} data-stemcells-media-caption="" aria-hidden="true">
            <span data-stemcells-media-name="">{name}</span>
            {count > 1 ? (
              <span data-stemcells-media-count="">
                {index + 1} / {count}
              </span>
            ) : null}
          </div>
          <Dialog.Close data-stemcells-media-close="">Close</Dialog.Close>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {count > 1 ? `${name}, ${index + 1} of ${count}` : ""}
          </span>
          {neighbours.map((neighbour) => (
            <Ahead key={itemKey(neighbour)} item={neighbour} viewer={viewer} />
          ))}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ResolvedMedia {
  /** The item's URL now (an asset's is fetched, as its thumbnail's was). */
  readonly src: string | null;
  readonly failed: boolean;
  /** Its size, when the server knows it. */
  readonly size: Size | null;
  /** Asks again by the item's stored file for a newly signed URL (none: it has no stored file). */
  readonly refresh: () => Promise<unknown>;
}

function useResolvedMedia(item: MediaItem | undefined): ResolvedMedia {
  // A picture still sending shows from memory; there is nothing stored to fetch yet.
  const local = item?.src != null && /^(?:blob|data):/.test(item.src);
  const asset = local ? null : (item?.actionsSource?.asset ?? null);
  const state = useAssetUrlState(asset?.environmentId ?? null, asset?.resource ?? null);
  const refresh = useAssetUrlRefresh(asset?.environmentId ?? null, asset?.resource ?? null);
  if (item === undefined) return { src: null, failed: true, size: null, refresh };
  if (asset === null) return { src: item.src, failed: item.src === null, size: null, refresh };
  if (state._tag === "Success") {
    return {
      src: state.url + (item.srcFragment ?? ""),
      failed: false,
      size: state.imageDimensions ?? null,
      refresh,
    };
  }
  return {
    src: item.src,
    failed: state._tag === "Failure" && item.src === null,
    size: null,
    refresh,
  };
}

/**
 * The item on stage, drawn by upstream's pieces: its picture or player, and its context menu.
 * `src` is the item's URL now; what acts on the item (copy, save, seeking, a retry) goes by
 * that or by its stored file, never by a URL kept from before, which may have expired or
 * been revoked since.
 */
function OnStage(props: {
  item: MediaItem;
  src: string | null;
  refresh: () => Promise<unknown>;
  failed: boolean;
  onFailed: () => void;
}) {
  const { item } = props;
  // A picture draws by the first URL it had: a re-signed one would load it again.
  const [drawnSrc, setDrawnSrc] = useState(props.src);
  if (drawnSrc === null && props.src !== null) setDrawnSrc(props.src);
  // The menu mints the stored file's URL afresh when it acts; with none, it takes the URL now.
  const actions = {
    ...(item.actionsSource ?? { kind: item.type === "video" ? "video" : "image", name: item.name }),
    src: props.src,
  } as const;
  if (item.type === "video") {
    // The player keeps its URL while it plays, and moves to the newest when that one fails.
    return (
      <MediaVideoPlayer
        src={props.src}
        onRetry={props.refresh}
        sourceFailed={props.failed}
        label={item.name}
        originalUrl={item.originalUrl}
        preload="metadata"
        autoPlay
        className="block size-full"
        videoClassName="aspect-auto size-full max-h-none object-contain"
        stateClassName="aspect-auto size-full min-h-0"
        actionsSource={actions}
      />
    );
  }
  if (props.failed) {
    return (
      <div role="alert" data-stemcells-media-unavailable="">
        Image unavailable. The file may have been moved or deleted.
      </div>
    );
  }
  if (drawnSrc === null) return null;
  return (
    <MediaActions source={actions}>
      <AttachmentImage
        name={item.name}
        mimeType={item.mimeType}
        src={drawnSrc}
        alt={item.name}
        decoding="sync"
        draggable={false}
        data-stemcells-media-picture=""
        // A URL that fails to draw (revoked, expired) gives way to the newest.
        onError={() =>
          props.src !== null && props.src !== drawnSrc ? setDrawnSrc(props.src) : props.onFailed()
        }
      />
    </MediaActions>
  );
}

/** A neighbour, fetched and decoded ahead, so stepping to it shows it at once. */
function Ahead(props: { item: MediaItem; viewer: Viewer }) {
  const { item, viewer } = props;
  const key = itemKey(item);
  const { src, size } = useResolvedMedia(item);
  const isVideo = item.type === "video";
  // oxlint-disable-next-line t3code/react-effect-budget -- Report the resolved media size to the imperative viewer when it changes.
  useEffect(() => {
    if (size) viewer.measured(key, size);
  }, [viewer, key, size]);
  // oxlint-disable-next-line t3code/react-effect-budget -- Probe the media's natural size off-DOM and drop the probe when the source changes or unmounts.
  useEffect(() => {
    if (src === null) return;
    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const onMetadata = () =>
        viewer.measured(key, { width: video.videoWidth, height: video.videoHeight });
      video.addEventListener("loadedmetadata", onMetadata);
      video.src = src;
      return () => {
        video.removeEventListener("loadedmetadata", onMetadata);
        video.removeAttribute("src");
        video.load();
      };
    }
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    let live = true;
    image.decode().then(
      () => {
        if (live) viewer.measured(key, { width: image.naturalWidth, height: image.naturalHeight });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [viewer, key, src, isVideo]);
  return null;
}
