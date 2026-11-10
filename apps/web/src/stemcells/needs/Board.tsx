import { useState } from "react";

import { cellNameOf } from "../cell/name";
import { CellMini } from "../rail/CellMini";
import { compactAge } from "../upstream/cellRow";
import { useNowMinuteMs, usePrimaryEnvironmentId } from "../upstream/needs";
import { useAccountNames } from "../upstream/rail";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { boardOf, VERDICTS, type BoardRow } from "./boardRows";
import { conditionLineOf } from "./conditionLines";
import { continueHeld } from "./held";
import { spansOf } from "./inline";
import { openPeek } from "./peeking";
import { RunFacts } from "./RunFacts";
import { useNeeds } from "./stream";

import "./board.css";

const STAGES = { holding: "Holding", landed: "Landed", flying: "Flying" } as const;
type BoardStage = keyof typeof STAGES;

/**
 * Aski's room as a board (aski-board.md): Cells a shared stop holds (conditions.md) under the
 * line that says what stopped them, then what landed and how, then what flies. `compact` while
 * an ask is in front: a line of figures a stage. Figures are held still, so it costs no frame.
 */
export function Board(props: { compact: boolean }) {
  const { cells, conditions } = useNeeds();
  const environmentId = usePrimaryEnvironmentId();
  const accounts = useAccountNames();
  const now = useNowMinuteMs();
  if (cells === null || environmentId === null) return null;
  const board = boardOf(cells, conditions);
  if (board.counts.holding + board.counts.landed + board.counts.flying === 0) return null;
  return (
    <section
      data-stemcells-board=""
      data-compact={props.compact || undefined}
      aria-label="Where the Cells stand"
    >
      {board.holding.map(({ condition, rows, count }) => {
        const line = conditionLineOf(condition, now);
        const account = accounts.get(condition.providerInstanceId);
        return (
          <Stage
            key={condition.key}
            stage="holding"
            rows={rows}
            count={count}
            compact={props.compact}
            environmentId={environmentId}
            now={now}
            words={{
              cause: [line.what, account, line.when].filter(Boolean).join(" · "),
              then: line.then,
            }}
            {...(condition.waits === "you" ? { onContinue: () => continueHeld(condition) } : {})}
          />
        );
      })}
      {(["landed", "flying"] as const).map((stage) =>
        board.counts[stage] === 0 ? null : (
          <Stage
            key={stage}
            stage={stage}
            rows={board[stage]}
            count={board.counts[stage]}
            compact={props.compact}
            environmentId={environmentId}
            now={now}
          />
        ),
      )}
    </section>
  );
}

function Stage(props: {
  stage: BoardStage;
  rows: ReadonlyArray<BoardRow>;
  count: number;
  compact: boolean;
  environmentId: string;
  now: number;
  /** A holding stage's cause and what happens next. */
  words?: { readonly cause: string; readonly then: string };
  /** Sends its Cells on, for a stage nothing else will; resolves with why one refused, if one did. */
  onContinue?: () => Promise<string | null>;
}) {
  const more = props.count - props.rows.length;
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const { onContinue } = props;
  return (
    <div data-board-stage={props.stage}>
      <h3>
        <i aria-hidden="true" />
        {STAGES[props.stage]}
        <span>{props.count}</span>
        {props.words ? <em>{props.words.cause}</em> : null}
      </h3>
      {props.words ? (
        <p data-board-words="">
          {props.words.then}
          {onContinue ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                setSending(true);
                void onContinue().then((why) => {
                  setRefused(why);
                  setSending(false);
                });
              }}
            >
              Continue now
            </button>
          ) : null}
          {refused === null ? null : <span role="status">{refused}</span>}
        </p>
      ) : null}
      {props.compact ? (
        <div data-board-figures="">
          {props.rows.map((row) => (
            <Tooltip key={row.threadId}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    data-board-figure=""
                    data-verdict={row.verdict ?? undefined}
                    aria-label={saidOf(row)}
                    onClick={() => openPeek(row.threadId)}
                  />
                }
              >
                <CellMini environmentId={props.environmentId} threadId={row.threadId} />
                {row.verdict === null ? null : (
                  <b aria-hidden="true">{VERDICTS[row.verdict].mark}</b>
                )}
              </TooltipTrigger>
              <TooltipPopup side="top">{saidOf(row)}</TooltipPopup>
            </Tooltip>
          ))}
          {more > 0 ? <span data-board-more="">{more} more</span> : null}
        </div>
      ) : (
        <>
          <ul>
            {props.rows.map((row) => (
              <li key={row.threadId}>
                <Row row={row} environmentId={props.environmentId} now={props.now} />
              </li>
            ))}
          </ul>
          {more > 0 ? <p data-board-more="">{more} more in the column</p> : null}
        </>
      )}
    </div>
  );
}

/** A Cell in one line, for a figure's tooltip and its name to a screen reader. */
function saidOf(row: BoardRow): string {
  const verdict = row.verdict === null ? null : VERDICTS[row.verdict].name;
  const says = row.line ?? row.why;
  const words = says ? spansOf(says).map((span) => span.text) : [];
  return [cellNameOf(row.threadId), row.title, verdict, words.join("")].filter(Boolean).join(" · ");
}

/** A Cell's line as its cards draw it; a link is its words only, the row being one button. */
const wordsOf = (says: string) =>
  spansOf(says).map((span, index) => {
    // oxlint-disable-next-line react/no-array-index-key -- The spans of one line, in its order.
    if (span.kind === "code") return <code key={index}>{span.text}</code>;
    // oxlint-disable-next-line react/no-array-index-key -- The spans of one line, in its order.
    if (span.kind === "strong") return <strong key={index}>{span.text}</strong>;
    return span.text;
  });

function Row(props: { row: BoardRow; environmentId: string; now: number }) {
  const { row } = props;
  const verdict = row.verdict === null ? null : VERDICTS[row.verdict];
  const says = row.line ?? row.why;
  return (
    <button
      type="button"
      data-board-row=""
      data-verdict={row.verdict ?? undefined}
      onClick={() => openPeek(row.threadId)}
    >
      <span data-board-figure="">
        <CellMini environmentId={props.environmentId} threadId={row.threadId} />
      </span>
      <span data-board-head="">
        <span data-board-who="">{cellNameOf(row.threadId)}</span>
        <span data-board-title="">{row.title}</span>
        {row.since === null ? null : (
          <span data-board-age="">{compactAge(row.since, props.now)}</span>
        )}
      </span>
      {verdict !== null || says ? (
        <span data-board-says="">
          {verdict === null ? null : (
            <b>
              <span aria-hidden="true">{verdict.mark}</span>
              <span className="sr-only">{verdict.name} </span>
            </b>
          )}
          {says ? wordsOf(says) : null}
        </span>
      ) : null}
      {row.changed !== null || row.facts.length > 0 ? (
        <span data-board-facts="">
          <RunFacts changed={row.changed} facts={row.facts} />
        </span>
      ) : null}
    </button>
  );
}
