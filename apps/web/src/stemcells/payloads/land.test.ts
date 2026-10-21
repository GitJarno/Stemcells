/**
 * How carried pictures and files land in a chat's draft: as copies with ids
 * of their own, the source letting go only once its copy is in, and a file
 * only its machine has copied there rather than read into the page. Each
 * case names what it keeps from going wrong.
 */
import { describe, expect, it } from "vite-plus/test";

import type { CellRef } from "../tabs/layout";
import type { Chip, FileChip, PictureChip, StashEntry } from "../upstream/payloads";
import { copyOfStashEntry, IMPORT_PATH, landPieces, type Hands } from "./land";
import type { Shown } from "./payload";

const MB = 1024 * 1024;
const HERE = "machine-here";
const from: CellRef = { environmentId: HERE, threadId: "thread-from", draftId: null };
const to: CellRef = { environmentId: HERE, threadId: "thread-to", draftId: null };

interface Posted {
  readonly pathname: string;
  readonly body: { from: { asset?: string; url?: string }; as?: string; name?: string };
}

/** The app's hands, kept: what went into which draft, what let go, what was asked of the server. */
function hands(
  more: {
    readonly refuse?: ReadonlySet<string>;
    readonly answer?: (posted: Posted) => Response;
    readonly fetched?: (url: string) => Response;
  } = {},
) {
  let ids = 0;
  const kept = {
    drafts: [] as Array<{ cell: CellRef; pictures: PictureChip[]; files: FileChip[] }>,
    letGo: [] as string[],
    discarded: [] as string[],
    posted: [] as Posted[],
    signed: [] as string[],
  };
  const it: Hands = {
    addToDraft: (cell, pictures, files) => {
      kept.drafts.push({ cell, pictures: [...pictures], files: [...files] });
      return [...pictures, ...files].map((chip) => chip.id).filter((id) => !more.refuse?.has(id));
    },
    letGo: (_cell, chip) => kept.letGo.push(chip.id),
    discard: (chip) => kept.discarded.push(chip.id),
    newId: () => `copy-${++ids}`,
    objectUrl: () => `blob:copy-${ids}`,
    signedAsset: async (environmentId, resource) => {
      const name = "attachmentId" in resource ? resource.attachmentId : "file";
      kept.signed.push(`${environmentId}:${name}`);
      return {
        issued: `/api/assets/fresh-${name}/x`,
        whole: `http://${environmentId}/api/assets/fresh-${name}/x`,
      };
    },
    postToPrimary: async (pathname, body) => {
      const posted = { pathname, body: body as Posted["body"] };
      kept.posted.push(posted);
      return (
        more.answer?.(posted) ??
        Response.json({
          attachmentId: `pending-new-${kept.posted.length}`,
          name: posted.body.name,
          mimeType: "video/mp4",
          sizeBytes: 5 * MB,
        })
      );
    },
    fetch: async (url) =>
      more.fetched?.(url) ??
      new Response(new Blob(["png"]), { headers: { "content-type": "image/png" } }),
    primary: () => HERE,
    maxPictureBytes: 10 * MB,
    isPictureType: (mimeType) => mimeType === "image/png",
  };
  return { hands: it, kept };
}

const picture: Chip = {
  type: "image",
  id: "picture-1",
  name: "sky.png",
  mimeType: "image/png",
  sizeBytes: 3,
  previewUrl: "blob:picture-1",
  file: new File(["png"], "sky.png", { type: "image/png" }),
};
const clip: Chip = {
  type: "file",
  id: "clip-1",
  name: "clip.mp4",
  mimeType: "video/mp4",
  sizeBytes: 3,
  file: new File(["mp4"], "clip.mp4", { type: "video/mp4" }),
};
const restored: Chip = {
  type: "file",
  id: "notes-1",
  name: "notes.pdf",
  mimeType: "application/pdf",
  sizeBytes: MB,
  file: null,
  uploadedAttachmentId: "pending-notes",
  uploadEnvironmentId: HERE as never,
};

