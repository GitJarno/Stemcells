import { createContext, use } from "react";

/**
 * Whether a chat owns window-level input: shortcuts and typing that reach the
 * window rather than a field, paste-to-focus, and composer refocus. A host that
 * mounts several chats at once gives it to one of them, so a key acts once.
 */
export const ChatWindowInputContext = createContext(true);

export function useOwnsChatWindowInput(): boolean {
  return use(ChatWindowInputContext);
}
