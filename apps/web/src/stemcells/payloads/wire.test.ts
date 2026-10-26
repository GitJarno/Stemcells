/**
 * What a carry writes on the browser's drag, and what a drop accepts back: any drag can reach a
 * chat (another app's, a web page's), so only what this app writes is read.
 */
import { describe, expect, it } from "vite-plus/test";

import { CARRIED_TYPE, type Carried, decodeCarried, encodeCarried, isCarry } from "./wire";

const carried: Carried = {
  version: 1,
  drag: "drag-1",
  items: [
    {
      name: "sky.png",
      kind: "image",
      mimeType: "image/png",
      sizeBytes: 2048,
      asset: null,
      url: "blob:http://localhost/sky",
    },
    {
      name: "notes.pdf",
      kind: "file",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      asset: {
        environmentId: "machine-here",
        resource: { _tag: "attachment", attachmentId: "thread-1-notes" },
      },
      url: null,
    },
  ],
};

describe("a carry on the browser's drag", () => {
  it("reads back as it was written", () => {
    expect(decodeCarried(encodeCarried(carried))).toEqual(carried);
  });

  it("is told from other drags by its type alone, which is all a drag over a chat shows", () => {
    expect(isCarry(["Files"])).toBe(false);
    expect(isCarry(["text/uri-list", "text/html"])).toBe(false);
    expect(isCarry([CARRIED_TYPE])).toBe(true);
  });

  it("reads nothing from data this app didn't write", () => {
    const written = JSON.parse(encodeCarried(carried)) as Record<string, unknown>;
    for (const raw of [
      "",
      "not json",
      "https://example.com/sky.png",
      JSON.stringify({ ...written, version: 2 }),
      JSON.stringify({ ...written, drag: undefined }),
      JSON.stringify({ ...written, items: [{ name: "x", kind: "folder" }] }),
      JSON.stringify({
        ...written,
        items: [{ ...carried.items[1], asset: { environmentId: "m", resource: { _tag: "nope" } } }],
      }),
    ]) {
      expect(decodeCarried(raw), raw).toBeNull();
    }
  });

  it("holds at most what one message takes", () => {
    const many = { ...carried, items: Array.from({ length: 101 }, () => carried.items[0]!) };
    expect(decodeCarried(JSON.stringify(many))).toBeNull();
  });
});
