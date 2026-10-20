/** A server's chats as Aski reads them, to find its own among them. */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import type { ChatFact } from "../aski/setup";

export function chatFactsOf(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  environmentId: string,
): ChatFact[] {
  return shells
    .filter((shell) => shell.environmentId === environmentId)
    .map((shell) => ({
      threadId: shell.id,
      instanceId: shell.providerInstanceId,
      pinned: shell.pinnedAt != null,
      topLevel: shell.lineage.parentThreadId === null,
      deleted: shell.deletedAt != null,
      createdAt: shell.createdAt,
    }));
}
