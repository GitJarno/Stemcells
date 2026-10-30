import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { DraftComposerAttachment } from "../upstream/messageImages";
import { rememberSentImages, type SentImage, sentImages } from "./sentImages";

const mac = EnvironmentId.make("mac");

function picked(id: string, previewUri: string): DraftComposerAttachment {
  return { id, type: "image", name: `${id}.jpg`, mimeType: "image/jpeg", sizeBytes: 1, previewUri };
}

function uploaded(draft: DraftComposerAttachment, attachmentId: string): DraftComposerAttachment {
  return { ...draft, uploadedAttachmentId: attachmentId, uploadEnvironmentId: mac };
}

function sent(id: string) {
  return { type: "image" as const, id, name: `${id}.jpg`, mimeType: "image/jpeg", sizeBytes: 1 };
}

const tiles = (images: ReadonlyArray<SentImage>) =>
  images.map((image) => [image.key, image.attachmentId, image.localUri]);

describe("a sent message's pictures", () => {
  it("keep their places and this phone's own files from Send to the sent message", () => {
    const drafts = [
      picked("a", "file:///cache/a.jpg"),
      picked("b", "file:///cache/b.jpg"),
      picked("pasted", "data:image/png;base64,AAAA"),
    ];
    expect(tiles(sentImages(mac, [], drafts))).toEqual([
      ["0", null, "file:///cache/a.jpg"],
      ["1", null, "file:///cache/b.jpg"],
      ["2", null, "data:image/png;base64,AAAA"],
    ]);

    rememberSentImages(
      mac,
      sentImages(
        mac,
        [],
        [
          uploaded(drafts[0]!, "sent-a"),
          uploaded(drafts[1]!, "sent-b"),
          uploaded(drafts[2]!, "sent-pasted"),
        ],
      ),
    );
    expect(
      tiles(sentImages(mac, [sent("sent-a"), sent("sent-b"), sent("sent-pasted")], [])),
    ).toEqual([
      ["0", "sent-a", "file:///cache/a.jpg"],
      ["1", "sent-b", "file:///cache/b.jpg"],
      ["2", "sent-pasted", null],
    ]);
    expect(sentImages(EnvironmentId.make("another"), [sent("sent-a")], [])[0]?.localUri).toBeNull();
  });
});
