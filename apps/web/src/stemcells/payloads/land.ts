/**
 * Landing pictures and files in a chat's draft, by reference. Each lands as
 * a copy with an id of its own; a move is that copy and the source letting
 * go, once the copy is in.
 *
 * - A chip whose File the page holds is copied as a chip: the target's
 *   composer uploads it from the same File.
 * - A file only its machine has (a chip's finished upload, a video a chat
 *   shows) is copied there by the server's import route into a pending
 *   upload of its own, which the chip names: the bytes never pass through
 *   the page. A web address is fetched once, the same way.
 * - A picture comes in as a File (upstream's picture chips need the bytes,
 *   at most 10 MB): from the URL the chat shows it by, or for one from the
 *   web, from the import route, which fetches it.
 */
import type { CellRef } from "../tabs/layout";
import type { AssetResource, Chip, FileChip, PictureChip, StashEntry } from "../upstream/payloads";
import { overCap, type Shown } from "./payload";

/** The server's import route (`apps/server/src/stemcells/attachments/http.ts`). */
export const IMPORT_PATH = "/api/stemcells/attachments/import";

/** What landing does in the app: `hands.ts` gives the real ones. */
export interface Hands {
  readonly addToDraft: (
    cell: CellRef,
    pictures: ReadonlyArray<PictureChip>,
    files: ReadonlyArray<FileChip>,
  ) => ReadonlyArray<string>;
  /** A chip leaving the draft it was carried from. */
  readonly letGo: (cell: CellRef, chip: Chip) => void;
  /** A copy that didn't go in, letting go of what it holds. */
  readonly discard: (chip: Chip) => void;
  readonly newId: () => string;
  readonly objectUrl: (file: Blob) => string;
  readonly signedAsset: (
    environmentId: string,
    resource: AssetResource,
  ) => Promise<{ readonly issued: string; readonly whole: string } | null>;
  readonly postToPrimary: (pathname: string, body: unknown) => Promise<Response>;
  readonly fetch: (url: string) => Promise<Response>;
  readonly primary: () => string | null;
  readonly maxPictureBytes: number;
  readonly isPictureType: (mimeType: string) => boolean;
}

export interface Landed {
  /** How many pictures and files went in. */
  readonly added: number;
  /** What didn't, and why, in a few words each. */
  readonly refused: ReadonlyArray<{ readonly name: string; readonly reason: string }>;
}

type Copy =
  | { readonly ok: true; readonly chip: Chip; readonly from?: Chip }
  | { readonly ok: false; readonly name: string; readonly reason: string };

const refusal = (name: string, reason: string): Copy => ({ ok: false, name, reason });

/** Lands a composer's chips, or what a chat shows, in `cell`'s draft. */
export async function landPieces(
  payload:
    | {
        readonly kind: "chips";
        readonly from: CellRef;
        readonly chips: ReadonlyArray<Chip>;
        readonly copy: boolean;
      }
    | { readonly kind: "shown"; readonly from: CellRef; readonly items: ReadonlyArray<Shown> },
  cell: CellRef,
  hands: Hands,
): Promise<Landed> {
  const copies = await Promise.all(
    payload.kind === "chips"
      ? payload.chips.map((chip) => copyChip(chip, hands))
      : payload.items.map((item) => copyShown(item, hands)),
  );
  const made = copies.filter((copy) => copy.ok);
  const pictures = made.flatMap((copy) => (copy.chip.type === "image" ? [copy.chip] : []));
  const files = made.flatMap((copy) => (copy.chip.type === "file" ? [copy.chip] : []));
  const added = new Set(hands.addToDraft(cell, pictures, files));

  const refused: { name: string; reason: string }[] = [];
  for (const copy of copies) {
    if (!copy.ok) {
      refused.push({ name: copy.name, reason: copy.reason });
    } else if (!added.has(copy.chip.id)) {
      hands.discard(copy.chip);
      refused.push({ name: copy.chip.name, reason: "Already there" });
    } else if (payload.kind === "chips" && !payload.copy && copy.from) {
      hands.letGo(payload.from, copy.from);
    }
  }
  return { added: added.size, refused };
}

async function copyChip(chip: Chip, hands: Hands): Promise<Copy> {
  if (chip.type === "image")
    return {
      ok: true,
      chip: { ...chip, id: hands.newId(), previewUrl: hands.objectUrl(chip.file) },
      from: chip,
    };
  if (chip.file !== null)
    return { ok: true, chip: fileChip(chip, hands.newId(), chip.file), from: chip };
  if (chip.uploadedAttachmentId === undefined || chip.uploadEnvironmentId === undefined)
    return refusal(chip.name, "Attach it again first");
  const copied = await importFile(
    {
      environmentId: chip.uploadEnvironmentId,
      resource: { _tag: "attachment", attachmentId: chip.uploadedAttachmentId },
    },
    chip.name,
    hands,
  );
  return copied.ok ? { ...copied, from: chip } : copied;
}

async function copyShown(item: Shown, hands: Hands): Promise<Copy> {
  const picture =
    item.kind === "image" && item.mimeType !== null && hands.isPictureType(item.mimeType);
  if (picture)
    return item.asset ? pictureFromAsset(item, item.asset, hands) : pictureFromWeb(item, hands);
  if (item.asset) return importFile(item.asset, item.name, hands);
  if (item.url) return importFrom({ url: item.url }, item.name, hands);
  return refusal(item.name, "Nothing to copy");
}

