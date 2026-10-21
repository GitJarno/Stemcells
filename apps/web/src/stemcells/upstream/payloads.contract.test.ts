// @effect-diagnostics nodeBuiltinImport:off - reads the server's route on disk.
/**
 * What carrying pictures and files between chats (`stemcells/payloads/`,
 * through `payloads.ts`) relies on in upstream. A failure here after a sync
 * names the contract that moved, and what a carried file would then do.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import composerDraftStore from "../../composerDraftStore.ts?raw";
import uploadQueue from "../../lib/attachmentUploadQueue.ts?raw";
import { IMPORT_PATH } from "../payloads/land";

describe("carried pictures' and files' contracts with upstream", () => {
  it("a chat's composer uploads every chip its draft holds, so a landed copy needs no upload of its own", () => {
    // Otherwise a carried picture or file would sit in the draft unsent-able.
    expect(chatComposer).toMatch(
      /const uploadableAttachments = \[\.\.\.composerImages, \.\.\.uploadableFiles\];\s*for \(const attachment of uploadableAttachments\) \{[\s\S]{0,200}?startAttachmentUpload\(\{\s*environmentId,\s*image: attachment,/,
    );
  });

  it("a chip naming an upload on its machine is verified, not uploaded again", () => {
    // Otherwise a server-made copy (a video carried from a chat) would be asked for bytes the page never had.
    expect(uploadQueue).toMatch(
      /input\.image\.type === "file" &&\s*input\.image\.uploadEnvironmentId === input\.environmentId &&\s*input\.image\.uploadedAttachmentId\s*\? \{ persistedAttachmentId: input\.image\.uploadedAttachmentId \}/,
    );
  });

  it("removing a picture revokes its blob URL, so a copy takes a URL of its own", () => {
    // Otherwise the source letting go of a moved picture would blank its copy's thumbnail.
    expect(composerDraftStore).toMatch(
      /removeImage: \(threadRef, imageId\) => \{[\s\S]{0,700}?revokeObjectPreviewUrl\(removedImage\.previewUrl\)/,
    );
    expect(composerDraftStore).toMatch(
      /if \(!previewUrl\.startsWith\("blob:"\)\) \{\s*return;\s*\}\s*URL\.revokeObjectURL\(previewUrl\);/,
    );
  });

  it("a draft keeps out a picture it already has by name, type and size, which landing reports", () => {
    expect(composerDraftStore).toContain(
      "return `${image.mimeType}\\u0000${image.sizeBytes}\\u0000${image.name}`;",
    );
  });

  it("restoring a stash refuses files stashed on another machine, as `accepts` says first", () => {
    expect(chatComposer).toMatch(
      /const restoreStashEntry = async \(menuEntry: PromptStashEntry\) => \{\s*const filesToVerify = menuEntry\.files \?\? \[\];\s*if \(filesToVerify\.some\(\(file\) => file\.environmentId !== environmentId\)\)/,
    );
  });

  it("landing posts to the route the server mounts", () => {
    const route = NodeFS.readFileSync(
      new URL("../../../../server/src/stemcells/attachments/http.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain(`export const IMPORT_PATH = "${IMPORT_PATH}";`);
  });
});
