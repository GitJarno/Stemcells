/**
 * A reply's close-out as a card, where its lines stood (stemcells/tasks/close-out-card.md): the
 * Cell's word for where the work stands and whose the next step is, each line drawn as the
 * reply's own markdown. Under it, on the Cell's latest reply alone, what the server's records
 * show. Copied, it is the lines the Cell wrote.
 */
import { Fragment, type ClipboardEvent, type ComponentType, type ReactNode } from "react";

import type { CloseOutLine, WrittenCloseOut } from "../../../../../stemcells/closeOut/closeOut.ts";
import { CLOSE_OUT_LABEL, RUN_SHOWS } from "../../../../../stemcells/words/closeOut.ts";
import { useNeeds } from "../needs/stream";
import { useLatestRunId } from "../upstream/reply";
import { isLatest, type Reply } from "./reply";
import { shownOf } from "./shown";

// The facts wear the look Aski's room gives them.
import "../needs/needs.css";
import "./closeOut.css";

/** A fact that can be seen somewhere, drawn as the reply's own link. */
export type FactLink<Chat> = ComponentType<{
  readonly chat: Chat;
  readonly text: string;
  readonly href: string;
}>;

/** A step with no owner word may be the person's, as the server reads it (`stopOf`). */
function standsOf(line: CloseOutLine): "done" | "you" | "me" | "waiting" {
  if (line.kind === "done") return "done";
  if (line.nothing) return "waiting";
  return line.owner ?? "you";
}

/** The part of the card a selection's end lies in: a line's words, or the run's facts. */
const partAt = (node: Node): Element | null =>
  (node instanceof Element ? node : node.parentElement)?.closest(
    "[data-close-out-words], [data-close-out-shown]",
  ) ?? null;

export function CloseOutCard(props: {
  closeOut: WrittenCloseOut;
  /** Each line's words as the reply's own markdown, in the lines' order. */
  words: ReadonlyArray<ReactNode>;
  /** What the run shows, on the latest reply (`LatestShown`). */
  foot: ReactNode;
}) {
  const { lines, source } = props.closeOut;
  const stands = lines.map(standsOf);
  // A selection within one line's words or the facts copies as any does; across lines, as written.
  const copyAsWritten = (event: ClipboardEvent<HTMLElement>) => {
    const selection = window.getSelection();
    if (selection === null || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!event.currentTarget.contains(range.endContainer)) return;
    const from = partAt(range.startContainer);
    if (from !== null && from === partAt(range.endContainer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.clipboardData.setData("text/plain", source);
  };
  return (
    <fieldset
      data-stemcells-close-out=""
      data-asks={stands.includes("you") || undefined}
      data-markdown-copy={`${source}\n\n`}
      onCopyCapture={copyAsWritten}
    >
      <legend>{CLOSE_OUT_LABEL[lines[0]?.kind ?? "done"]}</legend>
      <div data-close-out-lines="">
        {lines.map((line, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- A settled reply's lines, in order.
          <Fragment key={index}>
            {index > 0 && line.kind !== lines[index - 1]?.kind ? (
              <div data-close-out-label="">{CLOSE_OUT_LABEL[line.kind]}</div>
            ) : null}
            <div data-close-out-line="" data-stands={stands[index]}>
              {line.owner === null ? null : <span data-close-out-owner="">{line.owner}</span>}
              {line.text === "" ? null : <div data-close-out-words="">{props.words[index]}</div>}
            </div>
          </Fragment>
        ))}
      </div>
      {props.foot}
    </fieldset>
  );
}

interface ShownProps<Chat> {
  readonly chat: Chat;
  readonly Link: FactLink<Chat>;
}

/** Only the chat's latest reply hears the server's list: an older one draws nothing here. */
export function LatestShown<Chat extends { readonly threadId: string }>(
  props: ShownProps<Chat> & { readonly reply: Reply },
) {
  return isLatest(props.reply, useLatestRunId()) ? (
    <RunShown chat={props.chat} Link={props.Link} />
  ) : null;
}

function RunShown<Chat extends { readonly threadId: string }>(props: ShownProps<Chat>) {
  const { cells } = useNeeds();
  const shown = shownOf(cells?.find((cell) => cell.threadId === props.chat.threadId));
  if (shown === null) return null;
  const { verdict, changed, facts } = shown;
  return (
    <div data-close-out-shown="" data-need-facts="" role="group" aria-label={RUN_SHOWS}>
      {verdict === null ? null : (
        <span data-close-out-verdict={verdict.is}>
          <b aria-hidden="true">{verdict.mark}</b>
          {verdict.name}
        </span>
      )}
      {changed === null ? null : (
        <span data-need-fact="">
          {changed.bar.length > 0 ? (
            <span data-need-bar="" aria-hidden="true">
              {changed.bar.map((cell, index) => (
                // oxlint-disable-next-line react/no-array-index-key -- Five cells in a fixed order.
                <i key={index} data-cell={cell} />
              ))}
            </span>
          ) : null}
          {changed.words}
        </span>
      )}
      {facts.map((fact) => (
        <span key={fact.id} data-need-fact="" data-tone={fact.tone}>
          {fact.href === null ? (
            fact.text
          ) : (
            <props.Link chat={props.chat} text={fact.text} href={fact.href} />
          )}
        </span>
      ))}
    </div>
  );
}
