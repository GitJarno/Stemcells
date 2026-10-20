/**
 * Upstream's media as the media viewer reads it: what a chat shows as
 * pictures and videos (its timeline's messages, their attachments and the
 * media their markdown embeds), how a click opens one, and the pieces that
 * draw one (the video player, the media's context menu, asset URLs).
 * `media.contract.test.ts` pins what the viewer relies on.
 */
import { useAtomValue } from "@effect/atom-react";
import { resolveMediaSource } from "@t3tools/client-runtime/media-source";
import type { AssetResource, EnvironmentId, ThreadId } from "@t3tools/contracts";
import { parseComposerContextHref } from "@t3tools/shared/composerContextReferences";
import {
  isWindowsDrivePathHref,
  normalizeMarkdownLinkDestination,
} from "@t3tools/shared/markdownLinks";
import { CHAT_MARKDOWN_REMARK_PLUGINS } from "@t3tools/shared/markdownPipeline";
import { defaultUrlTransform } from "react-markdown";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { useAssetUrlState, useAssetUrls } from "../../assets/assetUrls";
import { expandedImagePreviewAtom } from "../../components/chat/ExpandedImageDialog";
import {
  buildAttachmentVideoPreview,
  type ExpandedImageItem,
  type ExpandedImagePreview,
} from "../../components/chat/ExpandedImagePreview";
import { resolveExternalWebLinkHost } from "../../components/chat/externalLinkContextMenu";
import { markdownImageItems } from "../../components/chat/markdownImageGallery";
import { resolveProtocolRelativeMediaUrl } from "../../components/media/mediaContent";
import { rewriteMarkdownFileUriHref } from "../../markdown-links";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { selectMessageImageResources, type TimelineEntry } from "../../session-logic";
import { isFileAttachment, isImageAttachment, isVideoAttachment } from "../../types";

export { AttachmentImage } from "../../components/media/AttachmentImage";
export { composerFloatingLayerProps } from "../../components/chat/composerEventScope";
/** Whether this chat's pane is the one that answers the window's keys (the focused pane). */
export { useOwnsChatWindowInput } from "../../components/chat/chatWindowInput";
export { MediaActions } from "../../components/media/MediaActions";
export { MediaVideoPlayer } from "../../components/media/MediaVideoPlayer";
export { isContextMenuOpen } from "../../contextMenuFallback";
export { windowControlsOverlayHeight } from "../../lib/windowControlsOverlay";
export { useAssetUrlState };

/** One picture or video, as upstream's viewer takes it. */
export type MediaItem = ExpandedImageItem;
/** What a click opens: a list of items and the one clicked. */
export type MediaPreview = ExpandedImagePreview;
export type TimelineEntries = ReadonlyArray<TimelineEntry>;
export type { AssetResource };

/**
 * Upstream's mark on an element that takes the keyboard for itself: the
 * app's root shortcuts (the sidebar, history, reopening a view) stand down
 * for keys inside it.
 */
export const keybindingCaptureProps = { "data-keybinding-capture": "" } as const;

/** Each row of a chat's timeline: where the chat's own thumbnails are, apart from its composer and side panel. */
export const TIMELINE_ROW = "[data-timeline-row-id]";

/** Where a chat's media paths resolve: its environment, its thread, its working folder. */
export interface ChatPlace {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly cwd: string | undefined;
}

/**
 * What upstream's `openExpandedImagePreview` opened for the chat
 * `threadKey`: every thumbnail in a chat opens through it. Null when nothing
 * is open there.
 */
export function useOpenedMedia(threadKey: string): MediaPreview | null {
  const opened = useAtomValue(expandedImagePreviewAtom);
  return opened?.threadKey === threadKey ? opened.preview : null;
}

/** Closes what is open for `threadKey`, if anything still is. */
export function closeOpenedMedia(threadKey: string): void {
  if (appAtomRegistry.get(expandedImagePreviewAtom)?.threadKey === threadKey) {
    appAtomRegistry.set(expandedImagePreviewAtom, null);
  }
}

/** The item a markdown picture on screen stands for, as it registered itself. */
export function registeredMediaItem(element: Element): MediaItem | undefined {
  return markdownImageItems.get(element);
}

/**
 * The pictures attached to the chat's messages. A message row resolves
 * their URLs itself (`selectMessageImageResources`), so the viewer asks for
 * the same ones and shares the answers.
 */
export function attachedPictureResources(entries: TimelineEntries): AssetResource[] {
  return entries.flatMap((entry) =>
    entry.kind === "message" ? selectMessageImageResources(entry.message.attachments) : [],
  );
}

/** The URLs of `resources` (null until one resolves), as the message rows read them. */
export function useAttachedPictureUrls(
  environmentId: EnvironmentId,
  resources: readonly AssetResource[],
): ReadonlyArray<string | null> {
  return useAssetUrls(environmentId, resources);
}

/**
 * A message's or a plan's markdown, as the reel reads it: `id` names whose
 * it is, and `settled` is false while a Cell is still writing it.
 */
export interface MarkdownText {
  readonly id: string;
  readonly markdown: string;
  readonly settled: boolean;
}

/**
 * One of a chat's pictures or videos. An attachment also says where it sits
 * (`at`: its message and its place among the attachments), which stays the
 * same while its URL and stored id don't: a sending picture's blob becomes
 * the stored file's URL, the server gives it its stored id, and the URL is
 * re-signed now and then.
 */
export interface ChatMedia {
  readonly item: MediaItem;
  readonly at?: string;
}

