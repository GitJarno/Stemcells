/**
 * What makes a picture, video or file draggable where a chat shows it: a composer's chip, a sent
 * message's attachment, or media a transcript shows. Upstream's views take these at their seams
 * (`upstream/seams/chat.ts`) and through the media actions' substitute.
 */
import type { DragEvent } from "react";

import { type Attached, type Chip, chatKeyOf, type ChatTarget } from "../upstream/payloads";
import { startCarry, type Pickup } from "./carry";
import type { Shown } from "./payload";
import { kindOfType, shownOfAttachment } from "./shown";

export interface CarryProps {
  readonly draggable?: true;
  readonly onDragStart?: (event: DragEvent<HTMLElement>) => void;
}

const NONE: CarryProps = {};

function carrying(pickup: Pickup): Required<CarryProps> {
  return {
    draggable: true,
    onDragStart: (event) => {
      // The innermost thing picked up is what's carried, not a draggable around it.
      event.stopPropagation();
      startCarry(event, pickup);
    },
  };
}

/** A composer's chip; one still being made ready, or that must be attached again, stays put. */
export function chipCarry(chip: Chip | null, chat: ChatTarget): CarryProps {
  if (chip === null) return NONE;
  const fromChat = chatKeyOf(chat);
  if (chip.type === "image" || chip.file !== null) {
    const item: Shown = {
      name: chip.name,
      kind: kindOfType(chip.mimeType),
      mimeType: chip.mimeType,
      sizeBytes: chip.sizeBytes,
      asset: null,
      url: null,
    };
    return carrying({ items: [item], files: [chip.file], fromChat });
  }
  if (chip.uploadedAttachmentId === undefined || chip.uploadEnvironmentId === undefined)
    return NONE;
  const item = shownOfAttachment(chip.uploadEnvironmentId, {
    ...chip,
    id: chip.uploadedAttachmentId,
  });
  return carrying({ items: [item], fromChat });
}

/** A picture or file a sent message holds, on its chat's machine; one it can't give stays put. */
export function attachedCarry(environmentId: string, attached: Attached | null): CarryProps {
  if (attached === null || (attached.type === "file" && attached.downloadable === false))
    return NONE;
  return carrying({
    items: [shownOfAttachment(environmentId, attached)],
    downloadUrl: attached.previewUrl ?? null,
  });
}

/** Media a transcript shows (`shown.ts`), and where the browser can download it. */
export function shownCarry(item: Shown, downloadUrl: string | null): Required<CarryProps> {
  return carrying({ items: [item], downloadUrl });
}
