/**
 * A message's pictures, files and chip context, taken to each Cell it starts beside the draft's
 * own, as upstream's multiple-model send does; a chip's context reaches the model only where
 * that Cell's text has the chip. Upstream lets the draft's uploads go once its Cell starts, so
 * the others upload their own, once per file per machine (`launch.contract.test.ts`).
 */
import type {
  ChatAttachment,
  EnvironmentId,
  OrchestrationMessageContext,
} from "@t3tools/contracts";
import type { UploadChatAttachment } from "@t3tools/contracts";
import { serializeLegacyContextMessage } from "@t3tools/shared/composerContextLegacySend";
import { threadContextsOutsideEnvironment } from "@t3tools/shared/composerContextReferences";

import { fileAttachmentCapabilityBlockReason } from "../../components/chat/composerAttachmentFiles";
import {
  type ComposerFileAttachment,
  type ComposerImageAttachment,
  type DraftId,
  useComposerDraftStore,
} from "../../composerDraftStore";
import {
  awaitAttachmentUploads,
  getUploadedAttachments,
  releaseDraftAttachments,
  startAttachmentUpload,
} from "../../lib/attachmentUploadQueue";
import { buildMessageContext } from "../../lib/composerContextRecords";
import { readFileAsDataUrl } from "../../lib/imageCompression";
import { filterTerminalContextsWithText } from "../../lib/terminalContext";
import { randomUUID } from "../../lib/utils";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { environmentServerConfigsAtom } from "../../state/server";

type Attachment = ComposerImageAttachment | ComposerFileAttachment;

/** What a Cell's message is, with what it carries. */
export type Carried =
  | {
      readonly ok: true;
      /** The text, with the context written into it for a machine that can't take it apart. */
      readonly text: string;
      readonly attachments: ReadonlyArray<ChatAttachment | UploadChatAttachment>;
      readonly context?: OrchestrationMessageContext;
    }
  | { readonly ok: false; readonly error: string };

export interface Carry {
  /** The draft's pictures and files, as upstream titles a thread from them. */
  readonly attachments: ReadonlyArray<Attachment>;
  /** What a Cell on a machine sends with its text, or why it can't. */
  readonly to: (environmentId: string, text: string) => Promise<Carried>;
  /** Lets the Cells' uploads go, once each has started or won't. */
  readonly release: () => void;
}

/** What the draft carries, read before upstream's send clears it; null when nothing. */
export function readCarry(draftId: string): Carry | null {
  const draft = useComposerDraftStore.getState().getComposerDraft(draftId as DraftId);
  if (!draft) return null;
  const { images, files, previewAnnotations, reviewComments, threadContexts } = draft;
  const attachments: Attachment[] = [...images, ...files];
  const terminalContexts = filterTerminalContextsWithText(draft.terminalContexts);
  const records =
    terminalContexts.length +
    previewAnnotations.length +
    reviewComments.length +
    threadContexts.length;
  if (attachments.length === 0 && records === 0) return null;

  const copies: Attachment[] = [];
  const uploads = new Map<string, Promise<ChatAttachment[] | null>>();
  const uploadTo = (environmentId: EnvironmentId) => {
    let uploading = uploads.get(environmentId);
    if (uploading === undefined) {
      const own = attachments.map(copyOf);
      copies.push(...own);
      for (const image of own) startAttachmentUpload({ environmentId, image });
      uploading = awaitAttachmentUploads(own.map((copy) => copy.id)).then(() =>
        getUploadedAttachments({ environmentId, images: own }),
      );
      uploads.set(environmentId, uploading);
    }
    return uploading;
  };

  const carryTo = async (id: string, text: string): Promise<Carried> => {
    const environmentId = id as EnvironmentId;
    // Another chat is read on its own machine (upstream's send says the same).
    const stranded = threadContextsOutsideEnvironment({
      text,
      records: threadContexts,
      environmentId,
    })[0];
    if (stranded)
      return { ok: false, error: `A Cell on another machine can't read "${stranded.title}".` };
    const config = appAtomRegistry.get(environmentServerConfigsAtom).get(environmentId) ?? null;
    const uploading = config?.environment.capabilities.attachmentUploads === true;
    const blocked = fileAttachmentCapabilityBlockReason({
      files,
      attachmentUploadsCapabilityKnown: config !== null,
      supportsAttachmentUploads: uploading,
      maxFileAttachmentBytes:
        config?.environment.capabilities.fileAttachments?.maxUploadBytes ?? null,
    });
    if (blocked !== null) return { ok: false, error: blocked };
    const kept = files.find((file) => file.file === null);
    if (kept) return { ok: false, error: `Attach ${kept.name} again to send it to more Cells.` };

    let sent: ReadonlyArray<ChatAttachment | UploadChatAttachment>;
    if (uploading) {
      const uploaded = await uploadTo(environmentId);
      if (uploaded === null) return { ok: false, error: "A file didn't upload for this Cell." };
      sent = uploaded;
    } else {
      // A machine that takes no uploads gets pictures in the message, as upstream sends them.
      sent = await Promise.all(
        images.map(async (image) => ({
          type: "image" as const,
          id: image.id,
          name: image.name,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          dataUrl: await readFileAsDataUrl(image.file),
          ...(image.source ? { source: image.source } : {}),
        })),
      );
    }
    const context = buildMessageContext({
      terminalContexts,
      reviewComments,
      previewAnnotations,
      threadContexts,
      attachments: attachments.map((attachment, index) => ({
        attachment,
        attachmentId: sent[index]?.id ?? attachment.id,
      })),
    });
    if (context === undefined) return { ok: true, text, attachments: sent };
    if (config?.environment.capabilities.inlineMessageContext !== true)
      return {
        ok: true,
        text: serializeLegacyContextMessage({ text, records: context.records }),
        attachments: sent,
      };
    return { ok: true, text, attachments: sent, context };
  };

  return {
    attachments,
    to: (id, text) =>
      carryTo(id, text).catch((error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : "What the message carries didn't go.",
      })),
    release: () => releaseDraftAttachments(copies),
  };
}

/** The same picture or file under an id of its own, so its upload is the Cells', not the draft's. */
function copyOf(attachment: Attachment): Attachment {
  if (attachment.type === "image") return { ...attachment, id: randomUUID() };
  return {
    type: "file",
    id: randomUUID(),
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    file: attachment.file,
    ...(attachment.source ? { source: attachment.source } : {}),
  };
}
