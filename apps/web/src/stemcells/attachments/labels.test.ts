import { describe, expect, it } from "vite-plus/test";

import { attachmentLabels, type KindedAttachment } from "./labels";

describe("attachmentLabels", () => {
  it("numbers pictures and videos by kind, in order, and keeps a file's name", () => {
    const attachments: KindedAttachment[] = [
      { id: "v1", name: "IMG_0042.MOV", kind: "video" },
      { id: "i1", name: "308E5680-D1C2.jpeg", kind: "image" },
      { id: "f1", name: "report.pdf", kind: "file" },
      { id: "s1", name: "preview-annotation-a.png", kind: null },
      { id: "i2", name: "Screenshot 2026-10-29 at 16.28.07.png", kind: "image" },
      { id: "v2", name: "clip.mp4", kind: "video" },
      { id: "i1", name: "308E5680-D1C2.jpeg", kind: "image" },
    ];
    expect(Object.fromEntries(attachmentLabels(attachments))).toEqual({
      v1: "Video 1",
      i1: "Image 1",
      f1: "report.pdf",
      i2: "Image 2",
      v2: "Video 2",
    });
  });
});
