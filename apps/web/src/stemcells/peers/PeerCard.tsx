/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (peers.css), outside upstream's Tailwind entry. */
import { Undo2Icon } from "lucide-react";
import { use, useState } from "react";

import { SubcellMark } from "../cell/SubcellMark";
import {
  ChatMarkdown,
  findRevealRef,
  formatChatTimestampTooltip,
  formatDayAwareTimestamp,
  MessageCopyButton,
  type MessageRow,
  type ThreadId,
  TimelineRowActivityCtx,
  TimelineRowCtx,
  usePeerShell,
} from "../upstream/peers";
import { Button, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { CellDoor } from "./CellDoor";
import { gistOf, type Kind } from "./exchange";
import { isAskiChat, peerNameOf } from "./names";
import { usePeerNote } from "./PeerExchange";

import "./peers.css";

// A message another Cell sent this one (stemcells/tasks/peers.md, decision
// 4): mail the Cell received, not the conversation, so it never wears the
// person's bubble. Read in order: who and which way, the question a reply
// answers, the gist, then the rest, folded. Its sender is a door to its chat.
// Under it, as under the person's own message: when, going back to it, copy.

const WAY: Readonly<Record<Kind, string>> = {
  ask: "asks you",
  reply: "replied",
  says: "says",
};

export function PeerCard(props: {
  readonly row: MessageRow;
  readonly message: MessageRow["message"] & { readonly senderThreadId: ThreadId };
}) {
  const { row, message } = props;
  const ctx = use(TimelineRowCtx);
  const shell = usePeerShell(ctx.activeThreadEnvironmentId, message.senderThreadId);
  const name = peerNameOf(message.senderThreadId, shell);
  const aski = isAskiChat(message.senderThreadId, shell);
  const note = usePeerNote(message.id) ?? {
    kind: "says" as const,
    answers: null,
    answered: false,
    ...gistOf(message.text),
  };
  const [open, setOpen] = useState(false);
  const revealRef = findRevealRef(() => setOpen(true));
  // Find reads the DOM, so the folded rest stays mounted, hidden, while find is open.
  const restMounted = note.rest !== "" && (open || ctx.findActive);

  const steered =
    message.inputIntent === "steer" || message.inputIntent === "promoted_queued_to_steer";

  return (
    <div className="flex flex-col items-end gap-1" data-stemcells-peer="in">
      <article className="sc-peer-card" aria-label={`${name} ${WAY[note.kind]}`}>
        <header className="sc-peer-head">
          <CellDoor
            name={name}
            title={shell?.title}
            onOpen={() => ctx.onOpenThread(message.senderThreadId)}
          >
            {aski ? null : <SubcellMark name={message.senderThreadId} />}
          </CellDoor>
          <span className="sc-peer-way">{WAY[note.kind]}</span>
          {steered ? <span className="sc-peer-way">mid-turn</span> : null}
          {note.kind === "ask" && note.answered ? (
            <span className="sc-peer-answered">Answered</span>
          ) : null}
        </header>
        {note.answers === null ? null : (
          <p className="sc-peer-re">
            <span aria-hidden>↩ </span>
            {note.answers}
          </p>
        )}
        <p className="sc-peer-gist" data-thread-find-text="true">
          {note.gist}
        </p>
        {note.rest === "" ? null : (
          <>
            {open ? null : (
              <button
                type="button"
                className="sc-peer-more"
                aria-expanded={false}
                onClick={() => setOpen(true)}
              >
                {note.rest.split("\n", 1)[0]}
              </button>
            )}
            {restMounted ? (
              <div
                ref={revealRef}
                hidden={!open}
                className="sc-peer-rest"
                data-thread-find-text="true"
              >
                <ChatMarkdown
                  text={note.rest}
                  cwd={ctx.markdownCwd}
                  threadRef={ctx.threadRef ?? undefined}
                  lineBreaks
                  parseRawHtml={false}
                />
              </div>
            ) : null}
          </>
        )}
      </article>
      <PeerFoot row={row} />
    </div>
  );
}

function PeerFoot({ row }: { readonly row: MessageRow }) {
  const ctx = use(TimelineRowCtx);
  const activity = use(TimelineRowActivityCtx);
  const { message } = row;
  const turns = row.revertTurnCount;
  const status = row.projectedItem?.item.status;
  const failed =
    status !== undefined && status !== "completed" && status !== "pending" && status !== "waiting";
  return (
    <div className="sc-peer-foot">
      {failed ? <span className="sc-peer-status">{status}</span> : null}
      <Tooltip>
        <TooltipTrigger render={<span className="tabular-nums" />}>
          {formatDayAwareTimestamp(message.createdAt, ctx.timestampFormat)}
        </TooltipTrigger>
        <TooltipPopup>
          {formatChatTimestampTooltip(message.createdAt, ctx.timestampFormat)}
        </TooltipPopup>
      </Tooltip>
      {typeof turns === "number" ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={activity.isRevertingCheckpoint || activity.isWorking}
                onClick={() => ctx.onRevertToTurnCount(turns, message.id)}
                aria-label="Edit from here"
              />
            }
          >
            <Undo2Icon className="size-3" />
          </TooltipTrigger>
          <TooltipPopup side="top">Edit from here</TooltipPopup>
        </Tooltip>
      ) : null}
      <MessageCopyButton text={message.text} variant="ghost" />
    </div>
  );
}
