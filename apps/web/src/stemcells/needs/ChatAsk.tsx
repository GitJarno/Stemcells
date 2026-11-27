import { type KeyboardEvent, type MouseEvent, type ReactNode, useRef, useState } from "react";

import { STATUS_WORDS } from "../../../../../stemcells/words/awake.ts";
import { keepCard, useAutonomy } from "../autonomy/autonomy";
import { openCleanupCell } from "../disk/cleanupCell";
import { diskFailure, type DiskFailure } from "../disk/pressure";
import { StatusIcon } from "../rail/StatusIcon";
import type { CellRef } from "../tabs/layout";
import { type AskMarks, useAskHighlights, useAskMarks, useJumpTo } from "../upstream/askCitation";
import { compactAge } from "../upstream/cellRow";
import { useMachineDisk, useOpenDiskCell } from "../upstream/disk";
import {
  cellRef,
  useNowMinuteMs,
  useOpenFromNeeds,
  usePrimaryEnvironmentId,
  useRepositoryUrl,
} from "../upstream/needs";
import { Button } from "../upstream/ui";
import { commandsFor } from "./actions";
import { lit } from "./answers/lit";
import { movedByHand } from "./byHand";
import { cardOf, type CardOption } from "./card";
import { askButtonsOf } from "./askButtons";
import { answered, useAnswers, type Answer } from "./answering";
import { type AskPassage, chatAskOf } from "./inChat";
import { plainOf } from "./inline";
import { answering } from "./live";
import { Words } from "./NeedCard";
import { useNeeds } from "./stream";
import type { Need, NeedsList } from "./wire";
import "../tokens/stemcells.css";
import "./chat-ask.css";

/** At most this many of a Cell's steps show: the reply above has the rest. */
const STEPS_SHOWN = 3;

/**
 * The Cell's own ask, the chat's last element (stemcells/tasks/the-ask.md): under its last
 * reply, scrolling with it, until the ask goes, answered here, in Aski's room or by the Cell.
 */
export function ChatAsk(props: { cell: CellRef }) {
  const state = useNeeds();
  const answers = useAnswers(answering);
  const list: NeedsList | null =
    state.needs === null
      ? null
      : { needs: state.needs.filter((need) => !answered(answers.get(need.key))) };
  const need = chatAskOf(list, props.cell.threadId);
  // The ask that went stays drawn until its leave has played.
  const [kept, setKept] = useState<Need | null>(null);
  if (need !== null && need !== kept) setKept(need);
  const shown = need ?? kept;
  if (shown === null) return null;
  const ask = {
    cell: props.cell,
    need: shown,
    answer: answers.get(shown.key),
    leaving: need === null,
    onLeft: () => setKept(null),
  };
  return shown.kind === "failed" ? (
    <FailedAsk key={shown.key} {...ask} />
  ) : (
    <InlineAsk key={shown.key} {...ask} disk={null} freeSpace={null} />
  );
}

interface AskProps {
  readonly cell: CellRef;
  readonly need: Need;
  readonly answer: Answer | undefined;
  readonly leaving: boolean;
  readonly onLeft: () => void;
}

/** A failed turn reads its machine's disk, as Aski's card does (`NeedCard.tsx`). */
function FailedAsk(props: AskProps) {
  const environmentId = usePrimaryEnvironmentId();
  const disk = useMachineDisk(environmentId);
  const openDiskCell = useOpenDiskCell(environmentId);
  return (
    <InlineAsk
      {...props}
      disk={disk ? diskFailure(props.need.key, disk.free) : null}
      freeSpace={openDiskCell === null ? null : () => void openCleanupCell(openDiskCell)}
    />
  );
}

