// Replaces `components/chat/workspaceFileDrop.ts` (`plugin.ts`): a chat takes pictures, videos
// and files carried from another chat as it takes files off the disk, upstream's overlay over it
// and then into its composer (`payloads/drop.ts`). The sidebar's thread rows take them the same
// way. A drag that isn't a carry goes to upstream's handlers as before.
import { makeWorkspaceFileDropHandlers as makeUpstreamHandlers } from "../../../components/chat/workspaceFileDrop";
import { appReading } from "../../payloads/app";
import { type CarryDragEvent, makeCarryDropHandlers } from "../../payloads/drop";

export * from "../../../components/chat/workspaceFileDrop";

type WorkspaceFileDropHost = Parameters<typeof makeUpstreamHandlers>[0];
type DragEvent = Parameters<ReturnType<typeof makeUpstreamHandlers>["onDrop"]>[0] & CarryDragEvent;

export function makeWorkspaceFileDropHandlers(host: WorkspaceFileDropHost) {
  const files = makeUpstreamHandlers(host);
  const carry = makeCarryDropHandlers(host, appReading);
  return {
    onDragEnter(event: DragEvent) {
      if (!carry.onDragEnter(event)) files.onDragEnter(event);
    },
    onDragOver(event: DragEvent) {
      if (!carry.onDragOver(event)) files.onDragOver(event);
    },
    onDragLeave(event: DragEvent) {
      if (!carry.onDragLeave(event)) files.onDragLeave(event);
    },
    onDrop(event: DragEvent) {
      if (!carry.onDrop(event)) files.onDrop(event);
    },
  };
}
