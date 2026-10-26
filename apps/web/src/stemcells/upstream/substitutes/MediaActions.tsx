// Replaces `components/media/MediaActions.tsx` (`plugin.ts`): a picture or video a chat's
// transcript shows can be dragged into another chat (`payloads/`), as a message's attachments
// can; its menu and tooltip stay upstream's. Outside a transcript (the file viewer, a dialog) a
// press does what it did, and so does one on a player's own controls.
import { mediaReferenceFileName } from "@t3tools/client-runtime/media-reference";
import {
  cloneElement,
  type ComponentProps,
  type DragEvent,
  type PointerEvent,
  type ReactElement,
} from "react";

import {
  type MediaActionSource,
  MediaActions as UpstreamMediaActions,
} from "../../../components/media/MediaActions";
import { shownOfMedia } from "../../payloads/shown";
import { shownCarry } from "../../payloads/sources";
import { TIMELINE_ROW } from "../media";

export * from "../../../components/media/MediaActions";

interface DragHandlers {
  readonly onPointerDownCapture?: (event: PointerEvent<HTMLElement>) => void;
  readonly onDragStart?: (event: DragEvent<HTMLElement>) => void;
}

/** A press on these means their own drag: a player's scrubber, a field's selection. */
const OWN_DRAG = "audio[controls], input, textarea, select, [contenteditable]";
/**
 * A reply's player has its controls on over all of it, and Chromium draws them along its bottom:
 * the scrubber over a row of buttons. A press above them is on the picture, and carries.
 */
const PLAYER_CONTROLS_PX = 80;

const pressedOwnDrag = (target: EventTarget, clientY: number) => {
  if (!(target instanceof Element)) return false;
  if (target.closest(OWN_DRAG) !== null) return true;
  const player = target.closest("video[controls]");
  return player !== null && clientY > player.getBoundingClientRect().bottom - PLAYER_CONTROLS_PX;
};

/** The name upstream saves it by: its file's or address's own, else what the chat called it. */
const nameOf = (source: MediaActionSource) =>
  (source.reference && mediaReferenceFileName(source.reference)) || source.name || source.kind;

export function MediaActions(props: ComponentProps<typeof UpstreamMediaActions>) {
  const { source } = props;
  const item = shownOfMedia({
    src: source.src,
    name: nameOf(source),
    ...(source.kind === "video" ? { type: "video" as const } : {}),
    actionsSource: source,
  });
  if (item === null) return <UpstreamMediaActions {...props} />;
  const carry = shownCarry(item, source.src);
  const child = props.children as ReactElement<DragHandlers>;
  return (
    <UpstreamMediaActions source={source}>
      {cloneElement(child, {
        // Decided at the press, before the browser picks what a drag takes: upstream's pictures
        // say they aren't draggable, and a player's controls must keep their own drag.
        onPointerDownCapture: (event) => {
          child.props.onPointerDownCapture?.(event);
          if (event.currentTarget.closest(TIMELINE_ROW) === null) return;
          event.currentTarget.draggable = !pressedOwnDrag(event.target, event.clientY);
        },
        onDragStart: (event) => {
          child.props.onDragStart?.(event);
          if (event.currentTarget.draggable && event.currentTarget.closest(TIMELINE_ROW) !== null)
            carry.onDragStart(event);
        },
      })}
    </UpstreamMediaActions>
  );
}
