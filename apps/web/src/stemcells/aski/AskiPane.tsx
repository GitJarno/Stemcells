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
import { RecallScope } from "../recall/RecallPills";
import { subscribeLaunches } from "../upstream/landing";
import { AskiFigure } from "./AskiFigure";
import { copiesOut } from "./copies";
import { awakeInSight } from "../rail/arrivals";
import { throwTo } from "./throw";
import { AskiPerch } from "./AskiPerch";
import { AskiMoments } from "./moments/AskiMoments";
import { PlanTray } from "./plan/PlanTray";
import { PlanRoom } from "./plan/room";

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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Report Aski's chat to the workspace each time its status changes.
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
 * Aski's pane: upstream's thread view, bare (Aski has no project, so no surface or terminal;
 * aski-manager.md, decision 1), with what needs the person beside it (NeedsFrame). A Cell
 * opened from an ask is peeked at over it (needs/Peek.tsx) and has the window's input
 * meanwhile; a link in Aski's chat opens a tab, so the talk with Aski stays on screen.
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fly a copy of Aski to each Cell launched while the room shows; unsubscribe on unmount.
  useEffect(
    () =>
      subscribeLaunches((cells) => {
        const figure = room.current?.querySelector("[data-aski-perch-stage]");
        if (!figure) return;
        const threadIds = cells.map((cell) => cell.threadId);
        // To its row at Awake's top, where the Cell forms (`rail/arrivals.ts`); with Awake out of sight, to its tab's chip.
        if (awakeInSight()) throwTo(threadIds, figure);
        else void copiesOut(figure, threadIds);
      }),
    [],
  );
  const peeking = usePeek() !== null;
  const ownsInput = props.ownsWindowInput && !peeking;
  return (
    <div
      ref={room}
      data-stemcells-aski=""
      data-aski-looks=""
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <NeedsFrame aski={aski}>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col [&>main]:h-full!">
          {props.target ? (
            <ComposerRoofSlot
              value={
                aski ? (
                  <>
                    <AskiPerch aski={aski} />
                    {/* The plans its messages became stand on the composer, under Aski. */}
                    <PlanTray aski={aski} />
                  </>
                ) : null
              }
            >
              {/* Words in its composer answer the cards beside it, and start Cells as a plan. */}
              <PlanRoom value={aski}>
              <AnswersProvider>
                {/* A question about the past shows the Cells it found under it. */}
                <RecallScope value>
                  <ChatPaneView
                    target={props.target}
                    ownsWindowInput={ownsInput}
                    focused={props.focused}
                    panelHost={null}
                    bare
                  />
                </RecallScope>
              </AnswersProvider>
              </PlanRoom>
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
      </NeedsFrame>
      <Peek ownsWindowInput={props.ownsWindowInput} />
    </div>
  );
}
