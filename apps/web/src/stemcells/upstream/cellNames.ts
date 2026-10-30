/**
 * The other Cells a chat may name (stemcells/tasks/cell-tokens.md): those of its project on
 * its server, as the roster tells a Cell who works beside it; Aski names any. Read from
 * upstream's shells, held per chat while its names stay the same.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useQuietThreadShells } from "../../state/entities";
import { type MentionChat, namesFor, signatureOf } from "../peers/mentions";
import { isAskiChat } from "../peers/names";

export interface NamedCells {
  /** Its names and their chats, in one line: equal while the names are. */
  readonly signature: string;
  readonly names: ReadonlyMap<string, string>;
}

const NONE: NamedCells = { signature: "", names: new Map() };
const byShells = new WeakMap<ReadonlyArray<EnvironmentThreadShell>, Map<string, NamedCells>>();
const lastByChat = new Map<string, NamedCells>();

const chatOf = (shell: EnvironmentThreadShell): MentionChat => ({
  environmentId: shell.environmentId,
  id: shell.id,
  projectId: shell.projectId,
  gone:
    shell.lineage.relationshipToParent === "subagent" ||
    shell.archivedAt !== null ||
    shell.deletedAt !== null,
  aski: isAskiChat(shell.id, {
    providerInstanceId: shell.providerInstanceId,
    parentThreadId: shell.lineage.parentThreadId,
  }),
  updatedAt: shell.updatedAt,
});

/** The Cells the chat may name, by name; none without a chat. */
export function useNamedCells(ref: ScopedThreadRef | null | undefined): NamedCells {
  const shells = useQuietThreadShells();
  if (ref == null) return NONE;
  const key = `${ref.environmentId}\u0000${ref.threadId}`;
  let cache = byShells.get(shells);
  if (cache === undefined) byShells.set(shells, (cache = new Map()));
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const self = shells.find(
    (shell) => shell.id === ref.threadId && shell.environmentId === ref.environmentId,
  );
  const names = self === undefined ? NONE.names : namesFor(chatOf(self), shells.map(chatOf));
  const signature = signatureOf(names);
  const last = lastByChat.get(key);
  const named = last?.signature === signature ? last : { signature, names };
  lastByChat.set(key, named);
  cache.set(key, named);
  return named;
}
