// Aski's own chats as the views read them (`chat.ts` picks them).

import { type EnvironmentThreadShell, useThreadShellsSelected } from "../upstream/cells";
import { askiChatsOf } from "./chat";

/** Whether `threadId` is Aski's own chat on its machine. */
export function useIsAskiChat(threadId: string): boolean {
  return useThreadShellsSelected((threads) => askiChatsOf(threads).has(threadId));
}

/** Aski's chat on `environmentId`'s machine, or on the first machine that has one when none is named. */
export function useAskiChat(environmentId: string | null): EnvironmentThreadShell | null {
  return useThreadShellsSelected((threads) => {
    const own = askiChatsOf(threads);
    return (
      threads.find(
        (thread) =>
          own.has(thread.id) && (environmentId === null || thread.environmentId === environmentId),
      ) ?? null
    );
  });
}
