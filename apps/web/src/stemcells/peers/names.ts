// What one chat calls another: Aski by its own name, any other Cell by the
// name its tab shows (`cell/name.ts`), the name its peer frame gave it too.

import { mailWord } from "../../../../../stemcells/words/cellMail.ts";
import { ASKI_INSTANCE_ID, ASKI_TITLE, isRememberedAskiThread } from "../aski/setup";
import { cellNameOf } from "../cell/name";
import { gistOf } from "./exchange";

interface ShellFacts {
  readonly providerInstanceId: string;
  readonly parentThreadId: string | null;
}

/**
 * Whether the other chat is Aski's: with its shell, the top-level chat on
 * Aski's instance; without one, the Aski chat this browser remembers.
 */
export function isAskiChat(threadId: string, shell?: ShellFacts | null): boolean {
  return shell == null
    ? isRememberedAskiThread(threadId)
    : shell.providerInstanceId === ASKI_INSTANCE_ID && shell.parentThreadId === null;
}

/** The other chat's name. */
export function peerNameOf(threadId: string, shell?: ShellFacts | null): string {
  return isAskiChat(threadId, shell) ? ASKI_TITLE : cellNameOf(threadId);
}

/** A `t3_thread_send` row's words: "Cell Mail to Otter: Took 0044.", "Mail to Aski: Took 0044." */
export function sentLabel(sent: { readonly to: string; readonly text: string }): string {
  const { gist } = gistOf(sent.text);
  return `${mailWord(isAskiChat(sent.to))} to ${peerNameOf(sent.to)}: ${gist}`;
}
