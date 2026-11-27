// Which content each host file's signed URL names, so a second Share of an unchanged file reuses
// the copy already downloaded (`downloads.ts`). A URL is signed anew on every mint, so it can't be
// the key itself; the server's `fileRevision` (device, inode, size and times) names the bytes.
import type { AssetResource, EnvironmentId } from "../upstream/share";

/** The latest mints remembered; a share downloads the URL it has just minted. */
const MINTS_KEPT = 32;
const mints = new Map<string, string>();

/** An object's keys in one order, whichever order a view built the resource in. */
const canonical = (value: unknown) =>
  JSON.stringify(value, (_key, field: unknown) =>
    field !== null && typeof field === "object" && !Array.isArray(field)
      ? Object.fromEntries(Object.entries(field).sort(([a], [b]) => (a < b ? -1 : 1)))
      : field,
  );

/** Names one version of a file's bytes; null when the server can't vouch they haven't changed. */
export function contentKeyOf(
  environmentId: EnvironmentId,
  resource: AssetResource,
  fileRevision: string | undefined,
): string | null {
  // Upstream gives an attachment new bytes only under a new id (`chatAttachmentStableKey`).
  const revision = resource._tag === "attachment" ? "attachment" : fileRevision;
  return revision === undefined ? null : canonical([environmentId, resource, revision]);
}

/** A seam in `state/assets.ts`: notes what a freshly minted URL names, and hands the URL back. */
export function minted(
  environmentId: EnvironmentId,
  resource: AssetResource,
  state: { readonly url: string; readonly fileRevision?: string },
): string {
  const key = contentKeyOf(environmentId, resource, state.fileRevision);
  mints.delete(state.url);
  if (key !== null) mints.set(state.url, key);
  if (mints.size > MINTS_KEPT) mints.delete(mints.keys().next().value!);
  return state.url;
}

export const contentKeyOfUrl = (url: string): string | null => mints.get(url) ?? null;
