/**
 * Where a carried picture, file or stash may land, and the few words a
 * place that won't take it says. Each case names the drop it keeps right.
 */
import { describe, expect, it } from "vite-plus/test";

import type { CellRef } from "../tabs/layout";
import type { Chip, StashEntry } from "../upstream/payloads";
import {
  accepts,
  type Facts,
  type Machine,
  type Payload,
  type Shown,
  type Target,
} from "./payload";

const MB = 1024 * 1024;
const HERE = "machine-here";
const AWAY = "machine-away";

const cell = (threadId: string, environmentId = HERE): CellRef => ({
  environmentId,
  threadId,
  draftId: null,
});
const source = cell("thread-source");
const other = cell("thread-other");
const aski = cell("thread-aski");

const facts = (
  more: Partial<Facts> & {
    readonly machines?: Record<string, Machine>;
    readonly holds?: number;
  } = {},
): Facts => ({
  machine: (environmentId) =>
    more.machines?.[environmentId] ?? { takesFiles: true, maxFileBytes: 50 * MB },
  primary: HERE,
  held: () => more.holds ?? 0,
  maxAttachments: 100,
  maxPictureBytes: 10 * MB,
  isPictureType: (mimeType) =>
    ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mimeType),
  ...more,
});

const picture = (name = "sky.png", sizeBytes = 2 * MB): Chip => ({
  type: "image",
  id: `chip-${name}`,
  name,
  mimeType: "image/png",
  sizeBytes,
  previewUrl: `blob:${name}`,
  file: new File(["png"], name, { type: "image/png" }),
});
const file = (name = "clip.mp4", sizeBytes = 20 * MB): Chip => ({
  type: "file",
  id: `chip-${name}`,
  name,
  mimeType: "video/mp4",
  sizeBytes,
  file: new File(["mp4"], name, { type: "video/mp4" }),
});
/** A file whose File is gone: only its upload on `environmentId` is left (a stash restored it). */
const uploaded = (environmentId: string, name = "notes.pdf"): Chip => ({
  type: "file",
  id: `chip-${name}`,
  name,
  mimeType: "application/pdf",
  sizeBytes: MB,
  file: null,
  uploadedAttachmentId: `pending-${name}`,
  uploadEnvironmentId: environmentId as never,
});

const chips = (list: Chip[], copy = false): Payload => ({
  kind: "chips",
  from: source,
  chips: list,
  copy,
});
const shown = (items: Shown[]): Payload => ({ kind: "shown", from: source, items });
const video = (environmentId = HERE): Shown => ({
  name: "run.mp4",
  kind: "video",
  mimeType: "video/mp4",
  sizeBytes: null,
  asset: {
    environmentId,
    resource: { _tag: "attachment", attachmentId: "thread-1-video" } as never,
  },
  url: null,
});
const webPicture: Shown = {
  name: "chart.png",
  kind: "image",
  mimeType: "image/png",
  sizeBytes: null,
  asset: null,
  url: "https://pictures.example.com/chart.png",
};
const stash = (more: Partial<StashEntry> = {}, copy = false): Payload => ({
  kind: "stash",
  entry: {
    id: "stash-1",
    createdAt: "2026-10-21T10:00:00.000Z",
    prompt: "Try the header again",
    attachments: [],
    droppedImageNames: [],
    ...more,
  },
  copy,
});
const stashedFile = (environmentId: string) => ({
  id: "stashed-1",
  name: "notes.pdf",
  mimeType: "application/pdf",
  sizeBytes: MB,
  attachmentId: "pending-notes",
  environmentId: environmentId as never,
});

const into = (target: CellRef): Target => ({ kind: "cell", cell: target });
const YES = { ok: true };

