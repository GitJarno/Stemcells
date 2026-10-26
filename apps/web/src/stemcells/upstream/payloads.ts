/**
 * What carrying pictures, files and stashed prompts between chats takes from upstream: a chat's
 * draft and chips, the attachments a message holds, how a chip lets go of its upload, what each
 * machine's chats take, a file signed afresh by its machine, the stash, and an authenticated
 * request to the primary server. `payloads.contract.test.ts` pins what this relies on.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { executeAtomQuery } from "@t3tools/client-runtime/state/runtime";
import {
  AssetResource,
  isProviderSendTurnSupportedImageMimeType,
  PROVIDER_SEND_TURN_MAX_ATTACHMENTS,
  PROVIDER_SEND_TURN_MAX_FILE_BYTES,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  type EnvironmentId,
  type ThreadId,
} from "@t3tools/contracts";
import * as Option from "effect/Option";

import {
  type ComposerFileAttachment,
  type ComposerImageAttachment,
  type ComposerThreadTarget,
  type DraftId,
  type PersistedComposerFileAttachment,
  useComposerDraftStore,
} from "../../composerDraftStore";
import { resolvePrimaryEnvironmentHttpUrl } from "../../environments/primary";
import { readDesktopPrimaryBearerToken } from "../../environments/primary/desktopAuth";
import { releaseAttachmentUpload, releaseDraftAttachment } from "../../lib/attachmentUploadQueue";
import { randomUUID } from "../../lib/utils";
import { type PromptStashEntry, usePromptStashStore } from "../../promptStashStore";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { assetEnvironment } from "../../state/assets";
import { primaryEnvironmentIdAtom } from "../../state/primaryEnvironment";
import { environmentServerConfigsAtom } from "../../state/server";
import { environmentSession } from "../../state/session";
import type { ChatFileAttachment, ChatImageAttachment } from "../../types";
import type { CellRef } from "../tabs/layout";

/** The schema of what a machine's file is named by, for reading one out of a drag. */
export { AssetResource };
/** A picture or file a sent message holds. */
export type Attached = ChatImageAttachment | ChatFileAttachment;
/** A picture or file in a composer. */
export type Chip = ComposerImageAttachment | ComposerFileAttachment;
export type PictureChip = ComposerImageAttachment;
export type FileChip = ComposerFileAttachment;
export type StashEntry = PromptStashEntry;
export type StashedFile = PersistedComposerFileAttachment;

/** At most this many pictures and files go in one message. */
export const MAX_ATTACHMENTS = PROVIDER_SEND_TURN_MAX_ATTACHMENTS;
/** The most a picture in a message may be. */
export const MAX_PICTURE_BYTES = PROVIDER_SEND_TURN_MAX_IMAGE_BYTES;
/** The most any file in a message may be, on any machine. */
export const MAX_FILE_BYTES = PROVIDER_SEND_TURN_MAX_FILE_BYTES;
/** Whether a model is sent pictures of this type (the rest go as files). */
export const isPictureType = isProviderSendTurnSupportedImageMimeType;

export const newId = randomUUID;

/** What a composer writes to: its draft's id while unsent, its thread after. */
export type ChatTarget = ComposerThreadTarget;

/** A chat's key, as the sidebar marks its row with (`THREAD_ROW`). */
export const chatKeyOf = (chat: ChatTarget): string =>
  typeof chat === "string" ? chat : scopedThreadKey(chat);

/** The attribute a sidebar row names its chat by, where files dropped on it go. */
export const THREAD_ROW = "data-thread-item";

/** The draft a chat's composer writes to: its draft's id while unsent, its thread after. */
function draftOf(cell: CellRef): ComposerThreadTarget {
  return cell.draftId === null
    ? scopeThreadRef(cell.environmentId as EnvironmentId, cell.threadId as ThreadId)
    : (cell.draftId as DraftId);
}

/** The pictures and files a chat's draft holds. */
export function chipsIn(cell: CellRef): ReadonlyArray<Chip> {
  const draft = useComposerDraftStore.getState().getComposerDraft(draftOf(cell));
  return draft ? [...draft.images, ...draft.files] : [];
}

