/**
 * What a carry holds when it isn't a chat, a tab or a window: pictures, videos, files and stashed
 * prompts, and whether a place takes them. A payload is references, never bytes: a composer's
 * chip, what a chat shows (its file, signed afresh when it lands, or its web address), or a stash
 * entry. Landing (`land.ts`) makes copies with ids of their own.
 */
import { sameChat, type CellRef } from "../tabs/layout";
import type { AssetResource, Chip, StashEntry } from "../upstream/payloads";

/** Something a chat shows, by what it names. */
export interface Shown {
  readonly name: string;
  readonly kind: "image" | "video" | "file";
  readonly mimeType: string | null;
  /** What it is, when the chat said. */
  readonly sizeBytes: number | null;
  /** The file it names on the machine that showed it; null for media from the web. */
  readonly asset: { readonly environmentId: string; readonly resource: AssetResource } | null;
  /** Its web address, for media from the web. */
  readonly url: string | null;
}

export type Payload =
  /** A composer's chips: moved, or with ⌥ copied. */
  | {
      readonly kind: "chips";
      readonly from: CellRef;
      readonly chips: ReadonlyArray<Chip>;
      readonly copy: boolean;
    }
  /** What a chat shows: always copied. */
  | { readonly kind: "shown"; readonly from: CellRef; readonly items: ReadonlyArray<Shown> }
  /** A stash entry, its words and attachments together: moved, or with ⌥ copied. */
  | { readonly kind: "stash"; readonly entry: StashEntry; readonly copy: boolean };

export type Target =
  /** A chat's composer: any Cell's, Aski's, a working one's (it lands in the draft). */
  | { readonly kind: "cell"; readonly cell: CellRef }
  /** The strip's "+": a new tab, with a new Cell's draft on `environmentId` holding the payload. */
  | { readonly kind: "new-cell"; readonly environmentId: string }
  /** A Surface (a browser, a terminal): never a target. */
  | { readonly kind: "surface" };

/** What a machine's chats take, as upstream's composer reads it. */
export interface Machine {
  /** Whether it takes files (upstream's attachment uploads); null until it says. */
  readonly takesFiles: boolean | null;
  readonly maxFileBytes: number | null;
}

/** What `accepts` reads of the app. */
export interface Facts {
  readonly machine: (environmentId: string) => Machine;
  /** The machine this page copies files through (the import route's): null when there is none. */
  readonly primary: string | null;
  /** How many pictures and files the chat's draft holds now. */
  readonly held: (cell: CellRef) => number;
  readonly maxAttachments: number;
  readonly maxPictureBytes: number;
  readonly isPictureType: (mimeType: string) => boolean;
}

/**
 * Yes; or no, with a few words the carried card shows. A no without words is
 * a place that takes nothing and says nothing: the chat the payload came
 * from (the drop is a no-op), or a Surface.
 */
export type Acceptance =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string | null };

const YES: Acceptance = { ok: true };
const QUIET: Acceptance = { ok: false, reason: null };
const no = (reason: string): Acceptance => ({ ok: false, reason });

/** "Over 50 MB": a cap, as the server's refusal says it. */
export const overCap = (cap: number) => `Over ${Math.round(cap / (1024 * 1024))} MB`;

/** One thing landing, as far as taking it goes. */
interface Need {
  /** A picture lands as a File in the page, which any machine's chat takes. */
  readonly picture: boolean;
  readonly sizeBytes: number | null;
  /**
   * The machine whose server has to copy it (its file isn't in the page);
   * null when the page holds it. Only the primary copies, and only into its
   * own chats: the copy is a pending upload there.
   */
  readonly copiedOn: string | null;
  /** A picture from the web, which only the primary's server can fetch. */
  readonly fetchedOn?: "primary";
}

function needsOf(payload: Payload, facts: Facts): ReadonlyArray<Need> {
  switch (payload.kind) {
    case "chips":
      return payload.chips.map((chip) =>
        chip.type === "image"
          ? { picture: true, sizeBytes: chip.sizeBytes, copiedOn: null }
          : {
              picture: false,
              sizeBytes: chip.sizeBytes,
              copiedOn: chip.file === null ? (chip.uploadEnvironmentId ?? "") : null,
            },
      );
    case "shown":
      return payload.items.map((item) => {
        const picture =
          item.kind === "image" && item.mimeType !== null && facts.isPictureType(item.mimeType);
        if (item.asset === null)
          return picture
            ? { picture, sizeBytes: item.sizeBytes, copiedOn: null, fetchedOn: "primary" }
            : { picture, sizeBytes: item.sizeBytes, copiedOn: facts.primary ?? "" };
        return {
          picture,
          sizeBytes: item.sizeBytes,
          copiedOn: picture ? null : item.asset.environmentId,
        };
      });
    case "stash": {
      const files = payload.entry.files ?? [];
      return [
        ...payload.entry.attachments.map((image) => ({
          picture: true,
          sizeBytes: image.sizeBytes,
          copiedOn: null,
        })),
        // Moved, a stashed file keeps its upload; copied, the stash keeps it
        // and the chat gets a copy the primary makes.
        ...files.map((file) => ({
          picture: false,
          sizeBytes: file.sizeBytes,
          copiedOn: payload.copy ? file.environmentId : null,
        })),
      ];
    }
  }
}

/** Whether `target` takes `payload`, and if not, why. */
export function accepts(payload: Payload, target: Target, facts: Facts): Acceptance {
  if (target.kind === "surface") return QUIET;
  if (target.kind === "cell" && payload.kind !== "stash" && sameChat(payload.from, target.cell))
    return QUIET;
  const environmentId = target.kind === "cell" ? target.cell.environmentId : target.environmentId;

  // A stashed file is an upload on its machine: upstream restores it only there.
  if (
    payload.kind === "stash" &&
    (payload.entry.files ?? []).some((file) => file.environmentId !== environmentId)
  )
    return no("Its files are on another machine");

  const needs = needsOf(payload, facts);
  if (needs.length === 0) return YES;
  const room = facts.maxAttachments - (target.kind === "cell" ? facts.held(target.cell) : 0);
  if (needs.length > room) return no(room <= 0 ? "Holds all it can" : `Room for ${room} more`);

  const machine = facts.machine(environmentId);
  for (const need of needs) {
    if (need.fetchedOn === "primary" && facts.primary === null) return no("Can't fetch it here");
    if (need.picture) {
      if (need.sizeBytes !== null && need.sizeBytes > facts.maxPictureBytes)
        return no(overCap(facts.maxPictureBytes));
      continue;
    }
    if (machine.takesFiles === false) return no("Takes pictures only");
    if (
      need.sizeBytes !== null &&
      machine.maxFileBytes !== null &&
      need.sizeBytes > machine.maxFileBytes
    )
      return no(overCap(machine.maxFileBytes));
    if (
      need.copiedOn !== null &&
      (need.copiedOn !== environmentId || need.copiedOn !== facts.primary)
    )
      return no("On another machine");
  }
  return YES;
}
