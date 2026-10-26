/**
 * A chat taking a carry: pictures, videos and files dragged from another chat land as files off
 * the disk do, under upstream's drop overlay and into the composer's intake, which checks,
 * previews and uploads them to the chat's own machine. So each is read into a File here: the
 * bytes this window holds, a file signed afresh by the machine that has it, or a web address.
 */
import { toastManager } from "../upstream/ui";
import { heldFor, refusedBy, startedInApp } from "./carry";
import { type Hands, IMPORT_PATH } from "./land";
import { overCap, type Shown } from "./payload";
import { CARRIED_TYPE, decodeCarried, isCarry, type Carried } from "./wire";

/** A drag event over a chat, as upstream's file drop reads it, with the data a drop gives. */
export interface CarryDragEvent {
  readonly dataTransfer: {
    readonly types: ReadonlyArray<string>;
    getData(format: string): string;
    dropEffect: string;
  };
  readonly relatedTarget: EventTarget | null;
  readonly currentTarget: { contains(target: Node | null): boolean };
  preventDefault(): void;
}

export interface CarryDropHost {
  setDragActive(active: boolean): void;
  addFiles(files: File[]): void;
}

/** What reading a carried item takes from the app. */
export type Reading = Pick<
  Hands,
  "signedAsset" | "fetch" | "postToPrimary" | "primary" | "isPictureType"
> & {
  /** The most any one file may be; a bigger one isn't read at all. */
  readonly maxBytes: number;
};

export interface Read {
  readonly files: ReadonlyArray<File>;
  readonly refused: ReadonlyArray<{ readonly name: string; readonly reason: string }>;
}

/** The pictures, videos and files a carry holds, read into Files in its order. */
export async function filesOf(
  carried: Carried,
  held: ReadonlyArray<File | null>,
  reading: Reading,
): Promise<Read> {
  const read = await Promise.all(
    carried.items.map((item, index) => fileOf(item, held[index] ?? null, reading)),
  );
  return {
    files: read.filter((each) => each instanceof File),
    refused: read.filter((each): each is Refusal => !(each instanceof File)),
  };
}

type Refusal = { readonly name: string; readonly reason: string };

async function fileOf(item: Shown, held: File | null, reading: Reading): Promise<File | Refusal> {
  if (held !== null) {
    return held.name === item.name
      ? held
      : new File([held], item.name, { type: held.type, lastModified: held.lastModified });
  }
  if (item.asset !== null) {
    const { environmentId, resource } = item.asset;
    const signed = await reading.signedAsset(environmentId, resource).catch(() => null);
    if (signed === null) return { name: item.name, reason: "No longer there" };
    return fileFrom(await reading.fetch(signed.whole).catch(() => null), item, reading);
  }
  if (item.url !== null && /^(https?|blob):/i.test(item.url)) {
    const direct = await reading.fetch(item.url).catch(() => null);
    if (direct?.ok || !/^https?:/i.test(item.url) || !isPicture(item, reading))
      return fileFrom(direct, item, reading);
    // The web's own rules keep most sites' pictures from the page; the primary's server fetches them.
    if (reading.primary() === null) return { name: item.name, reason: "Can't fetch it here" };
    const fetched = await reading
      .postToPrimary(IMPORT_PATH, { from: { url: item.url }, as: "picture", name: item.name })
      .catch(() => null);
    return fileFrom(fetched, item, reading);
  }
  return { name: item.name, reason: "Nothing to copy" };
}

const isPicture = (item: Shown, reading: Reading) =>
  item.kind === "image" && (item.mimeType === null || reading.isPictureType(item.mimeType));

async function fileFrom(
  answer: Response | null,
  item: Shown,
  reading: Reading,
): Promise<File | Refusal> {
  if (answer === null || !answer.ok) return { name: item.name, reason: "Couldn't read it" };
  const said = Number(answer.headers.get("content-length"));
  if (Number.isFinite(said) && said > reading.maxBytes) {
    void answer.body?.cancel().catch(() => {});
    return { name: item.name, reason: overCap(reading.maxBytes) };
  }
  const bytes = await bytesOf(answer, reading.maxBytes).catch(() => null);
  if (bytes === "over") return { name: item.name, reason: overCap(reading.maxBytes) };
  if (bytes === null) return { name: item.name, reason: "Couldn't read it" };
  const declared = answer.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  // An address that answers with a page (a sign-in, say) isn't the file it named.
  if (declared === "text/html" && item.mimeType !== "text/html")
    return { name: item.name, reason: "Got a web page, not the file" };
  // What the answer says it sent beats a type guessed from a name, unless it says only "bytes".
  const type =
    declared && declared !== "application/octet-stream" ? declared : (item.mimeType ?? "");
  return new File(bytes, item.name, { type });
}

/** An answer's body, read no further than `maxBytes`: one that doesn't say its size may never end. */
async function bytesOf(answer: Response, maxBytes: number): Promise<BlobPart[] | "over"> {
  const chunks: BlobPart[] = [];
  if (answer.body === null) return chunks;
  const reader = answer.body.getReader();
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    size += value.byteLength;
    if (size > maxBytes) {
      void reader.cancel().catch(() => {});
      return "over";
    }
    chunks.push(value);
  }
}

/**
 * The handlers a chat's drop target spreads for a carry. Each answers whether the event was a
 * carry's, so upstream's file drop leaves it alone; a carry's own chat refuses its chips, and a
 * drop there does nothing.
 */
export function makeCarryDropHandlers(host: CarryDropHost, reading: Reading) {
  const movedWithin = (event: CarryDragEvent) =>
    event.relatedTarget !== null && event.currentTarget.contains(event.relatedTarget as Node);
  return {
    onDragEnter(event: CarryDragEvent): boolean {
      if (!isCarry(event.dataTransfer.types)) return false;
      if (refusedBy(event.currentTarget)) return true;
      event.preventDefault();
      if (!movedWithin(event)) host.setDragActive(true);
      return true;
    },
    onDragOver(event: CarryDragEvent): boolean {
      if (!isCarry(event.dataTransfer.types)) return false;
      if (refusedBy(event.currentTarget)) return true;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      host.setDragActive(true);
      return true;
    },
    onDragLeave(event: CarryDragEvent): boolean {
      if (!isCarry(event.dataTransfer.types)) return false;
      event.preventDefault();
      if (!movedWithin(event)) host.setDragActive(false);
      return true;
    },
    onDrop(event: CarryDragEvent): boolean {
      if (!isCarry(event.dataTransfer.types)) return false;
      event.preventDefault();
      host.setDragActive(false);
      if (refusedBy(event.currentTarget)) return true;
      const carried = decodeCarried(event.dataTransfer.getData(CARRIED_TYPE));
      if (carried === null || !startedInApp(carried.drag)) return true;
      void filesOf(carried, heldFor(carried.drag), reading).then(({ files, refused }) => {
        if (files.length > 0) host.addFiles([...files]);
        if (refused.length > 0) tellRefused(refused, carried.items.length);
      });
      return true;
    },
  };
}

function tellRefused(refused: ReadonlyArray<Refusal>, of: number): void {
  const [first] = refused;
  toastManager.add(
    refused.length === 1 && first
      ? { type: "error", title: `Couldn't bring ${first.name} along`, description: first.reason }
      : {
          type: "error",
          title: `Couldn't bring ${refused.length} of ${of} along`,
          description: refused.map(({ name, reason }) => `${name}: ${reason}`).join(", "),
        },
  );
}
