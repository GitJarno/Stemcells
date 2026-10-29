import type {
  ComposerContextId,
  ComposerContextKind,
  ComposerContextRecord,
} from "@t3tools/contracts";
import { formatComposerContextHref } from "@t3tools/shared/composerContextReferences";
import { describe, expect, it } from "vite-plus/test";

import { mediaLinkLabel } from "./attachments";

const attached = (contextId: string, kind: "image" | "file", name: string, mimeType: string) =>
  ({
    version: 1,
    kind,
    contextId,
    label: name,
    attachmentId: contextId,
    name,
    mimeType,
    sizeBytes: 1,
  }) as ComposerContextRecord;

describe("a message's chips on the phone", () => {
  it("number its pictures and videos as its tiles do, and leave a file's chip as it was", () => {
    const records = [
      { version: 1, kind: "terminal", contextId: "t" } as unknown as ComposerContextRecord,
      attached("s", "image", "preview-annotation-a.png", "image/png"),
      attached("a", "image", "308E5680-D1C2.jpeg", "image/jpeg"),
      attached("b", "file", "IMG_0042.MOV", "video/quicktime"),
      attached("c", "file", "report.pdf", "application/pdf"),
      attached("d", "file", "Screenshot.png", "image/png"),
    ];
    const label = (kind: ComposerContextKind, contextId: string) =>
      mediaLinkLabel(formatComposerContextHref(kind, contextId as ComposerContextId), records);
    expect(label("image", "a")).toBe("Image 1");
    expect(label("file", "b")).toBe("Video 1");
    expect(label("file", "d")).toBe("Image 2");
    expect(label("file", "c")).toBeUndefined();
    expect(label("image", "s")).toBeUndefined();
  });
});
