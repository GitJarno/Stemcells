// @effect-diagnostics nodeBuiltinImport:off - reads the server's route on disk.
/**
 * What carrying pictures and files between chats (`stemcells/payloads/`,
 * through `payloads.ts`) relies on in upstream. A failure here after a sync
 * names the contract that moved, and what a carried file would then do.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import composerEditor from "../../components/ComposerPromptEditorTiptap.tsx?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import composerMentionDrag from "../../components/chat/composerMentionDrag.ts?raw";
import composerStash from "../../components/chat/useComposerStash.ts?raw";
import mediaActions from "../../components/media/MediaActions.tsx?raw";
import sidebarThreadRow from "../../components/sidebar/SidebarThreadRow.tsx?raw";
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
    expect(composerStash).toMatch(
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

/**
 * What a carry dropped on a chat (`payloads/drop.ts`, through the `workspaceFileDrop`
 * substitute) relies on: it lands as files off the disk do.
 */
describe("a carry's contracts with upstream's drop", () => {
  it("a chat hands what its drop target takes to its composer's intake", () => {
    // Otherwise a carried file would skip the checks, previews and upload a dropped one gets.
    expect(chatView).toMatch(
      /const addDroppedFilesToComposer = useStableCallback\(\s*\(files[^)]*\) =>\s*composerRef\.current\?\.addDroppedFiles\(files\)/,
    );
    expect(chatView).toMatch(
      /makeWorkspaceFileDropHandlers\(\{\s*setDragActive: setIsWorkspaceFileDragActive,\s*addFiles: addDroppedFilesToComposer,/,
    );
    expect(chatComposer).toMatch(
      /addDroppedFiles: \(files: File\[\]\) => \{\s*void addComposerAttachments\(files\)/,
    );
  });

  it("the composer's own drag handlers claim only theirs, leaving a carry to the chat", () => {
    // Otherwise a carry let go over the composer would be taken for a mention.
    expect(composerMentionDrag).toMatch(
      /return \(\s*types\.includes\(COMPOSER_MENTION_DRAG_TYPE\) \|\| types\.includes\(COMPOSER_PULL_REQUEST_DRAG_TYPE\)\s*\);/,
    );
  });

  it("the composer's editor takes no drop of its own, so a carry with no text passes through", () => {
    // A carry clears a picture's own address and markup; an editor that took drops itself
    // would still claim one, and a drop cursor would promise text where a file lands.
    expect(composerEditor).toContain("dropcursor: false,");
    expect(composerEditor).not.toMatch(/handleDrop|handleDOMEvents/);
  });

  it("a sidebar row takes a drop on the element that names its chat by its key", () => {
    // Otherwise a chip let go over its own chat's row would go back into that chat.
    expect(sidebarThreadRow).toContain("const threadKey = scopedThreadKey(threadRef);");
    expect(sidebarThreadRow).toMatch(
      /<li\s+data-thread-item=\{threadKey\}\s+\{\.\.\.sortableRootProps\}\s+\{\.\.\.\(fileDropHandlers \?\? \{\}\)\}/,
    );
  });

  it("media actions draw their child as the element itself, so a carry's handlers reach it", () => {
    expect(mediaActions).toMatch(/<TooltipTrigger\s+render=\{children\}/);
  });
});
