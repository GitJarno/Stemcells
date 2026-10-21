/**
 * Upstream's right panel (a thread's surfaces: terminals, browser, diff,
 * files, pull requests), hosted by the tab rather than by each chat.
 *
 * Upstream draws the panel inside its thread view, beside the chat. With
 * several chats on a tab, the tab keeps one panel, the workbench, at the
 * slate's right edge, and it shows the focused chat's surfaces: the focused
 * chat's view renders its panel into the workbench, the others render none.
 * Upstream keeps each thread's surfaces apart, so focusing another chat shows
 * that chat's, as switching threads does upstream.
 */
import { createContext, use, type ComponentProps } from "react";
import { createPortal } from "react-dom";

import { RightPanelSheet } from "../../components/RightPanelSheet";
import { RightPanelTabs } from "../../components/RightPanelTabs";
import { useOwnedUntilRest } from "../surfaces/keep";

export interface ChatPanelHost {
  /** The workbench's node; null until it mounts. */
  readonly node: HTMLElement | null;
  /** Whether this chat's panel is the one the workbench shows. */
  readonly owns: boolean;
}

/** Null (the default): the panel stays beside its chat, as upstream draws it. */
export const ChatPanelHostContext = createContext<ChatPanelHost | null>(null);

/**
 * Upstream's panel, in the workbench when a host gives one. The sheet's own
 * tabs (narrow windows) stay inside the sheet.
 */
export function ChatPanelTabs(props: ComponentProps<typeof RightPanelTabs>) {
  const host = use(ChatPanelHostContext);
  // The page a turn leaves keeps its surfaces until the pages rest.
  const shows = useOwnedUntilRest(host?.owns ?? false, host?.node ?? null);
  const panel = <RightPanelTabs {...props} />;
  if (host === null || props.mode !== "inline") return panel;
  if (!shows || host.node === null) return null;
  return createPortal(panel, host.node);
}

/** Upstream's narrow-window sheet: a window overlay, so only the owning chat's opens. */
export function ChatPanelSheet(props: ComponentProps<typeof RightPanelSheet>) {
  const host = use(ChatPanelHostContext);
  if (host !== null && !host.owns) return null;
  return <RightPanelSheet {...props} />;
}
