import { ArrowUpIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { keepCard, useAutonomy } from "../autonomy/autonomy";
import { openCleanupCell } from "../disk/cleanupCell";
import { diskFailure, type DiskFailure } from "../disk/pressure";
import type { CellRef } from "../tabs/layout";
import { useAskJump } from "../upstream/askCitation";
import { compactAge } from "../upstream/cellRow";
import { useMachineDisk, useOpenDiskCell } from "../upstream/disk";
import { useOwnsChatWindowInput } from "../upstream/media";
import {
  cellRef,
  composerIsEmpty,
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
import { dockedButtonsOf, dockedKeysFree } from "./docked";
import { answered, useHolds, type Hold } from "./holds";
import { chatAskOf } from "./inChat";
import { plainOf } from "./inline";
import { holds } from "./live";
import { Words } from "./NeedCard";
import { useNeeds } from "./stream";
import type { Need, NeedsList } from "./wire";
import "../tokens/stemcells.css";
import "./chat-ask.css";

/** At most this many of a Cell's steps show: the chat above has the rest. */
const STEPS_SHOWN = 3;

/**
 * The Cell's own ask, docked over its composer (stemcells/tasks/the-ask.md): it stays put while
 * the chat scrolls, and leaves when the ask does, answered here, in Aski's room or by the Cell.
 */
export function ChatAsk(props: { cell: CellRef }) {
  const state = useNeeds();
  const answers = useHolds(holds);
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
  const docked = {
    cell: props.cell,
    need: shown,
    hold: answers.get(shown.key),
    leaving: need === null,
    keysFree: dockedKeysFree(list, props.cell.threadId),
    onLeft: () => setKept(null),
  };
  return shown.kind === "failed" ? (
    <FailedAsk key={shown.key} {...docked} />
  ) : (
    <DockedAsk key={shown.key} {...docked} disk={null} freeSpace={null} />
  );
}

interface DockedProps {
  readonly cell: CellRef;
  readonly need: Need;
  readonly hold: Hold | undefined;
  readonly leaving: boolean;
  /** No panel of upstream's answers over the composer: Return and Escape are the card's. */
  readonly keysFree: boolean;
  readonly onLeft: () => void;
}

/** A failed turn reads its machine's disk, as Aski's card does (`NeedCard.tsx`). */
function FailedAsk(props: DockedProps) {
  const environmentId = usePrimaryEnvironmentId();
  const disk = useMachineDisk(environmentId);
  const openDiskCell = useOpenDiskCell(environmentId);
  return (
    <DockedAsk
      {...props}
      disk={disk ? diskFailure(props.need.key, disk.free) : null}
      freeSpace={openDiskCell === null ? null : () => void openCleanupCell(openDiskCell)}
    />
  );
}

function DockedAsk(props: DockedProps & { disk: DiskFailure; freeSpace: (() => void) | null }) {
  const { cell, need } = props;
  const now = useNowMinuteMs();
  const card = cardOf(need, now, props.disk);
  const buttons = dockedButtonsOf(card);
  const ref = cellRef(cell.environmentId, need.threadId);
  const repo = useRepositoryUrl(cell.environmentId, need.projectId);
  const jump = useAskJump(cell, need);
  const open = useOpenFromNeeds();
  const autonomy = useAutonomy();
  const ownsInput = useOwnsChatWindowInput();
  const root = useRef<HTMLElement>(null);

  const choose = (option: CardOption) => {
    if (option.choice.kind === "freeSpace") return props.freeSpace?.();
    if (autonomy?.taking.some((each) => each.key === need.key)) void keepCard(need.key);
    holdAnswer(need, option);
  };
  const { primary, notNow } = buttons;
  const signIn = need.kind === "sign-in" ? () => open.providerSetup(need.providerInstanceId) : null;
  const take = primary !== null ? () => choose(primary) : signIn;
  const putOff = notNow !== null ? () => choose(notNow) : null;

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (props.leaving || !props.keysFree || !ownsInput || event.defaultPrevented) return;
    if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.repeat) return;
    if (event.isComposing || event.keyCode === 229) return;
    const act = event.key === "Enter" ? take : putOff;
    if (act === null || !inComposerBelow(root.current, event.target) || !composerIsEmpty(cell))
      return;
    event.preventDefault();
    event.stopPropagation();
    act();
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hear the composer's Return before its editor sends, and an Escape nothing under it took.
  useEffect(() => {
    const enter = (event: KeyboardEvent) => event.key === "Enter" && onKey(event);
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onKey(event);
    window.addEventListener("keydown", enter, true);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", enter, true);
      window.removeEventListener("keydown", escape);
    };
  }, []);

  const steps = card.steps.slice(0, STEPS_SHOWN);
  const more = card.steps.length - steps.length;
  return (
    <section
      ref={root}
      data-stemcells-chat-ask=""
      data-leaving={props.leaving || undefined}
      inert={props.leaving}
      aria-label={`Input: ${plainOf(card.headline)}`}
      onAnimationEnd={(event) => {
        if (props.leaving && event.target === event.currentTarget) props.onLeft();
      }}
    >
      <div data-chat-ask-kicker="">
        <span data-chat-ask-dot="" aria-hidden />
        <span>Input · {compactAge(need.since, now)}</span>
        {jump !== null ? (
          <Button size="xs" variant="ghost-muted" onClick={jump}>
            <ArrowUpIcon aria-hidden />
            Where it asked
          </Button>
        ) : null}
      </div>
      <div data-chat-ask-headline="">
        <Words text={card.headline} cell={ref} repo={repo} />
      </div>
      {steps.length > 0 ? (
        <ol data-chat-ask-steps="">
          {steps.map((step) => (
            <li key={step}>
              <Words text={step} cell={ref} repo={repo} />
            </li>
          ))}
          {more > 0 ? <li data-chat-ask-more="">{more} more in the chat</li> : null}
        </ol>
      ) : null}
      {card.next ? (
        <p data-chat-ask-next="">
          <span>Then</span> <Words text={card.next} cell={ref} repo={repo} />
        </p>
      ) : null}
      {props.hold?.state === "failed" ? <p data-chat-ask-receipt="">{props.hold.why}</p> : null}
      {take !== null || buttons.rest.length > 0 || putOff !== null ? (
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
          {putOff !== null ? (
            <Button size="xs" variant="ghost-muted" onClick={putOff}>
              Not now
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Through the holds, as Aski's card answers: onto the undo line, then upstream's commands. */
function holdAnswer(need: Need, option: CardOption) {
  lit.answered(need.key);
  movedByHand(need.threadId);
  holds.hold({
    key: need.key,
    threadId: need.threadId,
    commands: commandsFor(need, option.choice, {}, Date.now()),
  });
}

/** Whether a key came from the editor of the composer this card docks over. */
function inComposerBelow(card: HTMLElement | null, target: EventTarget | null): boolean {
  const host = card?.closest("[data-stemcells-composer-line]")?.parentElement;
  return (
    host != null &&
    target instanceof HTMLElement &&
    target.isContentEditable &&
    host.contains(target)
  );
}
