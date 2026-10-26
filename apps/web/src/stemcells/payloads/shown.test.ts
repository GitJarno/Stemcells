/**
 * What a chat shows, as something carried: by the file it names, never by
 * the signed URL it happens to show it by (which expires), and nothing for
 * a picture still only in the page.
 */
import { describe, expect, it } from "vite-plus/test";

import type { MediaItem } from "../upstream/media";
import { shownOfAttachment, shownOfMedia } from "./shown";

const HERE = "machine-here";

describe("a picture or video a chat shows, carried", () => {
  it("names the stored file, not the URL it is shown by", () => {
    const item: MediaItem = {
      src: "http://127.0.0.1:3773/api/assets/token/sky.png",
      name: "sky.png",
      mimeType: "image/png",
      actionsSource: {
        kind: "image",
        name: "sky.png",
        src: "http://127.0.0.1:3773/api/assets/token/sky.png",
        asset: {
          environmentId: HERE as never,
          resource: { _tag: "attachment", attachmentId: "thread-1-sky" },
        },
      },
    };
    expect(shownOfMedia(item)).toEqual({
      name: "sky.png",
      kind: "image",
      mimeType: "image/png",
      sizeBytes: null,
      asset: {
        environmentId: HERE,
        resource: { _tag: "attachment", attachmentId: "thread-1-sky" },
      },
      url: null,
    });
  });

  it("from the web, is its address, its picture type read from its name when nobody said", () => {
    const item: MediaItem = {
      src: "https://pictures.example.com/chart.webp",
      name: "chart.webp",
      originalUrl: "https://pictures.example.com/chart.webp",
    };
    expect(shownOfMedia(item)).toMatchObject({
      kind: "image",
      mimeType: "image/webp",
      asset: null,
      url: "https://pictures.example.com/chart.webp",
    });
  });

  it("a video stays a video", () => {
    const item: MediaItem = {
      src: null,
      name: "run.mp4",
      type: "video",
      mimeType: "video/mp4",
      actionsSource: {
        kind: "video",
        name: "run.mp4",
        src: null,
        asset: {
          environmentId: HERE as never,
          resource: {
            _tag: "media-file",
            threadId: "thread-1" as never,
            path: "/Users/example/run.mp4",
          },
        },
      },
    };
    expect(shownOfMedia(item)).toMatchObject({ kind: "video", mimeType: "video/mp4" });
  });

  it("still sending, is nothing to carry: only the page has it", () => {
    expect(
      shownOfMedia({ src: "blob:sending", name: "draft.png", mimeType: "image/png" }),
    ).toBeNull();
  });
});

describe("a file a message holds, carried", () => {
  it("names its attachment on the chat's machine, with the size the message said", () => {
    expect(
      shownOfAttachment(HERE, {
        id: "thread-1-notes-pdf",
        name: "notes.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      }),
    ).toEqual({
      name: "notes.pdf",
      kind: "file",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      asset: {
        environmentId: HERE,
        resource: { _tag: "attachment", attachmentId: "thread-1-notes-pdf" },
      },
      url: null,
    });
    expect(
      shownOfAttachment(HERE, { id: "v", name: "run.mp4", mimeType: "video/mp4", sizeBytes: 9 })
        .kind,
    ).toBe("video");
    expect(
      shownOfAttachment(HERE, { id: "p", name: "sky.png", mimeType: "image/png", sizeBytes: 9 })
        .kind,
    ).toBe("image");
  });
});
