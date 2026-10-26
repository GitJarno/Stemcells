// Aski's own chat on each machine, picked as the Mac and server pick it (the web's
// `askiChatAmong` in `aski/setup.ts`, the server's `askiThreadOf`): the top-level chat on
// Aski's provider instance, the pinned one first, else the first made. Another chat on that
// instance (a new chat opened from Aski's page) is a Cell like any.

import type { EnvironmentThreadShell } from "../upstream/threads";

/** Aski's provider instance (`apps/server/src/stemcells/upstream/askiInstance.ts`). */
export const ASKI_INSTANCE = "aski";

type ChatShell = Pick<
  EnvironmentThreadShell,
  "id" | "environmentId" | "providerInstanceId" | "lineage" | "pinnedAt" | "createdAt" | "deletedAt"
>;

const picks = new WeakMap<ReadonlyArray<ChatShell>, ReadonlySet<string>>();

/** The ids of Aski's own chats among `threads`, one a machine at most; every view asking of one list shares the answer. */
export function askiChatsOf(threads: ReadonlyArray<ChatShell>): ReadonlySet<string> {
  const known = picks.get(threads);
  if (known !== undefined) return known;
  const own = new Map<string, ChatShell>();
  for (const thread of threads) {
    if (thread.providerInstanceId !== ASKI_INSTANCE) continue;
    if (thread.lineage.parentThreadId !== null || thread.deletedAt !== null) continue;
    const held = own.get(thread.environmentId);
    const pinned = (chat: ChatShell) => (chat.pinnedAt == null ? 1 : 0);
    if (
      held === undefined ||
      pinned(thread) < pinned(held) ||
      (pinned(thread) === pinned(held) && thread.createdAt < held.createdAt)
    )
      own.set(thread.environmentId, thread);
  }
  const picked = new Set([...own.values()].map((chat) => chat.id));
  picks.set(threads, picked);
  return picked;
}
