import { ArrowUpRightIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cellNameOf } from "../cell/name";
import { PaneCellContext } from "../tabs/paneCell";
import type { CellRef } from "../tabs/layout";
import { timing } from "../tokens/motion";
import { ChatPaneView, useCellLastSent, useCellPresence } from "../upstream/chat";
import { layerOpen } from "../upstream/layers";
import { usePrimaryEnvironmentId } from "../upstream/needs";
import { useNavigateToCell } from "../upstream/routes";
import { useCellPlace, useCellTitle } from "../upstream/thread";
import { closePeek, usePeek } from "./peeking";
import { useCellStage } from "./stream";

import "./peek.css";

/**
 * A Cell's chat, slid in from the right over Aski's room
 * (stemcells/tasks/aski-manager.md, decision 9): read it, answer it, and
 * it goes. It leaves a beat after the person sends it a message, or once
 * what it needed from them is answered; Esc, ×, or a click elsewhere in the
 * room close it too. "Open in its tab" takes the person there instead.
 * While it is open it has the window's input, which Aski's chat gives up.
 */
export function Peek(props: { ownsWindowInput: boolean }) {
  const threadId = usePeek();
  const environmentId = usePrimaryEnvironmentId();
  if (threadId === null || environmentId === null) return null;
  return (
    <PeekSheet
      key={threadId}
      cell={{ environmentId, threadId, draftId: null }}
      ownsWindowInput={props.ownsWindowInput}
    />
  );
}

function PeekSheet(props: { cell: CellRef; ownsWindowInput: boolean }) {
  const { cell } = props;
  const sheet = useRef<HTMLElement>(null);
  const presence = useCellPresence(cell);
  const title = useCellTitle(cell);
  const place = useCellPlace(cell);
  const navigateToCell = useNavigateToCell();
  const lastSent = useCellLastSent(cell);
  const stage = useCellStage(cell.threadId);
  // What the Cell stood at when the peek opened, once known.
  const [openedWith, setOpenedWith] = useState<{
    readonly sent: string | null | undefined;
    readonly stage: typeof stage;
  } | null>(null);
  if (openedWith === null && lastSent !== undefined) setOpenedWith({ sent: lastSent, stage });

  // The person said their piece: a message sent, or what it asked of them answered.
  const said =
    openedWith !== null &&
    ((lastSent !== undefined && lastSent !== openedWith.sent) ||
      (openedWith.stage === "needs-you" && stage !== null && stage !== "needs-you"));
  useEffect(() => {
    if (!said) return;
    const timer = setTimeout(closePeek, timing("sendLanded"));
    return () => clearTimeout(timer);
  }, [said]);

  useEffect(() => {
    const room = sheet.current?.closest<HTMLElement>("[data-stemcells-aski]");
    // Esc the chat hasn't taken (a menu, a mention, a word being composed),
    // while the room is on stage.
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      if (layerOpen() || sheet.current?.closest("[inert]")) return;
      event.preventDefault();
      closePeek();
    };
    // Elsewhere in the room, not in a menu or a toast the chat opened over it.
    const pointerdown = (event: PointerEvent) => {
      if (!sheet.current?.contains(event.target as Node | null)) closePeek();
    };
    window.addEventListener("keydown", keydown);
    room?.addEventListener("pointerdown", pointerdown);
    return () => {
      window.removeEventListener("keydown", keydown);
      room?.removeEventListener("pointerdown", pointerdown);
    };
  }, []);

  const name = cellNameOf(cell.threadId);
  return (
    <aside ref={sheet} data-stemcells-peek="" aria-label={`${name}'s chat`}>
      <div data-peek-head="">
        <b>{name}</b>
        {title ? <span data-peek-title="">{title}</span> : null}
        {place ? <span data-peek-place="">{place.name}</span> : null}
        <button
          type="button"
          data-peek-act=""
          onClick={() => {
            closePeek();
            navigateToCell(cell);
          }}
        >
          <ArrowUpRightIcon aria-hidden />
          <span>Open in its tab</span>
        </button>
        <button type="button" data-peek-act="" aria-label="Close" onClick={closePeek}>
          <XIcon aria-hidden />
        </button>
      </div>
      <div
        data-peek-chat=""
        className="relative flex min-h-0 min-w-0 flex-1 flex-col [&>main]:h-full!"
      >
        {presence.target ? (
          <PaneCellContext value={cell}>
            <ChatPaneView
              target={presence.target}
              ownsWindowInput={props.ownsWindowInput}
              focused
              panelHost={null}
              bare
            />
          </PaneCellContext>
        ) : null}
      </div>
    </aside>
  );
}
