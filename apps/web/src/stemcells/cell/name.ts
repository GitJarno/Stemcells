// A Cell's name, dealt from its chat's thread id into the names in
// `names.json`: the same chat gets the same name on every screen, with
// nothing stored. Two chats can draw one name; nothing deals them apart yet.

import data from "./names.json" with { type: "json" };

/** Every name a Cell may be called by. */
export const NAMES: readonly string[] = data.names;

const MASK = (1n << 64n) - 1n;

/** FNV-1a over the words' UTF-8, in 64 bits. */
function fnv1a(words: string): bigint {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(words))
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & MASK;
  return hash;
}

/** The name of the Cell whose chat has this thread id. */
export function cellNameOf(threadId: string): string {
  return NAMES[Number(fnv1a(threadId) % BigInt(NAMES.length))]!;
}
