/**
 * The other Cells a chat may name (stemcells/tasks/cell-tokens.md): those of its project on
 * its server, as the roster tells a Cell who works beside it; Aski names any. Read from
 * upstream's shells, held per chat while its names stay the same.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useQuietThreadShells } from "../../state/entities";
import { cellNameOf } from "../cell/name";
import { namesOf } from "../peers/mentions";
import { isAskiChat } from "../peers/names";

export interface NamedCells {
  /** Its names and their chats, in one line: equal while the names are. */
  readonly signature: string;
  readonly names: ReadonlyMap<string, string>;
}

const NONE: NamedCells = { signature: "", names: new Map() };
const byShells = new WeakMap<ReadonlyArray<EnvironmentThreadShell>, Map<string, NamedCells>>();
const lastByChat = new Map<string, NamedCells>();

const factsOf = (shell: EnvironmentThreadShell) => ({
  providerInstanceId: shell.providerInstanceId,
  parentThreadId: shell.lineage.parentThreadId,
});

function namedBy(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  ref: ScopedThreadRef,
): ReadonlyMap<string, string> {
  const self = shells.find(
    (shell) => shell.id === ref.threadId && shell.environmentId === ref.environmentId,
  );
  if (self === undefined) return NONE.names;
  const aski = isAskiChat(self.id, factsOf(self));
  return namesOf(
    shells
      .filter(
        (shell) =>
          shell.environmentId === self.environmentId &&
          shell.id !== self.id &&
          shell.lineage.relationshipToParent !== "subagent" &&
          shell.archivedAt === null &&
          shell.deletedAt === null &&
          !isAskiChat(shell.id, factsOf(shell)) &&
          (aski || shell.projectId === self.projectId),
      )
      .map((shell) => ({ id: shell.id, name: cellNameOf(shell.id), updatedAt: shell.updatedAt })),
  );
}

/** The Cells the chat may name, by name; none without a chat. */
export function useNamedCells(ref: ScopedThreadRef | null | undefined): NamedCells {
  const shells = useQuietThreadShells();
  if (ref == null) return NONE;
  const key = `${ref.environmentId}\u0000${ref.threadId}`;
  let cache = byShells.get(shells);
  if (cache === undefined) byShells.set(shells, (cache = new Map()));
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const names = namedBy(shells, ref);
  const signature = [...names]
    .map(([name, id]) => `${name}=${id}`)
    .toSorted()
    .join(",");
  const last = lastByChat.get(key);
  const named = last?.signature === signature ? last : { signature, names };
  lastByChat.set(key, named);
  cache.set(key, named);
  return named;
}