describe("composer chips carried to another chat", () => {
  it("land as copies of their own, and only then does the source let go", async () => {
    const { hands: h, kept } = hands();
    const landed = await landPieces(
      { kind: "chips", from, chips: [picture, clip], copy: false },
      to,
      h,
    );
    expect(landed).toEqual({ added: 2, refused: [] });
    const [draft] = kept.drafts;
    expect(draft?.cell).toBe(to);
    // A copy shares no id with its source: one draft letting go can't take the other's.
    expect(draft?.pictures.map((chip) => chip.id)).toEqual(["copy-1"]);
    expect(draft?.pictures[0]?.previewUrl).not.toBe(picture.previewUrl);
    expect(draft?.pictures[0]?.file).toBe(picture.type === "image" ? picture.file : null);
    expect(draft?.files.map((chip) => [chip.id, chip.file])).toEqual([["copy-2", clip.file]]);
    expect(kept.letGo).toEqual(["picture-1", "clip-1"]);
  });

  it("with ⌥, stay where they were too", async () => {
    const { hands: h, kept } = hands();
    await landPieces({ kind: "chips", from, chips: [picture], copy: true }, to, h);
    expect(kept.drafts[0]?.pictures).toHaveLength(1);
    expect(kept.letGo).toEqual([]);
  });

  it("that the draft doesn't take stay at the source, and their copies are let go", async () => {
    const { hands: h, kept } = hands({ refuse: new Set(["copy-1"]) });
    const landed = await landPieces(
      { kind: "chips", from, chips: [picture, clip], copy: false },
      to,
      h,
    );
    expect(landed).toEqual({
      added: 1,
      refused: [{ name: "sky.png", reason: "Already there" }],
    });
    expect(kept.discarded).toEqual(["copy-1"]);
    expect(kept.letGo).toEqual(["clip-1"]);
  });

  it("a file only its upload is left of is copied by its machine, never shared by id", async () => {
    const { hands: h, kept } = hands();
    await landPieces({ kind: "chips", from, chips: [restored], copy: false }, to, h);
    expect(kept.signed).toEqual([`${HERE}:pending-notes`]);
    expect(kept.posted).toEqual([
      {
        pathname: IMPORT_PATH,
        body: { from: { asset: "/api/assets/fresh-pending-notes/x" }, name: "notes.pdf" },
      },
    ]);
    const [copy] = kept.drafts[0]?.files ?? [];
    expect(copy).toMatchObject({
      file: null,
      uploadedAttachmentId: "pending-new-1",
      uploadEnvironmentId: HERE,
    });
    expect(kept.letGo).toEqual(["notes-1"]);
  });
});

const video: Shown = {
  name: "run.mp4",
  kind: "video",
  mimeType: "video/mp4",
  sizeBytes: null,
  asset: {
    environmentId: HERE,
    resource: { _tag: "attachment", attachmentId: "thread-1-run" } as never,
  },
  url: null,
};
const shot: Shown = { ...video, name: "shot.png", kind: "image", mimeType: "image/png" };
const webChart: Shown = {
  name: "chart.png",
  kind: "image",
  mimeType: "image/png",
  sizeBytes: null,
  asset: null,
  url: "https://pictures.example.com/chart.png",
};

