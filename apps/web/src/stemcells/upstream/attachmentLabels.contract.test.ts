/**
 * What attachments' labels rely on in upstream: an annotated preview's screenshot is told by its
 * name, and a sent message records every attachment in order, so the phone (numbering a message's
 * chips from its records) and the Mac (from its attachments) agree.
 */
import type { PreviewAnnotationPayload } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { ComposerFileAttachment, ComposerImageAttachment } from "../../composerDraftStore";
import { buildMessageContext } from "../../lib/composerContextRecords";
import { capturePreviewAnnotationScreenshot } from "../../lib/previewAnnotation";
import { attachmentLabeller, kindOf } from "./attachmentLabels";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const image = (id: string, name: string): ComposerImageAttachment => ({
  type: "image",
  id,
  name,
  mimeType: "image/png",
  sizeBytes: 1,
  previewUrl: "",
  file: new File([], name),
});

const file = (id: string, name: string, mimeType: string): ComposerFileAttachment => ({
  type: "file",
  id,
  name,
  mimeType,
  sizeBytes: 1,
  file: null,
});

describe("attachments' labels and upstream", () => {
  it("leaves an annotated preview's screenshot unnumbered", () => {
    const capture = capturePreviewAnnotationScreenshot({
      id: "annotation-1",
      screenshot: { dataUrl: PIXEL },
    } as PreviewAnnotationPayload);
    expect(capture.status).toBe("captured");
    const screenshot = capture.status === "captured" ? capture.file : null;
    expect(kindOf(image("annotation-1", screenshot!.name))).toBeNull();
  });

  it("sends a record for every attachment, in order, so records number as attachments do", () => {
    const attachments = [
      image("a", "308E5680-D1C2.jpeg"),
      file("b", "IMG_0042.MOV", "video/quicktime"),
      file("c", "report.pdf", "application/pdf"),
      image("d", "Screenshot 2026-10-29 at 16.28.07.png"),
    ];
    const context = buildMessageContext({
      terminalContexts: [],
      reviewComments: [],
      previewAnnotations: [],
      attachments: attachments.map((attachment) => ({ attachment, attachmentId: attachment.id })),
    });
    const fromRecords = (context?.records ?? []).flatMap((record) =>
      "attachmentId" in record && (record.kind === "image" || record.kind === "file")
        ? [
            {
              id: record.attachmentId,
              type: record.kind,
              name: record.name,
              mimeType: record.mimeType,
              sizeBytes: record.sizeBytes,
            },
          ]
        : [],
    );
    const label = attachmentLabeller(attachments);
    expect(fromRecords.map((record) => record.id)).toEqual(["a", "b", "c", "d"]);
    expect(fromRecords.map((record) => attachmentLabeller(fromRecords)(record))).toEqual(
      attachments.map(label),
    );
    expect(attachments.map(label)).toEqual(["Image 1", "Video 1", "report.pdf", "Image 2"]);
  });
});
