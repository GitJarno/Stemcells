/**
 * A Cell that carried on after a usage limit shows a row where its
 * continuation message would be: the line it was sent is the app's, not
 * words the person typed (stemcells/tasks/limit-resume.md).
 *
 * The server names each continuation it sends by why
 * (`apps/server/src/stemcells/upstream/limitResume.ts`, `continuedMessageId`):
 * `stemcells-continued:<reason>:<thread>:<run>:<nonce>`. Upstream's own
 * worker, once its resume is armed, names its `limit-resume:…`.
 */

export const CONTINUED_WORDS = {
  "signed-in": "Continued after you signed in again",
  reset: "Continued after the limit reset",
} as const;

const OURS = "stemcells-continued:";
const UPSTREAMS = "limit-resume:";

/** The row a message shows as, or null for any message but a continuation. */
export function continuedWords(messageId: string): string | null {
  if (messageId.startsWith(UPSTREAMS)) return CONTINUED_WORDS.reset;
  if (!messageId.startsWith(OURS)) return null;
  const reason = messageId.slice(OURS.length).split(":", 1)[0];
  return reason === "signed-in" || reason === "reset" ? CONTINUED_WORDS[reason] : null;
}
