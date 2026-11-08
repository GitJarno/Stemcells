import { createContext } from "react";

/**
 * The chat whose header a bar draws, from `ThreadHeader`'s substitute to `AppBar`'s: `titled`
 * when the Cell stands beside its name there (`CellTitle`), not in a draft or a chat not yet known.
 */
export const ChatHeaderContext = createContext<{
  readonly threadId: string;
  readonly titled: boolean;
} | null>(null);
