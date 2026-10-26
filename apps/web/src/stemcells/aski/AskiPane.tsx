import { useEffect, useEffectEvent, useRef } from "react";

import { useAskiChat, type AskiChat } from "../upstream/aski";
import { useLeadWindow } from "../windows/lead";
import { ChatPaneView } from "../upstream/chat";
import type { ThreadRouteTarget } from "../upstream/routes";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../upstream/ui";
import { ComposerRoofSlot } from "../composer/slot";
import { AnswersProvider } from "../needs/answers/room";
import { NeedsFrame } from "../needs/NeedsFrame";
import { Peek } from "../needs/Peek";
import { usePeek } from "../needs/peeking";
import { subscribeLaunches } from "../upstream/landing";
import { Roster } from "../needs/Roster";
import { useColumnShowsCards } from "../rail/LeftColumn";
import { AskiFigure } from "./AskiFigure";
import { copiesOut } from "./copies";
import { AskiPerch } from "./AskiPerch";
import { AskiMoments } from "./moments/AskiMoments";

import "./room.css";

/**
 * Keeps Aski's chat: sets it up through upstream and hands it to the
 * workspace whenever it changes. Renders nothing; it lives apart from the
 * workspace so the server's provider updates re-render only it.
 */
export function AskiKeeper(props: { onChat: (chat: AskiChat) => void }) {
  // Every window follows Aski's chat; only the lead window sets one up.
  const chat = useAskiChat(useLeadWindow());
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
 * Aski's pane: its chat, with Aski in it, and beside them what needs the
 * person (NeedsFrame). The chat is upstream's thread view, bare: Aski has no
 * project, so no surface or terminal opens under it (aski-manager.md,
 * decision 1). Aski stands over its composer where a Cell's line would
 * (AskiPerch); until the chat exists, Aski stands over why. Aski's eyes
 * follow the pointer anywhere over the pane, and the caret in its chat's
 * field. A Cell opened from the roster or a card is peeked at over it
 * (needs/Peek.tsx), and has the window's input meanwhile; a link in Aski's
 * chat opens its chat in a tab of its own, as a chip does anywhere, so the
 * talk with Aski stays on screen.
 * Each Cell launched while the room shows, a copy of Aski flies to where
 * it landed (aski/copies.ts).
 */
export function AskiPane(props: {
  chat: AskiChat;
  target: ThreadRouteTarget | null;
  ownsWindowInput: boolean;
  /** Whether Aski's pane is its tab's focused one. */
  focused: boolean;
}) {
  const aski = props.chat.status === "ready" ? props.chat.cell : null;
  const room = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      subscribeLaunches((cells) => {
        const figure = room.current?.querySelector("[data-aski-perch-stage]");
        if (figure)
          void copiesOut(
            figure,
            cells.map((cell) => cell.threadId),
          );
      }),
    [],
  );
  const peeking = usePeek() !== null;
  const ownsInput = props.ownsWindowInput && !peeking;
  const inColumn = useColumnShowsCards();
  return (
    <div
      ref={room}
      data-stemcells-aski=""
      data-aski-looks=""
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <NeedsFrame aski={aski} ownsWindowInput={ownsInput}>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col [&>main]:h-full!">
          {props.target ? (
            <ComposerRoofSlot value={aski ? <AskiPerch aski={aski} /> : null}>
              {/* Words in its composer answer the cards beside it. */}
              <AnswersProvider>
                <ChatPaneView
                  target={props.target}
                  ownsWindowInput={ownsInput}
                  focused={props.focused}
                  panelHost={null}
                  bare
                />
              </AnswersProvider>
            </ComposerRoofSlot>
          ) : (
            <Empty>
              <AskiMoments aski={aski}>
                <AskiFigure aski={aski} />
              </AskiMoments>
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
        {/* Every Cell's stage, under the chat (aski-manager.md, decision 10),
            while the Cells' column isn't showing them (left-column.md, decision 11). */}
        {inColumn ? null : <Roster />}
      </NeedsFrame>
      <Peek ownsWindowInput={props.ownsWindowInput} />
    </div>
  );
}
