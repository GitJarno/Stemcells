import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  attachedPictureResources,
  closeOpenedMedia,
  useAttachedPictureUrls,
  useOpenedMedia,
  useOwnsChatWindowInput,
  type ChatPlace,
  type MediaItem,
  type MediaPreview,
} from "../upstream/media";
import { useChatEntries } from "./chatEntries";
import { MediaViewer } from "./MediaViewer";
import { MarkdownSources, chatReel, itemKey, reelAround } from "./reel";
import { pressedMedia } from "./thumbnails";

/**
 * A chat's media viewer. `ChatView` renders this where it rendered
 * upstream's preview host (a seam): every thumbnail in the chat still opens
 * through upstream's `openExpandedImagePreview`, and the viewer steps
 * through the whole chat, as its timeline draws it (`chatEntries.ts`).
 */
export function ChatMediaViewerHost(props: {
  threadKey: string;
  threadRef: Pick<ChatPlace, "environmentId" | "threadId">;
  cwd: string | undefined;
}) {
  const { threadKey } = props;
  const preview = useOpenedMedia(threadKey);
  const ownsWindowInput = useOwnsChatWindowInput();
  const anchorRef = useRef<HTMLSpanElement>(null);
  // The chat's view: this host sits inside it, beside the timeline and the composer.
  const [scope, setScope] = useState<Element | null>(null);
  // oxlint-disable-next-line t3code/react-effect-budget -- Read the chat view the host's anchor sits in from the DOM after mount.
  useLayoutEffect(() => setScope(anchorRef.current?.parentElement ?? null), []);
  // oxlint-disable-next-line t3code/react-effect-budget -- Share the document's capturing pointerdown listener while mounted.
  useEffect(() => trackPresses(), []);
  // Leaving the chat drops what it had open.
  // oxlint-disable-next-line t3code/react-effect-budget -- Close the chat's opened media when the thread changes or the host unmounts.
  useEffect(() => () => closeOpenedMedia(threadKey), [threadKey]);
  const clicked = preview?.images[preview.index];
  const ownedSrc = clicked?.ownsSrc === true ? clicked.src : null;
  // oxlint-disable-next-line t3code/react-effect-budget -- Revoke the clicked preview's own object URL when it changes or unmounts.
  useEffect(() => {
    if (ownedSrc === null) return;
    return () => URL.revokeObjectURL(ownedSrc);
  }, [ownedSrc]);

  return (
    <>
      <span ref={anchorRef} hidden />
      {preview && clicked ? (
        <OpenedMedia
          key={`${itemKey(clicked)}:${preview.index}`}
          preview={preview}
          clicked={clicked}
          place={props.threadRef}
          cwd={props.cwd}
          threadKey={threadKey}
          scope={scope}
          ownsWindowInput={ownsWindowInput}
          onClosed={() => closeOpenedMedia(threadKey)}
        />
      ) : null}
    </>
  );
}

function OpenedMedia(props: {
  preview: MediaPreview;
  clicked: MediaItem;
  place: Pick<ChatPlace, "environmentId" | "threadId">;
  cwd: string | undefined;
  threadKey: string;
  scope: Element | null;
  ownsWindowInput: boolean;
  onClosed: () => void;
}) {
  // Read as the click lands, before the dialog takes focus.
  const [opened] = useState(() => {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return {
      source: pressedMedia(recentPress()) ?? pressedMedia(focused),
      opener: focused,
    };
  });
  const { environmentId, threadId } = props.place;
  const entries = useChatEntries(props.threadKey);
  const resources = attachedPictureResources(entries);
  const urls = useAttachedPictureUrls(environmentId, resources);
  // Each message's markdown is read once it settles, however often the chat streams.
  const [sources] = useState(() => new MarkdownSources());
  const urlById = new Map<string, string>();
  resources.forEach((resource, index) => {
    const url = urls[index];
    if (resource._tag === "attachment" && url) urlById.set(resource.attachmentId, url);
  });
  const reel = chatReel(
    entries,
    { environmentId, threadId, cwd: props.cwd },
    (id) => urlById.get(id),
    sources.of,
  );
  sources.settle();
  const opening = reelAround(props.clicked, reel, props.preview.images);
  // The same chat open in two panes shows one viewer: where the click came
  // from, or, when no thumbnail was pressed, the focused pane's.
  const here = opened.source
    ? props.scope === null || props.scope.contains(opened.source)
    : props.ownsWindowInput;
  if (!here) return null;
  return (
    <MediaViewer
      reel={reel}
      own={props.preview.images}
      start={opening.items[opening.index]!}
      scope={props.scope}
      source={opened.source}
      opener={opened.opener}
      onClosed={props.onClosed}
    />
  );
}

/** A click counts as what opened the viewer for this long after it lands (ms). */
const PRESS_FRESH = 1000;

let lastPress: { readonly target: Element; readonly at: number } | null = null;
let tracking = 0;

function onPress(event: PointerEvent): void {
  if (event.target instanceof Element) lastPress = { target: event.target, at: performance.now() };
}

/** Remembers where the pointer last pressed, while any chat's viewer host is mounted. */
function trackPresses(): () => void {
  if (tracking === 0) document.addEventListener("pointerdown", onPress, true);
  tracking += 1;
  return () => {
    tracking -= 1;
    if (tracking === 0) {
      document.removeEventListener("pointerdown", onPress, true);
      lastPress = null;
    }
  };
}

function recentPress(): Element | null {
  const press = lastPress;
  return press && press.target.isConnected && performance.now() - press.at < PRESS_FRESH
    ? press.target
    : null;
}