describe("what a chat shows, carried to another chat", () => {
  it("a video is copied on its machine, by a URL signed afresh, never read into the page", async () => {
    const { hands: h, kept } = hands({
      fetched: () => {
        throw new Error("A video must not be fetched into the page");
      },
    });
    const landed = await landPieces({ kind: "shown", from, items: [video] }, to, h);
    expect(landed.added).toBe(1);
    expect(kept.posted[0]?.body).toEqual({
      from: { asset: "/api/assets/fresh-thread-1-run/x" },
      name: "run.mp4",
    });
    expect(kept.drafts[0]?.files[0]).toMatchObject({
      name: "run.mp4",
      file: null,
      uploadedAttachmentId: "pending-new-1",
    });
    expect(kept.letGo).toEqual([]);
  });

  it("a picture comes in as a File, from where the chat shows it", async () => {
    const { hands: h, kept } = hands();
    await landPieces({ kind: "shown", from, items: [shot] }, to, h);
    const [chip] = kept.drafts[0]?.pictures ?? [];
    expect(chip?.file).toBeInstanceOf(File);
    expect([chip?.name, chip?.mimeType, chip?.sizeBytes]).toEqual(["shot.png", "image/png", 3]);
    expect(kept.posted).toEqual([]);
  });

  it("a picture that says it is over 10 MB isn't read", async () => {
    const { hands: h } = hands({
      fetched: () =>
        new Response(new Blob(["x"]), { headers: { "content-length": String(11 * MB) } }),
    });
    expect(await landPieces({ kind: "shown", from, items: [shot] }, to, h)).toEqual({
      added: 0,
      refused: [{ name: "shot.png", reason: "Over 10 MB" }],
    });
  });

  it("a picture from the web is fetched by this page's machine, named as it answers", async () => {
    const { hands: h, kept } = hands({
      answer: () =>
        new Response(new Blob(["png"]), {
          headers: {
            "content-type": "image/png",
            "x-stemcells-name": encodeURIComponent("chart final.png"),
          },
        }),
    });
    await landPieces({ kind: "shown", from, items: [webChart] }, to, h);
    expect(kept.posted[0]?.body).toEqual({
      from: { url: "https://pictures.example.com/chart.png" },
      as: "picture",
      name: "chart.png",
    });
    expect(kept.drafts[0]?.pictures[0]?.name).toBe("chart final.png");
  });

  it("what the server won't copy says why, and nothing else is lost", async () => {
    const { hands: h, kept } = hands({
      answer: () => Response.json({ reason: "Over 50 MB" }, { status: 413 }),
    });
    expect(await landPieces({ kind: "shown", from, items: [video, shot] }, to, h)).toEqual({
      added: 1,
      refused: [{ name: "run.mp4", reason: "Over 50 MB" }],
    });
    expect(kept.drafts[0]?.pictures).toHaveLength(1);
  });
});

describe("a stash entry copied with ⌥", () => {
  const entry: StashEntry = {
    id: "stash-1",
    createdAt: "2026-10-21T10:00:00.000Z",
    prompt: "Look at @notes.pdf",
    attachments: [
      {
        id: "stashed-picture",
        name: "sky.png",
        mimeType: "image/png",
        sizeBytes: 3,
        dataUrl: "data:image/png;base64,AAAA",
      },
    ],
    files: [
      {
        id: "stashed-file",
        name: "notes.pdf",
        mimeType: "application/pdf",
        sizeBytes: MB,
        attachmentId: "pending-notes",
        environmentId: HERE as never,
      },
    ],
    droppedImageNames: [],
  };
  const now = () => "2026-10-21T11:00:00.000Z";

  it("keeps its words and pictures, and names copies of its files, so the stash and the chat never share an upload", async () => {
    const { hands: h, kept } = hands();
    const copied = await copyOfStashEntry(entry, h, now);
    if (!copied.ok) throw new Error(copied.reason);
    expect(copied.entry.prompt).toBe(entry.prompt);
    expect(copied.entry.id).not.toBe(entry.id);
    expect(copied.entry.createdAt).toBe("2026-10-21T11:00:00.000Z");
    expect(copied.entry.attachments[0]?.dataUrl).toBe(entry.attachments[0]?.dataUrl);
    expect(copied.entry.files?.[0]).toMatchObject({
      attachmentId: "pending-new-1",
      environmentId: HERE,
    });
    expect(kept.signed).toEqual([`${HERE}:pending-notes`]);
  });

  it("is no copy when a file can't be copied, and lets go of the copies made", async () => {
    let posts = 0;
    const { hands: h, kept } = hands({
      answer: () =>
        ++posts === 1
          ? Response.json({ attachmentId: "pending-made", sizeBytes: 1, name: "a.pdf" })
          : Response.json({ reason: "No longer there" }, { status: 404 }),
    });
    const two = {
      ...entry,
      files: [...(entry.files ?? []), { ...entry.files![0]!, id: "second", name: "b.pdf" }],
    };
    expect(await copyOfStashEntry(two, h, now)).toEqual({
      ok: false,
      reason: "b.pdf: No longer there",
    });
    expect(kept.discarded).toHaveLength(1);
  });
});
