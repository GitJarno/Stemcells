// @effect-diagnostics nodeBuiltinImport:off - a resolved file is read through its open handle, and the store's pending bytes are counted on disk.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import type * as NodeStream from "node:stream";

import {
  PROVIDER_SEND_TURN_MAX_FILE_BYTES,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  isProviderSendTurnSupportedImageMimeType,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Mime from "effect/http/Mime";

import { resolveAttachmentRelativePath } from "../../attachmentPaths.ts";
import {
  attachmentFileExtension,
  createPendingAttachmentId,
  parseThreadSegmentFromAttachmentId,
  PENDING_ATTACHMENT_THREAD_SEGMENT,
} from "../../attachmentStore.ts";
import { ASSET_ROUTE_PREFIX, resolveAsset, type ResolvedAsset } from "../../assets/AssetAccess.ts";
import { openMediaFile } from "../../assets/MediaFile.ts";
import * as ServerConfig from "../../config.ts";

// What carrying a file into another chat takes from upstream: a pending attachment's path
// and name, the bytes waiting, a message's caps, a chat's signed asset URL read back to its
// file (opened as upstream's asset route opens one), and the HTML renderer's public-address
// check. `attachments.contract.test.ts` pins them.

/**
 * A host's addresses when every one is public (not this machine, its
 * networks, or link-local and metadata ranges); undefined otherwise. The
 * caller connects only to these.
 */
export { publicAddresses } from "../../htmlRender/publicProxy.ts";

/** The most a file in a message may be (upstream's send cap). */
export const MAX_FILE_BYTES = PROVIDER_SEND_TURN_MAX_FILE_BYTES;
/** The most a picture in a message may be. */
export const MAX_PICTURE_BYTES = PROVIDER_SEND_TURN_MAX_IMAGE_BYTES;
/** Whether a model is sent pictures of this type (the rest go as files). */
export const isPictureType = isProviderSendTurnSupportedImageMimeType;

/** The type a file's name says it is, if any. */
export function typeOfName(name: string): string | null {
  return Option.getOrNull(Mime.getType(name));
}

/** Where this server keeps attachments. */
export const attachmentsDirectory = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  return config.attachmentsDir;
});

/**
 * A new pending attachment in `attachmentsDir` for a file called `name`:
 * its id, and where its bytes go (null: nowhere safe). Upstream claims it
 * for a thread when a message naming it is sent, and sweeps it a day after
 * it was written if none is.
 */
export function pendingFile(
  attachmentsDir: string,
  name: string,
): { readonly attachmentId: string; readonly path: string } | null {
  const extension = attachmentFileExtension(name);
  const attachmentId = createPendingAttachmentId(extension);
  const path = resolveAttachmentRelativePath({
    attachmentsDir,
    relativePath: `${attachmentId}${extension}`,
  });
  return path === null ? null : { attachmentId, path };
}

/** What a signed asset URL gives: a file on this machine, read from the start. */
export interface AssetFile {
  readonly name: string;
  readonly mimeType: string | null;
  readonly size: number;
  readonly open: () => NodeStream.Readable;
}

/**
 * Runs `use` on the file a signed asset URL (`/api/assets/<token>/<name>`, or a full URL
 * ending so) names, opened as upstream's asset route opens media and read only through that
 * handle: what was checked is what is read. `use`'s signal aborts if the caller is
 * interrupted. Null unless the URL names a file this server keeps (not a tool's picture).
 */
export const withAssetFile = <A>(
  assetUrl: string,
  use: (file: AssetFile, signal: AbortSignal) => Promise<A>,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const parts = assetParts(assetUrl);
      if (parts === null) return null;
      const resolved: ResolvedAsset | null = yield* resolveAsset(parts.token, parts.relativePath);
      if (resolved === null || resolved.kind !== "file") return null;
      const asset = resolved;
      const opened = asset.file ?? (yield* openCanonical(asset.path));
      if (opened === null) return null;
      const name = asset.fileName ?? decodedName(parts.relativePath);
      const file: AssetFile = {
        name,
        mimeType: asset.mimeType ?? typeOfName(name),
        size: Number(opened.info.size),
        open: () => opened.handle.createReadStream({ start: 0, autoClose: false }),
      };
      return yield* Effect.promise((signal) => use(file, signal));
    }),
  );

/** A stored file, opened by its canonical path as upstream's callers open one; null when it won't open. */
const openCanonical = Effect.fn("StemcellsAttachments.openCanonical")(function* (path: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const canonical = yield* fileSystem.realPath(path).pipe(Effect.orElseSucceed(() => null));
  if (canonical === null) return null;
  return yield* openMediaFile(canonical).pipe(Effect.orElseSucceed(() => null));
});

/** How many bytes wait in the store unsent: pending attachments, and copies still being written. */
export async function pendingBytes(attachmentsDir: string): Promise<number> {
  const entries = await NodeFSP.readdir(attachmentsDir).catch(() => [] as string[]);
  const waiting = entries.filter((entry) => {
    if (entry.endsWith(".part")) return true;
    const dot = entry.indexOf(".");
    return (
      dot > 0 &&
      parseThreadSegmentFromAttachmentId(entry.slice(0, dot)) === PENDING_ATTACHMENT_THREAD_SEGMENT
    );
  });
  const sizes = await Promise.all(
    waiting.map((entry) =>
      NodeFSP.stat(NodePath.join(attachmentsDir, entry)).then(
        (stat) => (stat.isFile() ? stat.size : 0),
        () => 0,
      ),
    ),
  );
  return sizes.reduce((sum, size) => sum + size, 0);
}

function assetParts(assetUrl: string): { token: string; relativePath: string } | null {
  let pathname: string;
  try {
    pathname = new URL(assetUrl, "http://asset.invalid").pathname;
  } catch {
    return null;
  }
  const prefix = `${ASSET_ROUTE_PREFIX}/`;
  if (!pathname.startsWith(prefix)) return null;
  const suffix = pathname.slice(prefix.length);
  const separator = suffix.indexOf("/");
  if (separator <= 0) return null;
  return { token: suffix.slice(0, separator), relativePath: suffix.slice(separator + 1) };
}

function decodedName(relativePath: string): string {
  const last = relativePath.split("/").at(-1) ?? "";
  try {
    return decodeURIComponent(last) || "file";
  } catch {
    return "file";
  }
}
