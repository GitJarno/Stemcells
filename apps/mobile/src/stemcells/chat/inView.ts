// The chat a thread screen shows, so the words in it can name the Cells beside it
// (stemcells/tasks/cell-tokens.md). Ids only: a shell's every tick would redraw each message.
import { createContext, use } from "react";

export interface ChatRef {
  readonly environmentId: string;
  readonly threadId: string;
}

export const ChatInView = createContext<ChatRef | null>(null);

export function useChatInView(): ChatRef | null {
  return use(ChatInView);
}
