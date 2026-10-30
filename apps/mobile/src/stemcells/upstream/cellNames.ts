// The other Cells a chat on the phone may name (stemcells/tasks/cell-tokens.md), by the rules
// the Mac reads them with (`stemcells/words/cellNames.ts`), from upstream's shells. A message
// draws again only when its chat's names change.
import { useThreadShellsSelected } from "./cells";
import type { EnvironmentThreadShell } from "./threads";
import { askiChatsOf } from "../aski/chat";
import type { ChatRef } from "../chat/inView";
import {
  type MentionChat,
  namesFor,
  signatureOf,
} from "../../../../../stemcells/words/cellNames.ts";

const byShells = new WeakMap<ReadonlyArray<EnvironmentThreadShell>, Map<string, string>>();

function signatureIn(shells: ReadonlyArray<EnvironmentThreadShell>, chat: ChatRef): string {
  const key = `${chat.environmentId}\u0000${chat.threadId}`;
  let cache = byShells.get(shells);
  if (cache === undefined) byShells.set(shells, (cache = new Map()));
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const aski = askiChatsOf(shells);
  const mentionOf = (shell: EnvironmentThreadShell): MentionChat => ({
    environmentId: shell.environmentId,
    id: shell.id,
    projectId: shell.projectId,
    gone:
      shell.lineage.relationshipToParent === "subagent" ||
      shell.archivedAt !== null ||
      shell.deletedAt !== null,
    aski: aski.has(shell.id),
    updatedAt: shell.updatedAt,
  });
  const self = shells.find(
    (shell) => shell.id === chat.threadId && shell.environmentId === chat.environmentId,
  );
  const signature =
    self === undefined ? "" : signatureOf(namesFor(mentionOf(self), shells.map(mentionOf)));
  cache.set(key, signature);
  return signature;
}

/** The Cells the chat may name, by name; none without a chat. */
export function useNamedCells(chat: ChatRef | null): ReadonlyMap<string, string> {
  const signature = useThreadShellsSelected((shells) =>
    chat === null ? "" : signatureIn(shells, chat),
  );
  return new Map(
    signature === "" ? [] : signature.split(",").map((pair) => pair.split("=") as [string, string]),
  );
}
