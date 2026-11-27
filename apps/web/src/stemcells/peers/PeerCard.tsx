/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (peers.css), outside upstream's Tailwind entry. */
import { Undo2Icon } from "lucide-react";
import { use, useState } from "react";

import { mailWord } from "../../../../../stemcells/words/cellMail.ts";
import { SubcellMark } from "../cell/SubcellMark";
import {
  ChatMarkdown,
  findRevealRef,
  formatChatTimestampTooltip,
  formatDayAwareTimestamp,
  MessageAuthorHeading,
  MessageCopyButton,
  type MessageRow,
  threadIdOf,
  TimelineRowActivityCtx,
  TimelineRowCtx,
  usePeerShell,
  useTallEnoughToFold,
} from "../upstream/peers";
import { T3Wordmark } from "../upstream/substitutes/T3Wordmark";
import { Button, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { CellDoor } from "./CellDoor";
import { CellToken } from "./CellToken";
import { useMachineLabel } from "../upstream/machines";
import { bodyOf, type Kind, type Sender } from "./exchange";
import { cellNameOf } from "../cell/name";
import { isAskiChat, peerNameOf } from "./names";
import { usePeerNote } from "./PeerExchange";

import "./peers.css";

// A message another Cell sent this one (stemcells/tasks/peers.md, decision 4): Cell Mail, under
// Stemcells' mark, in the transcript's own column and type, never the person's bubble. A sender
// here opens its chat; one on a linked machine is named with its machine and opens nothing.

const WAY: Readonly<Record<Kind, string>> = {
  ask: "asks you",
  reply: "replied",
  says: "says",
};

export function PeerCard(props: { readonly row: MessageRow; readonly sender: Sender }) {
  const { row, sender } = props;
  const { message } = row;
  const ctx = use(TimelineRowCtx);
  const shell = usePeerShell(ctx.activeThreadEnvironmentId, sender.cell);
  const machine = useMachineLabel(sender.machine) ?? "another machine";
  // A Cell elsewhere goes by the name its frame gave it: its own tab's.
  const name = sender.machine === null ? peerNameOf(sender.cell, shell) : cellNameOf(sender.cell);
  const aski = sender.machine === null && isAskiChat(sender.cell, shell);
  const mail = `${mailWord(aski)} from`;
  const note = usePeerNote(message.id) ?? { kind: "says" as const, answers: null, answered: false };
  const text = bodyOf(message.text, name);
  const { ref: contentRef, tallEnough: long } = useTallEnoughToFold(text.trim().length > 0);
  const [open, setOpen] = useState(false);
  const revealRef = findRevealRef(() => setOpen(true));
  const folded = long && !open;

  return (
    <article
      className="sc-peer-note px-1"
      data-stemcells-peer="in"
      aria-label={`${mail} ${name}${sender.machine === null ? "" : ` on ${machine}`}: ${WAY[note.kind]}`}
    >
      {/* As upstream's rows have: a screen reader moves between messages by their headings. */}
      <MessageAuthorHeading>
        {sender.machine === null ? name : `${name} on ${machine}`}
      </MessageAuthorHeading>
      <span className="sc-peer-figure">
        <T3Wordmark className="size-4 text-icon-muted" aria-hidden />
      </span>
      <header className="sc-peer-head text-xs">
        <span className="flex-none">{mail}</span>
        {sender.machine !== null ? (
          <span className="sc-peer-from">
            <SubcellMark name={sender.cell} points={1} />
            <span className="sc-peer-name">{name}</span> on {machine}
          </span>
        ) : aski ? (
          <CellDoor
            name={name}
            title={shell?.title}
            onOpen={() => ctx.onOpenThread(threadIdOf(sender.cell))}
          />
        ) : (
          <CellToken
            environmentId={ctx.activeThreadEnvironmentId}
            threadId={sender.cell}
            label={name}
          />
        )}
        {note.kind === "ask" ? <span className="flex-none">asks you</span> : null}
        {note.kind === "reply" ? <span className="flex-none">replied to</span> : null}
        {note.answers === null ? null : <span className="sc-peer-re">“{note.answers}”</span>}
        <span className="sc-peer-colon">:</span>
        <PeerMeta row={row} answered={note.kind === "ask" && note.answered} />
      </header>
      <div
        ref={revealRef}
        className="sc-peer-body"
        data-thread-find-text="true"
        data-thread-find-fold={folded ? "" : undefined}
        data-folded={folded ? "" : undefined}
      >
        <div ref={contentRef}>
          <ChatMarkdown
            text={text}
            cwd={ctx.markdownCwd}
            threadRef={ctx.threadRef ?? undefined}
            lineBreaks
            parseRawHtml={false}
          />
        </div>
      </div>
      {long ? (
        <div className="sc-peer-fold">
          <Button
            type="button"
            size="xs"
            variant="ghost-muted"
            aria-expanded={open}
            data-scroll-anchor-ignore
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Show less" : "Show full message"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

/** Answered, when, going back to it, copy: at the end of the name's line; the last three shown on hover and to touch. */
function PeerMeta({ row, answered }: { readonly row: MessageRow; readonly answered: boolean }) {
  const ctx = use(TimelineRowCtx);
  const activity = use(TimelineRowActivityCtx);
  const { message } = row;
  const turns = row.revertTurnCount;
  const status = row.projectedItem?.item.status;
  const failed =
    status !== undefined && status !== "completed" && status !== "pending" && status !== "waiting";
  const steered =
    message.inputIntent === "steer" || message.inputIntent === "promoted_queued_to_steer";
  return (
    <span className="sc-peer-meta">
      {answered ? <span className="sc-peer-answered">answered</span> : null}
      {failed ? <span className="sc-peer-status">{status}</span> : null}
      <span className="sc-peer-hover">
        {steered ? <span>mid-turn ·</span> : null}
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
      </span>
    </span>
  );
}