/**
 * A timeline entry's media in the order its row shows them: a message's
 * pictures, then its videos, then what its text embeds; a proposed plan's
 * embedded media. `pictureUrl` gives an attached picture's resolved URL.
 */
export function entryMedia(
  entry: TimelineEntry,
  place: ChatPlace,
  pictureUrl: (attachmentId: string) => string | undefined,
  markdownSources: (text: MarkdownText) => readonly string[],
): ChatMedia[] {
  if (entry.kind === "proposed-plan") {
    const plan = entry.proposedPlan;
    const text = { id: `plan:${plan.id}`, markdown: plan.planMarkdown, settled: true };
    return markdownMedia(markdownSources(text), place);
  }
  if (entry.kind !== "message") return [];
  const message = entry.message;
  const attached = (message.attachments ?? []).map((attachment, index) => ({
    attachment,
    at: `message:${message.id}:${index}`,
  }));
  const pictures = attached.flatMap(({ attachment: image, at }): ChatMedia[] => {
    // Annotated previews show as context, not in the message's pictures.
    if (!isImageAttachment(image) || image.name.startsWith("preview-annotation-")) return [];
    const src = image.previewUrl ?? pictureUrl(image.id) ?? null;
    const item: MediaItem = {
      src,
      name: image.name,
      mimeType: image.mimeType,
      ...(image.source?.kind === "snap-shot" ? { source: image.source } : {}),
      // The stored file, which the viewer fetches when the URL isn't known yet.
      actionsSource: {
        kind: "image",
        name: image.name,
        src,
        asset: {
          environmentId: place.environmentId,
          resource: { _tag: "attachment", attachmentId: image.id },
        },
      },
    };
    return [{ item, at }];
  });
  const videos = attached.flatMap(({ attachment: file, at }): ChatMedia[] => {
    if (!isFileAttachment(file) || !isVideoAttachment(file)) return [];
    return (buildAttachmentVideoPreview(place.environmentId, file)?.images ?? []).map((item) => ({
      item,
      at,
    }));
  });
  const text = { id: `message:${message.id}`, markdown: message.text, settled: !message.streaming };
  return [...pictures, ...videos, ...markdownMedia(markdownSources(text), place)];
}

const markdownProcessor = unified().use(remarkParse).use(CHAT_MARKDOWN_REMARK_PLUGINS).freeze();

interface MarkdownNode {
  readonly type: string;
  readonly url?: string;
  readonly value?: string;
  readonly identifier?: string;
  readonly children?: readonly MarkdownNode[];
}

const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/**
 * The sources of the pictures and videos a message's markdown embeds, in
 * order, read with the chat's own markdown plugins: image syntax (inline and
 * by reference) and `<img>` tags. Links to media are links, not media.
 */
export function markdownMediaSources(markdown: string): string[] {
  if (!markdown.includes("![") && !/<img\b/i.test(markdown)) return [];
  const tree = markdownProcessor.runSync(markdownProcessor.parse(markdown)) as MarkdownNode;
  const definitions = new Map<string, string>();
  const walk = (node: MarkdownNode, visit: (node: MarkdownNode) => void) => {
    visit(node);
    node.children?.forEach((child) => walk(child, visit));
  };
  walk(tree, (node) => {
    if (node.type === "definition" && node.identifier && node.url !== undefined) {
      definitions.set(node.identifier, node.url);
    }
  });
  const sources: string[] = [];
  walk(tree, (node) => {
    if (node.type === "image" && node.url) sources.push(node.url);
    if (node.type === "imageReference" && node.identifier) {
      const url = definitions.get(node.identifier);
      if (url) sources.push(url);
    }
    if (node.type === "html" && node.value) {
      for (const match of node.value.matchAll(HTML_IMAGE)) {
        const src = match[1] ?? match[2] ?? match[3];
        if (src) sources.push(src);
      }
    }
  });
  return sources;
}

/** A markdown source as the chat's picture renderer reads it (`ChatMarkdown`'s URL transform). */
function markdownHref(source: string): string {
  const href = isWindowsDrivePathHref(source)
    ? source
    : (rewriteMarkdownFileUriHref(source) ?? defaultUrlTransform(source));
  const normalized = normalizeMarkdownLinkDestination(href);
  return isWindowsDrivePathHref(source) ? normalized.replaceAll("\\", "/") : normalized;
}

function markdownMedia(sources: readonly string[], place: ChatPlace): ChatMedia[] {
  return sources.flatMap((source): ChatMedia[] => {
    const href = markdownHref(source);
    if (href === "" || parseComposerContextHref(href)) return [];
    const media = resolveMediaSource(href, {
      threadId: place.threadId,
      workspaceRoot: place.cwd,
      imageEmbed: true,
    });
    if (media === null || media.access === "unavailable") return [];
    const asset =
      media.access === "environment"
        ? { environmentId: place.environmentId, resource: media.resource }
        : undefined;
    const src = media.access === "direct" ? resolveProtocolRelativeMediaUrl(media.uri) : null;
    const originalUrl =
      media.access === "direct" && resolveExternalWebLinkHost(media.uri) !== null
        ? media.uri
        : undefined;
    const item: MediaItem = {
      src,
      name: media.name,
      mimeType: media.mimeType,
      ...(media.kind === "video" ? { type: "video" as const } : {}),
      ...(originalUrl ? { originalUrl } : {}),
      ...(media.srcFragment ? { srcFragment: media.srcFragment } : {}),
      actionsSource: {
        kind: media.kind,
        name: media.name,
        src,
        ...(media.reference ? { reference: media.reference } : {}),
        ...(asset ? { asset } : {}),
      },
    };
    return [{ item }];
  });
}
