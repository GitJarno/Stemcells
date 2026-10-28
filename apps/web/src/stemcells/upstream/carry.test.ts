/**
 * The Cells a message's words start beside the draft's own take what the
 * message carries. Before this they got none of it: a picture sent with
 * "Harbor and Atlas: fix the header" reached Harbor only. Each case names
 * how that could come back.
 */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  formatComposerContextReference,
  toKindScopedComposerContextId,
} from "@t3tools/shared/composerContextReferences";

const state = vi.hoisted(() => ({
  draft: null as Record<string, unknown> | null,
  configs: new Map<string, unknown>(),
  started: [] as Array<{ environmentId: string; id: string }>,
  failed: new Set<string>(),
  released: [] as string[],
}));

vi.mock("../../composerDraftStore", () => ({
  useComposerDraftStore: { getState: () => ({ getComposerDraft: () => state.draft }) },
}));
vi.mock("../../rpc/atomRegistry", () => ({ appAtomRegistry: { get: () => state.configs } }));
vi.mock("../../state/server", () => ({ environmentServerConfigsAtom: {} }));
vi.mock("../../lib/imageCompression", () => ({
  readFileAsDataUrl: async () => "data:image/png;base64,AAAA",
}));
vi.mock("../../lib/attachmentUploadQueue", () => ({
  startAttachmentUpload: (input: { environmentId: string; image: { id: string } }) => {
    state.started.push({ environmentId: input.environmentId, id: input.image.id });
  },
  awaitAttachmentUploads: async () => {},
  getUploadedAttachments: (input: {
    environmentId: string;
    images: Array<{ id: string; type: string; name: string }>;
  }) =>
    input.images.some((image) => state.failed.has(image.name))
      ? null
      : input.images.map((image) => ({
          type: image.type,
          id: `pending-${input.environmentId}-${image.id}`,
          name: image.name,
        })),
  releaseDraftAttachments: (attachments: Array<{ id: string }>) => {
    state.released.push(...attachments.map((attachment) => attachment.id));
  },
}));

const { readCarry } = await import("./carry");

const picture = {
  type: "image",
  id: "picture-1",
  name: "header.png",
  mimeType: "image/png",
  sizeBytes: 4,
  previewUrl: "blob:picture-1",
  file: new File(["png!"], "header.png", { type: "image/png" }),
};
const notes = {
  type: "file",
  id: "notes-1",
  name: "notes.md",
  mimeType: "text/markdown",
  sizeBytes: 5,
  file: new File(["notes"], "notes.md", { type: "text/markdown" }),
};
const otherChat = {
  version: 1,
  kind: "thread",
  contextId: toKindScopedComposerContextId("thread", "chat-1"),
  label: "Header review",
  environmentId: "laptop",
  threadId: "chat-1",
  title: "Header review",
} as const;

function draftOf(parts: Record<string, unknown>) {
  return {
    images: [],
    files: [],
    terminalContexts: [],
    previewAnnotations: [],
    reviewComments: [],
    threadContexts: [],
    ...parts,
  };
}

const UPLOADS = {
  attachmentUploads: true,
  inlineMessageContext: true,
  fileAttachments: { maxUploadBytes: 1_000_000 },
};

function machine(capabilities: Record<string, unknown>) {
  return { environment: { capabilities } };
}

beforeEach(() => {
  state.draft = null;
  state.configs = new Map([
    ["laptop", machine(UPLOADS)],
    ["desk", machine(UPLOADS)],
  ]);
  state.started = [];
  state.failed = new Set();
  state.released = [];
});

describe("what the Cells beside the draft's take", () => {
  it("is nothing when the message carries nothing", () => {
    state.draft = draftOf({});
    expect(readCarry("draft")).toBeNull();
  });

  it("uploads each file once per machine under its own id, never the draft's, and lets them go", async () => {
    state.draft = draftOf({ images: [picture], files: [notes] });
    const carry = readCarry("draft")!;
    const [harbor, atlas, kestrel] = await Promise.all([
      carry.to("laptop", "Fix the header"),
      carry.to("laptop", "Fix the footer"),
      carry.to("desk", "Fix the menu"),
    ]);
    // Upstream lets the draft's own uploads go once its Cell starts.
    expect(state.started.map((s) => s.id)).not.toContain("picture-1");
    expect(state.started.map((s) => s.id)).not.toContain("notes-1");
    expect(state.started.map((s) => s.environmentId).toSorted()).toEqual([
      "desk",
      "desk",
      "laptop",
      "laptop",
    ]);
    expect(harbor.ok && atlas.ok && kestrel.ok).toBe(true);
    if (!harbor.ok || !atlas.ok || !kestrel.ok) return;
    expect(atlas.attachments).toEqual(harbor.attachments);
    expect(harbor.attachments.map((a) => a.name)).toEqual(["header.png", "notes.md"]);
    expect(kestrel.attachments[0]!.id).not.toBe(harbor.attachments[0]!.id);
    carry.release();
    expect(state.released.toSorted()).toEqual(state.started.map((s) => s.id).toSorted());
  });

  it("binds a picture's chip to the Cell's own upload", async () => {
    state.draft = draftOf({ images: [picture] });
    const carried = await readCarry("draft")!.to("desk", "Fix the header");
    if (!carried.ok) throw new Error(carried.error);
    expect(carried.context?.records).toEqual([
      expect.objectContaining({
        contextId: toKindScopedComposerContextId("image", "picture-1"),
        attachmentId: carried.attachments[0]!.id,
      }),
    ]);
  });

  it("puts pictures in the message for a machine that takes no uploads, its chip bound to them", async () => {
    state.configs.set("desk", machine({}));
    const chip = formatComposerContextReference({
      kind: "image",
      contextId: toKindScopedComposerContextId("image", "picture-1"),
      label: "header.png",
    });
    state.draft = draftOf({ images: [picture] });
    const carried = await readCarry("draft")!.to("desk", `Match ${chip}`);
    if (!carried.ok) throw new Error(carried.error);
    expect(state.started).toEqual([]);
    expect(carried.attachments).toEqual([
      expect.objectContaining({ id: "picture-1", dataUrl: "data:image/png;base64,AAAA" }),
    ]);
    expect(carried.context?.records).toEqual([
      expect.objectContaining({ kind: "image", attachmentId: "picture-1" }),
    ]);
    expect(carried.text).toBe(`Match ${chip}`);
  });

  it("stops only the Cell on another machine when its text points at a chat it can't read", async () => {
    const chip = formatComposerContextReference(otherChat);
    state.draft = draftOf({ threadContexts: [otherChat] });
    const carry = readCarry("draft")!;
    const here = await carry.to("laptop", `Compare with ${chip}`);
    const there = await carry.to("desk", `Compare with ${chip}`);
    const elsewhere = await carry.to("desk", "Fix the menu");
    expect(here.ok).toBe(true);
    expect(there).toEqual({ ok: false, error: expect.stringContaining("Header review") });
    expect(elsewhere.ok).toBe(true);
  });

  it("stops a Cell whose upload failed, rather than send it without the file", async () => {
    state.failed.add("notes.md");
    state.draft = draftOf({ files: [notes] });
    const carried = await readCarry("draft")!.to("laptop", "Read the notes");
    expect(carried.ok).toBe(false);
  });
});
