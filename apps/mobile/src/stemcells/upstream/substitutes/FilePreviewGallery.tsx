// Replaces `components/ui/FilePreviewGallery.tsx` (`substitutes.cjs`): a picture tapped in a chat
// pages through every picture in that chat (`chat/ChatGallery.tsx`), where upstream's pages
// through the tapped message's own. A list the caller gives, or a picture the chat doesn't
// hold yet, keeps upstream's.
import { useContext } from "react";

import {
  FilePreviewGallery as MessageGallery,
  useFilePreviewGallery as useMessageGallery,
} from "../../../components/ui/FilePreviewGallery";
import type { FilePreviewSource } from "../../../components/ui/FilePreviewModal.types";
import { ChatGalleryReader } from "../../chat/chatGalleryReader";

export const FilePreviewGallery = MessageGallery;

export function useFilePreviewGallery() {
  const message = useMessageGallery();
  const chat = useContext(ChatGalleryReader);
  return (source: FilePreviewSource): FilePreviewSource => {
    const gallery = source.gallery === undefined ? chat?.(source) : null;
    return gallery ? { ...source, gallery } : message(source);
  };
}
