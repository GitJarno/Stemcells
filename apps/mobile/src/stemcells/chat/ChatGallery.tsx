// Hands a chat's pictures to the viewer when one is tapped. The feed is read at the tap, so a
// streaming chat re-renders none of its pictures for it.

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import type { FilePreviewSource, ThreadFeedEntry } from "../upstream/gallery";
import { type ChatPlace, chatGallery, galleryAround } from "./pictures";
import { ChatGalleryReader } from "./chatGalleryReader";

export function ChatGallery(props: {
  readonly feed: ReadonlyArray<ThreadFeedEntry>;
  readonly place: ChatPlace;
  readonly children: ReactNode;
}) {
  const latest = useRef(props);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A tap reads the feed as committed, without the reader changing (and every picture re-rendering) per token.
  useLayoutEffect(() => {
    latest.current = props;
  });
  const [read] = useState(
    () => (source: FilePreviewSource) =>
      galleryAround(source, chatGallery(latest.current.feed, latest.current.place)),
  );
  return <ChatGalleryReader value={read}>{props.children}</ChatGalleryReader>;
}