function InlineAsk(props: AskProps & { disk: DiskFailure; freeSpace: (() => void) | null }) {
  const { cell, need } = props;
  const now = useNowMinuteMs();
  const card = cardOf(need, now, props.disk);
  const buttons = askButtonsOf(card);
  const ref = cellRef(cell.environmentId, need.threadId);
  const repo = useRepositoryUrl(cell.environmentId, need.projectId);
  const open = useOpenFromNeeds();
  const autonomy = useAutonomy();
  const root = useRef<HTMLElement>(null);
  const marks = useAskMarks(cell, need);
  useAskHighlights(root, props.leaving ? [] : (marks?.marks ?? []));
  const jumpTo = useJumpTo(cell);
  const jump = (kind: AskPassage["kind"], index: number, orWhole = false) => {
    const citation = citationOf(marks, kind, index) ?? (orWhole ? (marks?.whole ?? null) : null);
    return citation === null ? null : () => jumpTo(citation);
  };

  const choose = (option: CardOption) => {
    if (option.choice.kind === "freeSpace") return props.freeSpace?.();
    if (autonomy?.taking.some((each) => each.key === need.key)) void keepCard(need.key);
    sendAnswer(need, option);
  };
  const { primary, notNow } = buttons;
  const signIn = need.kind === "sign-in" ? () => open.providerSetup(need.providerInstanceId) : null;
  const status = need.kind === "permission" ? "approval" : "input";
  // A close-out's headline is its first step, or counts them; any other reply's, its asking words.
  const headline = need.prose?.cue === "left" ? "you" : "ask";
  const steps = card.steps.slice(0, STEPS_SHOWN);
  const more = card.steps.length - steps.length;
  return (
    <section
      ref={root}
      data-stemcells-chat-ask=""
      data-leaving={props.leaving || undefined}
      inert={props.leaving}
      aria-label={`${STATUS_WORDS[status]}: ${plainOf(card.headline)}`}
      onAnimationEnd={(event) => {
        if (props.leaving && event.target === event.currentTarget) props.onLeft();
      }}
    >
      <div data-chat-ask-kicker="">
        <StatusIcon status={status} />
        <span>
          {STATUS_WORDS[status]} · {compactAge(need.since, now)}
        </span>
      </div>
      <div data-chat-ask-headline="">
        <Jump to={jump(headline, 0, true)} kind={headline}>
          <Words text={card.headline} cell={ref} repo={repo} />
        </Jump>
      </div>
      {steps.length > 0 ? (
        <ol data-chat-ask-steps="">
          {steps.map((step, index) => (
            <li key={step}>
              <Jump to={jump("you", index)} kind="you">
                <Words text={step} cell={ref} repo={repo} />
              </Jump>
            </li>
          ))}
          {more > 0 ? <li data-chat-ask-more="">{more} more in the reply</li> : null}
        </ol>
      ) : null}
      {card.next ? (
        <p data-chat-ask-next="">
          <Jump to={jump("next", 0)} kind="next">
            <span>Then</span> <Words text={card.next} cell={ref} repo={repo} />
          </Jump>
        </p>
      ) : null}
      {props.answer?.state === "failed" ? <p data-chat-ask-receipt="">{props.answer.why}</p> : null}
      {primary !== null || signIn !== null || buttons.rest.length > 0 || notNow !== null ? (
        <div data-chat-ask-buttons="">
          {primary !== null ? (
            <Button size="xs" onClick={() => choose(primary)}>
              {primary.title}
            </Button>
          ) : signIn !== null ? (
            <Button size="xs" onClick={signIn}>
              Open provider setup
            </Button>
          ) : null}
          {buttons.rest.map((option) => (
            <Button key={option.id} size="xs" variant="outline" onClick={() => choose(option)}>
              {option.title}
            </Button>
          ))}
          {notNow !== null ? (
            <Button size="xs" variant="ghost-muted" onClick={() => choose(notNow)}>
              Not now
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function citationOf(marks: AskMarks | null, kind: AskPassage["kind"], index: number) {
  return (
    marks?.marks.find((mark) => mark.passage.kind === kind && mark.passage.index === index)
      ?.citation ?? null
  );
}

/**
 * A line of the card that takes the reader to its words in the reply, tinted as they are there
 * while the pointer is on it. A link inside it stays the link's.
 */
function Jump(props: { to: (() => void) | null; kind: AskPassage["kind"]; children: ReactNode }) {
  const { to } = props;
  if (to === null) return props.children;
  const onClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest("a") !== null) return;
    to();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    to();
  };
  return (
    <span
      data-chat-ask-jump={props.kind}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {props.children}
    </span>
  );
}

/** As Aski's card answers: upstream's commands, at once. */
function sendAnswer(need: Need, option: CardOption) {
  lit.answered(need.key);
  movedByHand(need.threadId);
  void answering.send({
    key: need.key,
    threadId: need.threadId,
    commands: commandsFor(need, option.choice, {}, Date.now()),
  });
}