function fileChip(
  like: {
    readonly name: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly source?: FileChip["source"];
  },
  id: string,
  file: File | null,
  upload?: { readonly attachmentId: string; readonly environmentId: string },
): FileChip {
  return {
    type: "file",
    id,
    name: like.name,
    mimeType: like.mimeType,
    sizeBytes: like.sizeBytes,
    file,
    ...(like.source ? { source: like.source } : {}),
    ...(upload
      ? {
          uploadedAttachmentId: upload.attachmentId,
          uploadEnvironmentId: upload.environmentId as NonNullable<FileChip["uploadEnvironmentId"]>,
        }
      : {}),
  };
}

function pictureChip(file: File, hands: Hands): PictureChip {
  return {
    type: "image",
    id: hands.newId(),
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    previewUrl: hands.objectUrl(file),
    file,
  };
}

async function importFile(
  asset: { readonly environmentId: string; readonly resource: AssetResource },
  name: string,
  hands: Hands,
): Promise<Copy> {
  const signed = await hands.signedAsset(asset.environmentId, asset.resource).catch(() => null);
  if (signed === null) return refusal(name, "No longer there");
  return importFrom({ asset: signed.issued }, name, hands);
}

/** A copy the primary's server makes into a pending upload of its own. */
async function importFrom(
  from: { readonly asset: string } | { readonly url: string },
  name: string,
  hands: Hands,
): Promise<Copy> {
  const primary = hands.primary();
  if (primary === null) return refusal(name, "On another machine");
  const answer = await hands.postToPrimary(IMPORT_PATH, { from, name }).catch(() => null);
  if (answer === null) return refusal(name, "Couldn't reach it");
  const body = (await answer.json().catch(() => null)) as {
    readonly attachmentId?: string;
    readonly name?: string;
    readonly mimeType?: string;
    readonly sizeBytes?: number;
    readonly reason?: string;
  } | null;
  if (!answer.ok || !body?.attachmentId || body.sizeBytes === undefined)
    return refusal(name, body?.reason ?? "Couldn't copy it");
  return {
    ok: true,
    chip: fileChip(
      {
        name: body.name ?? name,
        mimeType: body.mimeType ?? "application/octet-stream",
        sizeBytes: body.sizeBytes,
      },
      hands.newId(),
      null,
      { attachmentId: body.attachmentId, environmentId: primary },
    ),
  };
}

async function pictureFromAsset(
  item: Shown,
  asset: { readonly environmentId: string; readonly resource: AssetResource },
  hands: Hands,
): Promise<Copy> {
  const signed = await hands.signedAsset(asset.environmentId, asset.resource).catch(() => null);
  if (signed === null) return refusal(item.name, "No longer there");
  const answer = await hands.fetch(signed.whole).catch(() => null);
  if (answer === null || !answer.ok) return refusal(item.name, "Couldn't read it");
  // A size the chat said is checked before reading; one it didn't, after.
  const said = Number(answer.headers.get("content-length"));
  if (Number.isFinite(said) && said > hands.maxPictureBytes)
    return refusal(item.name, overCap(hands.maxPictureBytes));
  const blob = await answer.blob();
  if (blob.size > hands.maxPictureBytes) return refusal(item.name, overCap(hands.maxPictureBytes));
  const file = new File([blob], item.name, { type: item.mimeType ?? blob.type });
  return { ok: true, chip: pictureChip(file, hands) };
}

async function pictureFromWeb(item: Shown, hands: Hands): Promise<Copy> {
  if (item.url === null) return refusal(item.name, "Nothing to copy");
  if (hands.primary() === null) return refusal(item.name, "Can't fetch it here");
  const answer = await hands
    .postToPrimary(IMPORT_PATH, { from: { url: item.url }, as: "picture", name: item.name })
    .catch(() => null);
  if (answer === null) return refusal(item.name, "Couldn't reach it");
  if (!answer.ok) {
    const body = (await answer.json().catch(() => null)) as { readonly reason?: string } | null;
    return refusal(item.name, body?.reason ?? "Couldn't fetch it");
  }
  const named = answer.headers.get("x-stemcells-name");
  const name = named ? decodeURIComponent(named) : item.name;
  const blob = await answer.blob();
  const file = new File([blob], name, { type: answer.headers.get("content-type") ?? blob.type });
  return { ok: true, chip: pictureChip(file, hands) };
}

/**
 * A stash entry with the same words, pictures and context, whose files are
 * copies of their own (made by the primary's server): what ⌥ leaves in the
 * stash while the entry itself lands, so the stash and the chat never name
 * one upload. Null, with why, when a file couldn't be copied; copies made
 * before then are let go.
 */
export async function copyOfStashEntry(
  entry: StashEntry,
  hands: Hands,
  now: () => string,
): Promise<
  | { readonly ok: true; readonly entry: StashEntry }
  | { readonly ok: false; readonly reason: string }
> {
  const files = entry.files ?? [];
  const copies = await Promise.all(
    files.map((file) =>
      importFile(
        {
          environmentId: file.environmentId,
          resource: { _tag: "attachment", attachmentId: file.attachmentId },
        },
        file.name,
        hands,
      ),
    ),
  );
  const failed = copies.find((copy) => !copy.ok);
  if (failed && !failed.ok) {
    for (const copy of copies) if (copy.ok) hands.discard(copy.chip);
    return { ok: false, reason: `${failed.name}: ${failed.reason}` };
  }
  return {
    ok: true,
    entry: {
      ...entry,
      id: hands.newId(),
      createdAt: now(),
      attachments: entry.attachments.map((image) => ({ ...image, id: hands.newId() })),
      ...(entry.files
        ? {
            files: entry.files.map((file, index) => {
              const copy = copies[index];
              const chip = copy?.ok ? copy.chip : null;
              return {
                ...file,
                id: chip?.id ?? hands.newId(),
                attachmentId:
                  chip?.type === "file" && chip.uploadedAttachmentId
                    ? chip.uploadedAttachmentId
                    : file.attachmentId,
              };
            }),
          }
        : {}),
    },
  };
}
