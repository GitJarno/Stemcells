// A Cell's name, dealt from its chat's thread id into the names in `cellNames.json`: the
// same chat gets the same name on every screen, with nothing stored. Two chats can draw one
// name; nothing deals them apart yet. Below, a chat naming another, on the Mac and the phone
// alike (stemcells/tasks/cell-tokens.md).

import data from "./cellNames.json" with { type: "json" };

/** Every name a Cell may be called by. */
export const NAMES: readonly string[] = data.names;

const MASK = (1n << 64n) - 1n;

/** FNV-1a over the words' UTF-8, in 64 bits. */
export function fnv1a(words: string): bigint {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(words))
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & MASK;
  return hash;
}

/** The name of the Cell whose chat has this thread id. */
export function cellNameOf(threadId: string): string {
  return NAMES[Number(fnv1a(threadId) % BigInt(NAMES.length))]!;
}

/** A chat as the names read it. */
export interface MentionChat {
  readonly environmentId: string;
  readonly id: string;
  readonly projectId: string;
  /** A Subcell, archived or deleted: never named. */
  readonly gone: boolean;
  readonly aski: boolean;
  /** Its last activity, as an ISO time. */
  readonly updatedAt: string;
}

/** What a link carries as a thread id. */
const LINKABLE_ID = /^[a-z0-9_-]{1,128}$/i;

/**
 * The names `self` may use, and the chat each means: the other Cells of its project on its
 * server, as the roster tells a Cell who works beside it; Aski names any. With two of one
 * name, the one active last.
 */
export function namesFor(
  self: MentionChat,
  chats: ReadonlyArray<MentionChat>,
): ReadonlyMap<string, string> {
  const latest = new Map<string, MentionChat>();
  for (const chat of chats) {
    if (
      chat.id === self.id ||
      chat.environmentId !== self.environmentId ||
      chat.gone ||
      chat.aski ||
      (!self.aski && chat.projectId !== self.projectId) ||
      !LINKABLE_ID.test(chat.id)
    )
      continue;
    const name = cellNameOf(chat.id);
    const held = latest.get(name);
    if (held === undefined || chat.updatedAt > held.updatedAt) latest.set(name, chat);
  }
  return new Map([...latest].map(([name, chat]) => [name, chat.id]));
}

/** The names in one line: equal while the names are. */
export function signatureOf(names: ReadonlyMap<string, string>): string {
  return [...names]
    .map(([name, id]) => `${name}=${id}`)
    .toSorted()
    .join(",");
}

// Inline code, a link or image with its words, an autolink or a tag, a bare URL: kept as written.
const KEPT = /(`+)[\s\S]*?\1|!?\[[^\]]*\]\([^)]*\)|<[^>\s]+>|https?:\/\/\S+/g;
const FENCE = /^\s*(`{3,}|~{3,})/;
// Four spaces in is code unless it continues a list.
const INDENTED_CODE = /^(?: {4,}|\t)(?!\s*(?:[-*+]|\d+[.)])\s)/;

/** The text with each name in `names` outside code and links written as `[Name](hrefOf(id))`. */
export function linkCellNames(
  text: string,
  names: ReadonlyMap<string, string>,
  hrefOf: (threadId: string) => string,
): string {
  if (names.size === 0) return text;
  const alternatives = [...names.keys()]
    .toSorted((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  // A whole, capitalised word, "@" before it or not; never part of a path, a handle or a longer word.
  const named = new RegExp(
    `(?<![\\p{L}\\p{N}_./#@-])@?(${alternatives})(?![\\p{L}\\p{N}_-])`,
    "gu",
  );
  const link = (line: string) =>
    line.replace(named, (_whole, name: string) => `[${name}](${hrefOf(names.get(name)!)})`);
  let fence: string | null = null;
  return text
    .split("\n")
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (fence !== null) {
        if (
          marker !== undefined &&
          marker[0] === fence[0] &&
          marker.length >= fence.length &&
          line.trim() === marker
        )
          fence = null;
        return line;
      }
      if (marker !== undefined) {
        fence = marker;
        return line;
      }
      if (INDENTED_CODE.test(line)) return line;
      let out = "";
      let from = 0;
      for (const kept of line.matchAll(KEPT)) {
        out += link(line.slice(from, kept.index)) + kept[0];
        from = kept.index + kept[0].length;
      }
      return out + link(line.slice(from));
    })
    .join("\n");
}