describe("where a carry lands", () => {
  it("dropped on the chat it came from, does nothing and says nothing", () => {
    expect(accepts(chips([picture()]), into(source), facts())).toEqual({ ok: false, reason: null });
    expect(accepts(shown([video()]), into(source), facts())).toEqual({ ok: false, reason: null });
  });

  it("is never a Surface", () => {
    for (const payload of [chips([picture()]), shown([video()]), stash()])
      expect(accepts(payload, { kind: "surface" }, facts())).toEqual({ ok: false, reason: null });
  });

  it("goes into a working chat's draft like any other's", () => {
    // Nothing about a chat's turn running refuses: the payload waits in its draft.
    expect(accepts(chips([picture(), file()]), into(other), facts())).toEqual(YES);
  });

  it("goes into Aski's composer, pictures and files alike", () => {
    expect(accepts(chips([picture(), file()]), into(aski), facts())).toEqual(YES);
    expect(accepts(shown([video()]), into(aski), facts())).toEqual(YES);
  });

  it("dropped on '+', goes into a new Cell's empty draft", () => {
    expect(
      accepts(
        chips([picture(), file()]),
        { kind: "new-cell", environmentId: HERE },
        facts({ holds: 100 }),
      ),
    ).toEqual(YES);
  });

  it("a stash goes into any chat, the one whose words it was included", () => {
    expect(accepts(stash(), into(source), facts())).toEqual(YES);
  });
});

describe("why a chat won't take it", () => {
  it("a message holds at most 100 pictures and files", () => {
    expect(accepts(chips([picture(), file()]), into(other), facts({ holds: 99 }))).toEqual({
      ok: false,
      reason: "Room for 1 more",
    });
    expect(accepts(chips([picture()]), into(other), facts({ holds: 100 }))).toEqual({
      ok: false,
      reason: "Holds all it can",
    });
  });

  it("over the machine's file cap, or a picture over 10 MB", () => {
    expect(accepts(chips([file("big.mp4", 60 * MB)]), into(other), facts())).toEqual({
      ok: false,
      reason: "Over 50 MB",
    });
    expect(accepts(chips([picture("huge.png", 12 * MB)]), into(other), facts())).toEqual({
      ok: false,
      reason: "Over 10 MB",
    });
  });

  it("a machine that takes no files still takes pictures", () => {
    const noFiles = facts({ machines: { [HERE]: { takesFiles: false, maxFileBytes: null } } });
    expect(accepts(chips([picture()]), into(other), noFiles)).toEqual(YES);
    expect(accepts(chips([file()]), into(other), noFiles)).toEqual({
      ok: false,
      reason: "Takes pictures only",
    });
  });

  it("a file only its machine has lands only in that machine's chats, when this page copies there", () => {
    expect(accepts(chips([uploaded(HERE)]), into(other), facts())).toEqual(YES);
    expect(accepts(chips([uploaded(HERE)]), into(cell("thread-away", AWAY)), facts())).toEqual({
      ok: false,
      reason: "On another machine",
    });
    expect(accepts(shown([video(AWAY)]), into(cell("thread-away", AWAY)), facts())).toEqual({
      ok: false,
      reason: "On another machine",
    });
    expect(accepts(shown([video()]), into(other), facts())).toEqual(YES);
  });

  it("a picture comes into the page, so it lands on any machine", () => {
    const awayPicture: Shown = {
      ...video(AWAY),
      name: "shot.png",
      kind: "image",
      mimeType: "image/png",
    };
    expect(accepts(shown([awayPicture]), into(other), facts())).toEqual(YES);
    expect(accepts(chips([picture()]), into(cell("thread-away", AWAY)), facts())).toEqual(YES);
  });

  it("a picture from the web needs this page's machine to fetch it", () => {
    expect(accepts(shown([webPicture]), into(other), facts())).toEqual(YES);
    expect(accepts(shown([webPicture]), into(other), facts({ primary: null }))).toEqual({
      ok: false,
      reason: "Can't fetch it here",
    });
  });

  it("a stash's files are restored only on their machine, and copied only where this page copies", () => {
    expect(accepts(stash({ files: [stashedFile(HERE)] }), into(other), facts())).toEqual(YES);
    expect(accepts(stash({ files: [stashedFile(AWAY)] }), into(other), facts())).toEqual({
      ok: false,
      reason: "Its files are on another machine",
    });
    const away = into(cell("thread-away", AWAY));
    expect(accepts(stash({ files: [stashedFile(AWAY)] }), away, facts())).toEqual(YES);
    expect(accepts(stash({ files: [stashedFile(AWAY)] }, true), away, facts())).toEqual({
      ok: false,
      reason: "On another machine",
    });
  });
});
