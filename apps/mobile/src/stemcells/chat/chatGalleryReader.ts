import { createContext } from "react";

import type { FilePreviewItem, FilePreviewSource } from "../upstream/gallery";

/** The pages a tapped picture opens among in this chat, or null to keep upstream's. */
export const ChatGalleryReader = createContext<
  ((source: FilePreviewSource) => FilePreviewItem[] | null) | null
>(null);
