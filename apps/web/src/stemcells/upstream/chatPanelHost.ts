// Where a chat's panel goes, apart from the panel itself: what reads it (the terminal drawer, the
// shortcuts) mustn't load upstream's whole right panel with it.
import { createContext } from "react";

export interface ChatPanelHost {
  /** The workbench's node; null until it mounts. */
  readonly node: HTMLElement | null;
  /** Whether this chat's panel is the one the workbench shows. */
  readonly owns: boolean;
  /** Whether this chat is its page's focused one, whose panel the workbench shows on stage. */
  readonly focused: boolean;
  /** The chat's thread (a draft's is its thread), which the panel names while it holds its surfaces. */
  readonly threadKey: string | null;
  /** A chat with no surfaces and no terminal (Aski's): it has no project to show them for. */
  readonly bare?: boolean;
}

/** Null (the default): the panel stays beside its chat, as upstream draws it. */
export const ChatPanelHostContext = createContext<ChatPanelHost | null>(null);
