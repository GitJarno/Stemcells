import { useEffect, useEffectEvent } from "react";

import { useAskiChat, type AskiChat } from "../upstream/aski";
import { ChatPaneView } from "../upstream/chat";
import type { ThreadRouteTarget } from "../upstream/routes";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../upstream/ui";
import { NeedsFrame } from "../needs/NeedsFrame";
import { PaneRows } from "../tabs/PaneButtons";
import { AskiFigure } from "./AskiFigure";
import { AskiMoments } from "./moments/AskiMoments";

/**
 * Keeps Aski's chat: sets it up through upstream and hands it to the
 * workspace whenever it changes. Renders nothing; it lives apart from the
 * workspace so the server's provider updates re-render only it.
 */
export function AskiKeeper(props: { onChat: (chat: AskiChat) => void }) {
  const chat = useAskiChat();
  // A new object for the same chat is no change.
  const key =
    chat.status === "ready"
      ? `ready:${chat.cell.environmentId}/${chat.cell.threadId}`
      : chat.status === "unavailable"
        ? `unavailable:${chat.reason}`
        : chat.status;
  const report = useEffectEvent((_key: string) => props.onChat(chat));
  useEffect(() => report(key), [key]);
  return null;
}

/** Why Aski has no chat yet, in the words its tab and pane say it. */
export const ASKI_UNAVAILABLE: Record<
  Extract<AskiChat, { status: "unavailable" }>["reason"],
  string
> = {
  "no-server": "Aski lives on this Mac's server. Connect to it to talk to Aski.",
  "no-provider": "Aski talks through Claude or Codex. Install one, then come back.",
  "no-project": "Add a project, and Aski starts its chat there.",
  failed: "Aski's chat couldn't start. Reload to try again.",
};

/**
 * Aski's pane: Aski over its chat, and beside them what needs the person
 * while anything does (NeedsFrame). The chat is upstream's thread view, as
 * in any pane; until it exists, the pane says why. Aski's eyes follow the
 * pointer anywhere over the pane, and the caret in its chat's field.
 */
export function AskiPane(props: {
  chat: AskiChat;
  target: ThreadRouteTarget | null;
  ownsWindowInput: boolean;
  /** The tab's workbench, where Aski's surfaces show while its chat is focused. */
  panelHost: HTMLElement | null;
}) {
  const aski = props.chat.status === "ready" ? props.chat.cell : null;
  return (
    <div data-stemcells-aski="" data-aski-looks="" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <NeedsFrame aski={aski} ownsWindowInput={props.ownsWindowInput}>
        <div
          data-stemcells-aski-stage=""
          className="flex shrink-0 justify-center border-b border-border py-3"
        >
          <AskiMoments aski={aski}>
            <AskiFigure aski={aski} />
          </AskiMoments>
        </div>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col [&>main]:h-full!">
          {/* With the Surface open, upstream's two rows of toggles sit side by side, as in any pane. */}
          <PaneRows />
          {props.target ? (
            <ChatPaneView
              target={props.target}
              ownsWindowInput={props.ownsWindowInput}
              panelHost={props.panelHost}
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Aski</EmptyTitle>
                <EmptyDescription>
                  {props.chat.status === "unavailable"
                    ? ASKI_UNAVAILABLE[props.chat.reason]
                    : "Aski is getting its chat ready."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </NeedsFrame>
    </div>
  );
}
