// The app no longer sends collision notices (stemcells/tasks/peers.md, decision 3), but chats
// from before keep theirs: the id (`stemcells-collision:<kind>:<other Cell>:<nonce>`) names
// the kind and the other Cell, the first line the files.

const COLLISION_ID = /^stemcells-collision:(file|checkout):([^:]+):/;

/** A collision notice's kind and the other Cell, from its message id; null for any other message. */
export function collisionOf(
  messageId: string,
): { readonly kind: "file" | "checkout"; readonly other: string } | null {
  const match = COLLISION_ID.exec(messageId);
  if (match === null) return null;
  try {
    return { kind: match[1] as "file" | "checkout", other: decodeURIComponent(match[2]!) };
  } catch {
    return null;
  }
}

/** The files a notice's first line names, after its "as Name:". */
export function filesOf(text: string): string {
  const first = text.split("\n", 1)[0] ?? "";
  const at = first.indexOf(": ");
  return at === -1 ? "" : first.slice(at + 2);
}