/**
 * Adds chips to a chat's draft, as upstream's composer adds what is picked
 * or dropped: files with their reference in the words. The mounted composer
 * uploads them, or verifies the upload a chip already names. The ids that
 * went in (a duplicate or a full draft keeps some out).
 */
export function addToDraft(
  cell: CellRef,
  pictures: ReadonlyArray<PictureChip>,
  files: ReadonlyArray<FileChip>,
): ReadonlyArray<string> {
  const store = useComposerDraftStore.getState();
  const target = draftOf(cell);
  return [
    ...(pictures.length > 0 ? store.addImages(target, [...pictures]) : []),
    ...(files.length > 0 ? store.addFiles(target, [...files], { appendReference: true }) : []),
  ];
}

/** A chip leaving its draft, letting go of its upload as upstream's remove button does. */
export function letGo(cell: CellRef, chip: Chip): void {
  const store = useComposerDraftStore.getState();
  if (chip.type === "image") {
    releaseAttachmentUpload(chip.id);
    store.removeImage(draftOf(cell), chip.id);
  } else {
    releaseDraftAttachment(chip);
    store.removeFile(draftOf(cell), chip.id);
  }
}

/** What a machine's chats take, as upstream's composer reads it. */
export function machineOf(environmentId: string): {
  readonly takesFiles: boolean | null;
  readonly maxFileBytes: number | null;
} {
  const config =
    appAtomRegistry.get(environmentServerConfigsAtom).get(environmentId as EnvironmentId) ?? null;
  if (config === null) return { takesFiles: null, maxFileBytes: null };
  return {
    takesFiles: config.environment.capabilities.attachmentUploads === true,
    maxFileBytes: config.environment.capabilities.fileAttachments?.maxUploadBytes ?? null,
  };
}

/** The machine this page's own server runs on. */
export function primaryMachine(): string | null {
  return appAtomRegistry.get(primaryEnvironmentIdAtom);
}

/**
 * A file a chat names, signed afresh by the machine that has it: the URL
 * as that machine issued it (relative to its server, or whole), and whole.
 * Null when the machine no longer gives it.
 */
export async function signedAsset(
  environmentId: string,
  resource: AssetResource,
): Promise<{ readonly issued: string; readonly whole: string } | null> {
  const result = await executeAtomQuery(
    appAtomRegistry,
    assetEnvironment.createUrl({
      environmentId: environmentId as EnvironmentId,
      input: { resource },
    }),
    { reportFailure: false, reportDefect: false, refresh: true },
  );
  if (result._tag !== "Success") return null;
  const issued = result.value.relativeUrl;
  const connection = Option.getOrNull(
    appAtomRegistry.get(
      environmentSession.preparedConnectionValueAtom(environmentId as EnvironmentId),
    ),
  );
  try {
    return { issued, whole: new URL(issued, connection?.httpBaseUrl).href };
  } catch {
    return null;
  }
}

/**
 * A POST of JSON to the primary machine's server: the session cookie in a
 * browser on its origin, the desktop app's bearer token otherwise.
 */
export async function postToPrimary(pathname: string, body: unknown): Promise<Response> {
  const bearerToken = await readDesktopPrimaryBearerToken();
  return fetch(resolvePrimaryEnvironmentHttpUrl(pathname), {
    method: "POST",
    credentials: bearerToken ? "omit" : "include",
    headers: {
      "content-type": "application/json",
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** The stash, newest first. */
export function stashEntries(): ReadonlyArray<StashEntry> {
  return usePromptStashStore.getState().entries;
}

/** A copy that didn't go in, letting go of what it holds: its upload, or its picture's URL. */
export function discard(chip: Chip): void {
  if (chip.type === "image") {
    if (chip.previewUrl.startsWith("blob:")) URL.revokeObjectURL(chip.previewUrl);
  } else {
    releaseDraftAttachment(chip);
  }
}
