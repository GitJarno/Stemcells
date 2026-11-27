// Upstream's every Share of a host file, on the phone (a substitute for
// `lib/attachmentDownload.ts`'s `downloadAndShareAttachment`): the wait shows on the app's card
// with a Cancel, and a file already downloaded this session is shared again without downloading,
// while the server's revision says its bytes are the same (`mints.ts`).
import { type AttachmentPreviewFile, downloadAttachmentForPreview } from "../upstream/share";
import { contentKeyOfUrl } from "./mints";
import { beginTransfer } from "./transfer";

/** The downloads kept for another Share, at most, and their bytes together. */
const KEPT_FILES = 4;
const KEPT_BYTES = 512 * 1024 * 1024;

interface Kept {
  readonly file: AttachmentPreviewFile;
  readonly bytes: number;
}

/** In the order last used, oldest first. */
const kept = new Map<string, Kept>();

type ShareInput = Parameters<typeof downloadAttachmentForPreview>[0] & {
  readonly sourceIdentifier?: string;
};

async function fileOnDisk(uri: string): Promise<{ exists: boolean; size: number }> {
  const { File } = await import("expo-file-system");
  const file = new File(uri);
  return file.exists ? { exists: true, size: file.size } : { exists: false, size: 0 };
}

/** The kept copy of `key`, unless the system has cleared it from the cache since. */
async function keptFile(key: string): Promise<AttachmentPreviewFile | null> {
  const entry = kept.get(key);
  if (entry === undefined) return null;
  kept.delete(key);
  if (!(await fileOnDisk(entry.file.uri)).exists) {
    entry.file.dispose();
    return null;
  }
  kept.set(key, entry);
  return entry.file;
}

/** Keeps `file` for another Share; false when it's too big to keep, so the caller disposes it. */
async function keep(key: string, file: AttachmentPreviewFile): Promise<boolean> {
  const { size } = await fileOnDisk(file.uri);
  if (size > KEPT_BYTES) return false;
  const before = kept.get(key);
  if (before !== undefined && before.file !== file) before.file.dispose();
  kept.delete(key);
  kept.set(key, { file, bytes: size });
  let bytes = 0;
  for (const entry of kept.values()) bytes += entry.bytes;
  for (const [oldest, entry] of kept) {
    if (kept.size <= KEPT_FILES && bytes <= KEPT_BYTES) break;
    // Upstream's dispose keeps a file another app was handed until its own sweep.
    entry.file.dispose();
    kept.delete(oldest);
    bytes -= entry.bytes;
  }
  return true;
}

export async function downloadAndShareAttachment(input: ShareInput): Promise<void> {
  const key = contentKeyOfUrl(input.url);
  const reused = key === null ? null : await keptFile(key);
  if (reused !== null) return reused.share(input.signal, input.sourceIdentifier);
  if (input.signal.aborted) return;

  // The card's Cancel stops the download alone; the caller's signal still stops both.
  const stop = new AbortController();
  const follow = () => stop.abort();
  input.signal.addEventListener("abort", follow, { once: true });
  const transfer = beginTransfer(input.attachment.name, follow);
  let file: AttachmentPreviewFile | null;
  try {
    file = await downloadAttachmentForPreview({
      url: input.url,
      attachment: input.attachment,
      signal: stop.signal,
      onProgress: ({ bytesWritten, totalBytes }) => transfer.progress(bytesWritten, totalBytes),
    });
  } finally {
    transfer.end();
    input.signal.removeEventListener("abort", follow);
  }
  if (file === null) return;
  const keeping = key !== null && (await keep(key, file).catch(() => false));
  try {
    await file.share(input.signal, input.sourceIdentifier);
  } finally {
    if (!keeping) file.dispose();
  }
}
