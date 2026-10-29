import { FlagIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { keepCard, useAutonomy } from "../autonomy/autonomy";
import { TakingFuse } from "../autonomy/Cards";
import { cellNameOf } from "../cell/name";
import { CellMark } from "../tabs/CellMark";
import { openCleanupCell } from "../disk/cleanupCell";
import { diskFailure, type DiskFailure } from "../disk/pressure";
import { timing } from "../tokens/motion";
import { compactAge } from "../upstream/cellRow";
import { useMachineDisk, useOpenDiskCell } from "../upstream/disk";
import {
  cellRef,
  ChatMarkdown,
  observeResize,
  useNowMinuteMs,
  useOpenFromNeeds,
  usePrimaryEnvironmentId,
  useRepositoryUrl,
} from "../upstream/needs";
import { useCellPlace } from "../upstream/thread";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { commandsFor, type Given } from "./actions";
import {
  cardOf,
  LATER,
  NOTHING_TO_DO,
  type Card,
  type CardOption,
  type CardQuestion,
} from "./card";
import { movedByHand } from "./byHand";
import type { Shown } from "./display";
import type { Hold } from "./holds";
import { holds, useSettleAtOnce } from "./live";
import { openPeek } from "./peeking";
import { type Lit, lit, useLit } from "./answers/lit";
import { linkAddresses, marksUp } from "./inline";
import { tellAsk } from "./told";
import { rereadWholeKinds, useShowsWhole } from "./whole";
import { answering, land } from "./walk";

/** Who the card is for: the Cell's name, or a subagent's under its parent's. */
export function whoOf(need: Shown["need"]): string {
  return need.parentThreadId === null
    ? cellNameOf(need.threadId)
    : `${cellNameOf(need.parentThreadId)} › ${need.title}`;
}

/** Whether a card still takes an answer: live, and no answer of the person's held, sending or sent. */
export function answerableOf(shown: Shown, hold: Hold | undefined): boolean {
  if (shown.goneAt !== null || hold === undefined) return shown.goneAt === null;
  return hold.state === "failed" || hold.state === "stale";
}

/** Whether the keyboard is on `card` or in it, as a walk's step leaves it (walk.ts). */
const keyedIn = (card: HTMLElement): boolean =>
  card.matches(":focus-visible") || card.querySelector(":focus-visible") !== null;

/** Where the words of an answer that wasn't sent went. */
const backLine = (hold: Hold | undefined): string =>
  hold?.wordsBack ? " Your words are back in Aski's composer." : "";

/**
 * One need, as a message (stemcells/tasks/aski-asks.md, decisions 4 to 6, and unblocking.md):
 * its Cell, project and age on one line; what to do; what the Cell did, two lines until More;
 * what waits on it and where its reply points; the options side by side, each one app action.
 * Answered (onto the undo line, `holds.ts`), settled or gone, it folds away at once.
 */
type NeedCardProps = {
  shown: Shown;
  hold: Hold | undefined;
  /** Answered, settled or gone: it folds away, and takes no more input. */
  leaving: boolean;
  /** When this page first saw the need. */
  seenAt: number | null;
  /** Opens the asking chat; a peek beside the cards unless the list says otherwise. */
  openChat?: ((threadId: string) => void) | undefined;
  /** In a queue, a card that isn't the open one shows only who asks and what. */
  queued?: { readonly open: boolean; readonly onOpen: () => void } | undefined;
};

export function NeedCard(props: NeedCardProps) {
  return props.shown.need.kind === "failed" ? (
    <FailedCard {...props} />
  ) : (
    <Card {...props} disk={null} freeSpace={null} />
  );
}

/** A failed turn reads its machine's disk: a full one says so, and offers the cleanup Cell. */
function FailedCard(props: NeedCardProps) {
  const environmentId = usePrimaryEnvironmentId();
  const disk = useMachineDisk(environmentId);
  const openDiskCell = useOpenDiskCell(environmentId);
  return (
    <Card
      {...props}
      disk={disk ? diskFailure(props.shown.need.key, disk.free) : null}
      freeSpace={openDiskCell === null ? null : () => void openCleanupCell(openDiskCell)}
    />
  );
}

function Card(props: NeedCardProps & { disk: DiskFailure; freeSpace: (() => void) | null }) {
  const { need } = props.shown;
  const hold = props.hold;
  const now = useNowMinuteMs();
  const environmentId = usePrimaryEnvironmentId();
  const card = cardOf(need, now, props.disk);
  const who = whoOf(need);
  const cell =
    environmentId === null ? null : { environmentId, threadId: need.threadId, draftId: null };
  const place = useCellPlace(cell);
  const open = useOpenFromNeeds();
  const settle = useSettleAtOnce();
  // What the words in Aski's composer do to this card (answers/lit.ts).
  const lights = useLit();
  const fromWords = lights.reading.get(need.key) ?? null;
  const asked = lights.asked.get(need.key) ?? null;
  // Whether Aski is about to take this card for the person.
  const autonomy = useAutonomy();
  const taking = autonomy?.taking.find((each) => each.key === need.key) ?? null;

  // An allow can't land in the card's first moment: a card arriving under
  // the pointer is read before it is clicked.
  const [allowReady, setAllowReady] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Time when an allow may land after the card was seen, and clear the timer on change.
  useEffect(() => {
    const allowAt = (props.seenAt ?? 0) + timing("readBeforeAllow");
    const timer = setTimeout(() => setAllowReady(true), Math.max(0, allowAt - Date.now()));
    return () => clearTimeout(timer);
  }, [props.seenAt]);

  // "Not enough to decide" (decision 11): the Cell's own words open, and a line of what was
  // missing waits for the person, who may leave it empty.
  const [flag, setFlag] = useState<"asking" | "said" | null>(null);
  const flagIt = () => {
    if (flag === null)
      void tellAsk(need.key, "flagged", {
        shown: { ask: card.headline, context: card.quote },
      }).then(rereadWholeKinds);
    setFlag("asking");
  };
  // A kind flagged often shows its Cell's words whole (decision 13).
  const whole = useShowsWhole(need.kind);

  const section = useRef<HTMLElement>(null);
  const holdAnswer = (commands: ReturnType<typeof commandsFor>) => {
    movedByHand(need.threadId);
    holds.hold({ key: need.key, threadId: need.threadId, commands });
  };
  // An answer of the person's own keeps the card from Aski's take.
  const keepFromAski = () => {
    if (taking !== null) void keepCard(need.key);
  };
  const choose = (option: CardOption, given: Given = {}) => {
    // The cleanup Cell is a new Cell on the full machine: the card stays until it retries.
    if (option.choice.kind === "freeSpace") return props.freeSpace?.();
    keepFromAski();
    answering(section.current);
    lit.answered(need.key);
    holdAnswer(commandsFor(need, option.choice, given, Date.now()));
  };

  const answerable = answerableOf(props.shown, hold) && !props.leaving;
  const ref = cell === null ? null : cellRef(cell.environmentId, cell.threadId);
  const repo = useRepositoryUrl(environmentId, need.projectId);

  // A card Aski is about to take stays open, so its fuse can be seen and stopped.
  const collapsed =
    props.queued !== undefined && !props.queued.open && answerable && taking === null;

  // Opened from the keyboard, the card lands the focus where a step would,
  // once its options are there; opened by pointer, the focus stays put.
  const landOnOpen = useRef(false);
  const openQueued = () => {
    landOnOpen.current = section.current !== null && keyedIn(section.current);
    props.queued?.onOpen();
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Land keyboard focus in the card once a keyboard open has rendered its options.
  useLayoutEffect(() => {
    if (collapsed || !landOnOpen.current || section.current === null) return;
    landOnOpen.current = false;
    land(section.current);
  }, [collapsed]);

  // Later, Settle and Open chat stand in the age's place while the person is on the ask.
  const tail = (
    <span data-need-tail="">
      {card.later && answerable ? (
        <button
          type="button"
          data-lit={lightOf(LATER.id, fromWords, asked)}
          onClick={() => choose(LATER)}
        >
          Later
        </button>
      ) : null}
      {need.kind === "sign-in" ? (
        <button type="button" onClick={() => open.providerSetup(need.providerInstanceId)}>
          Open provider setup
        </button>
      ) : null}
      {environmentId !== null ? (
        // Done with it, asked or not: it stops, then settles (upstream/settle.ts). Words that
        // say "nothing to do" light it.
        <button
          type="button"
          data-lit={lightOf(NOTHING_TO_DO, fromWords, asked)}
          onClick={() => {
            void tellAsk(need.key, "answered");
            void settle({ environmentId, threadId: need.threadId });
          }}
        >
          Settle
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          void tellAsk(need.key, "opened");
          (props.openChat ?? openPeek)(need.threadId);
        }}
      >
        Open chat
      </button>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              data-need-flag=""
              aria-label="Not enough to decide"
              aria-pressed={flag !== null}
              onClick={flagIt}
            >
              <FlagIcon aria-hidden="true" />
            </button>
          }
        />
        <TooltipPopup side="bottom">Not enough to decide</TooltipPopup>
      </Tooltip>
    </span>
  );
  const head = (
    <>
      <span data-need-number="">{need.number}</span>
      {cell === null ? null : <CellMark cell={cell} />}
      <span data-need-who="">{who}</span>
      {place ? <span data-need-place="">{place.name}</span> : null}
      <span data-need-age="">{compactAge(need.since, now)}</span>
    </>
  );

  if (collapsed) {
    return (
      <section
        ref={section}
        // The walk lands here, and the card opens (walk.ts).
        tabIndex={-1}
        data-stemcells-need=""
        data-need-key={need.key}
        data-need-thread={need.threadId}
        data-open=""
        data-queued=""
        data-blocks={need.blocks || undefined}
        data-leaving={props.leaving || undefined}
        inert={props.leaving}
        aria-label={`${who}: ${card.headline}`}
        onFocus={(event) => {
          if (event.target === event.currentTarget && keyedIn(event.currentTarget)) openQueued();
        }}
        onClick={openQueued}
      >
        <button type="button" data-need-head="" aria-expanded={false}>
          {head}
        </button>
        <p data-need-ask="">{plainOf(card.headline)}</p>
      </section>
    );
  }

  return (
    <section
      ref={section}
      // The walk lands here when the card recommends nothing (walk.ts).
      tabIndex={-1}
      data-stemcells-need=""
      data-need-key={need.key}
      data-need-thread={need.threadId}
      data-open={answerable || undefined}
      data-blocks={need.blocks || undefined}
      data-leaving={props.leaving || undefined}
      inert={props.leaving}
      aria-label={`${who}: ${card.headline}`}
      onKeyDown={pickByNumber}
    >
      <header data-need-head="">
        {head}
        {tail}
      </header>
      <div data-need-ask="">
        <Words text={card.headline} cell={ref} repo={repo} />
      </div>
      {card.steps.length > 0 ? (
        <ol data-need-steps="">
          {card.steps.map((step) => (
            <li key={step}>
              <Words text={step} cell={ref} repo={repo} />
            </li>
          ))}
        </ol>
      ) : null}
      {card.quote ? (
        <Context text={card.quote} cell={ref} repo={repo} open={flag !== null || whole} />
      ) : null}
      {card.request ? <pre data-need-request="">{card.request}</pre> : null}
      {card.next ? (
        <div data-need-next="">
          <span>Then {cellNameOf(need.parentThreadId ?? need.threadId)}:</span>{" "}
          <Words text={card.next} cell={ref} repo={repo} />
        </div>
      ) : null}
      {card.why ? <p data-need-why="">{card.why}</p> : null}
      {card.note ? <p data-need-note="">{card.note}</p> : null}
      {flag === "asking" ? (
        <Field
          placeholder="What was missing? Kept on this Mac"
          action="Note it"
          onSend={(note) => {
            void tellAsk(need.key, "flagged", { note });
            setFlag("said");
          }}
          onCancel={() => setFlag("said")}
        />
      ) : null}
      {taking !== null ? (
        <TakingFuse
          key={taking.at}
          kind={taking.kind}
          from={taking.from}
          at={taking.at}
          onUndo={() => keepCard(need.key)}
        />
      ) : null}
      {hold?.state === "failed" ? (
        <p data-need-receipt="" data-warn="">
          {hold.why + backLine(hold)}
        </p>
      ) : null}
      {fromWords?.kind === "chosen" && fromWords.words !== null ? (
        <p data-need-pending="">“{fromWords.words}”</p>
      ) : null}
      {card.questions.length > 0 ? (
        <Questions
          questions={card.questions}
          lit={fromWords}
          onAnswer={(answers) => {
            keepFromAski();
            answering(section.current);
            lit.answered(need.key);
            holdAnswer(commandsFor(need, { kind: "answer" }, { answers }, Date.now()));
          }}
        />
      ) : null}
      {shownOptions(card).length > 0 ? (
        <Options
          options={shownOptions(card)}
          allowReady={allowReady}
          lit={fromWords}
          asked={asked}
          onChoose={choose}
        />
      ) : null}
    </section>
  );
}

/** The options a card lists: "Nothing to do" is the head's Settle, which words still light. */
const shownOptions = (card: Card): ReadonlyArray<CardOption> =>
  card.options.filter((option) => option.id !== NOTHING_TO_DO);

/**
 * A number key picks that option, as a click on it would; an allow it only reaches, for a
 * click to finish (aski-room.md, decision 6). A field's keys are its own.
 */
function pickByNumber(event: KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (!/^[1-9]$/u.test(event.key)) return;
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, [contenteditable='true']")) return;
  const rows = event.currentTarget.querySelectorAll<HTMLButtonElement>(
    "[data-need-options] > button[data-need-option]",
  );
  const row = rows[Number(event.key) - 1];
  if (row === undefined || row.disabled) return;
  event.preventDefault();
  row.focus();
  if (!row.hasAttribute("data-allows")) row.click();
}

interface WordsProps {
  readonly text: string;
  readonly cell: ReturnType<typeof cellRef> | null;
  /** The Cell's repository on the web, where its words' issue numbers link. */
  readonly repo: string | null;
}

/**
 * Words of an ask, as the chat draws them: links, code and bold through upstream's markdown,
 * a bare web address and an issue number linked (`inline.ts`); plain words stay plain text, which
 * costs nothing.
 */
function Words(props: WordsProps) {
  if (!marksUp(props.text, props.repo)) return props.text;
  return (
    <ChatMarkdown
      inline
      text={linkAddresses(props.text, props.repo)}
      cwd={undefined}
      threadRef={props.cell ?? undefined}
      parseRawHtml={false}
    />
  );
}

/** A folded ask's one line: its words without their markup. */
const plainOf = (text: string): string =>
  text.replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1").replace(/[`*]/g, "");

/** What the Cell did, two lines until More, or `open` (a flag), shows them all: never a trip to its chat. */
function Context(props: WordsProps & { open: boolean }) {
  const body = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [opened, setOpened] = useState(false);
  const more = opened || props.open;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Measure whether the words run past their two lines as the ask resizes.
  useLayoutEffect(() => {
    const element = body.current;
    if (element === null || more) return;
    return observeResize(element, () => setLong(element.scrollHeight > element.clientHeight + 1));
  }, [more]);
  return (
    <div data-need-context="" data-more={more || undefined}>
      <div ref={body}>
        <Words text={props.text} cell={props.cell} repo={props.repo} />
      </div>
      {long && !more ? (
        <button type="button" onClick={() => setOpened(true)}>
          More
        </button>
      ) : null}
    </div>
  );
}

/** How the words in Aski's composer light an option: chosen, waiting for a click, or for words. */
function lightOf(id: string, lit: Lit | null, asked: string | null) {
  if (lit?.id === id) return lit.kind;
  return asked === id ? "click" : undefined;
}

const LIGHT_LINES = {
  chosen: "from your words",
  click: "needs your click",
  words: "say what, or click",
} as const;

/**
 * The card's options side by side (unblocking.md, decision 6). The line under them says what
 * the one you're on does, else the lit, warned or recommended one. An option that takes words
 * turns the row into one full-width field, focused; Esc brings the buttons back.
 */
function Options(props: {
  options: ReadonlyArray<CardOption>;
  allowReady: boolean;
  lit: Lit | null;
  asked: string | null;
  onChoose: (option: CardOption, given?: Given) => void;
}) {
  const [writing, setWriting] = useState<CardOption | null>(null);
  const [on, setOn] = useState<string | null>(null);
  if (writing !== null) {
    return (
      <Field
        placeholder={writing.words ?? ""}
        onSend={(words) => props.onChoose(writing, { words })}
        onCancel={() => setWriting(null)}
      />
    );
  }
  const lit = props.options.find(
    (option) => lightOf(option.id, props.lit, props.asked) !== undefined,
  );
  const said =
    props.options.find((option) => option.id === on) ??
    lit ??
    props.options.find((option) => option.warn) ??
    props.options.find((option) => option.recommended && !option.allows);
  return (
    <div data-need-acts="" onPointerLeave={() => setOn(null)}>
      <div data-need-options="">
        {props.options.map((option) => (
          <button
            key={option.id}
            type="button"
            data-need-option=""
            data-recommended={option.recommended || undefined}
            data-allows={option.allows || undefined}
            data-warn={option.warn || undefined}
            data-lit={lightOf(option.id, props.lit, props.asked)}
            disabled={option.allows && !props.allowReady}
            onPointerEnter={() => setOn(option.id)}
            onFocus={() => setOn(option.id)}
            onBlur={() => setOn(null)}
            onClick={() => (option.words ? setWriting(option) : props.onChoose(option))}
          >
            {option.title}
            {option.recommended ? <span className="sr-only"> (recommended)</span> : null}
          </button>
        ))}
      </div>
      {said !== undefined && (said.consequence !== null || said === lit) ? (
        <p data-need-option-says="" data-warn={said.warn || undefined}>
          <LightLine light={lightOf(said.id, props.lit, props.asked)} />
          {said.consequence}
        </p>
      ) : null}
    </div>
  );
}

function LightLine(props: { light: keyof typeof LIGHT_LINES | undefined }) {
  return props.light === undefined ? null : (
    <span data-need-option-lit={props.light}>{LIGHT_LINES[props.light]}</span>
  );
}

/** A field for the person's own words, full width, focused as it opens. */
function Field(props: {
  placeholder: string;
  /** What its button says; "Send" when the words go to the Cell. */
  action?: string;
  onSend: (words: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const send = () => {
    if (text.trim() !== "") props.onSend(text);
  };
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      send();
    } else if (event.key === "Escape") {
      event.preventDefault();
      props.onCancel();
    }
  };
  return (
    <div data-need-words="">
      <input
        // The person opened this field to type into it.
        autoFocus
        value={text}
        placeholder={props.placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={keys}
      />
      <button type="button" disabled={text.trim() === ""} onClick={send}>
        {props.action ?? "Send"}
      </button>
    </div>
  );
}

/**
 * A Cell's own questions, its options in its order. One plain question
 * answers on a click; several, or one taking many picks, answer together.
 */
function Questions(props: {
  questions: ReadonlyArray<CardQuestion>;
  lit: Lit | null;
  onAnswer: (answers: Record<string, string | string[]>) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [own, setOwn] = useState<Record<string, string>>({});
  const [writing, setWriting] = useState<string | null>(null);
  const single = props.questions.length === 1 && props.questions[0]?.multiSelect === false;

  const answerOf = (question: CardQuestion): string | string[] | null => {
    const words = own[question.id]?.trim();
    if (words) return question.multiSelect ? [words] : words;
    const chosen = picked[question.id] ?? [];
    if (chosen.length === 0) return null;
    return question.multiSelect ? chosen : (chosen[0] ?? null);
  };
  const send = () => {
    const answers: Record<string, string | string[]> = {};
    for (const question of props.questions) {
      const answer = answerOf(question);
      if (answer === null) return;
      answers[question.id] = answer;
    }
    props.onAnswer(answers);
  };
  const complete = props.questions.every((question) => answerOf(question) !== null);

  return (
    <div data-need-questions="">
      {props.questions.map((question, index) => (
        <div key={question.id} data-need-question="">
          {/* One question is the card's own line; several each say theirs. */}
          {props.questions.length > 1 ? (
            <>
              <p data-need-question-head="">
                {index + 1}. {question.header}
              </p>
              <p data-need-question-text="">{question.question}</p>
            </>
          ) : null}
          <div data-need-options="">
            {question.options.map((choice) => {
              const chosen = (picked[question.id] ?? []).includes(choice.answer);
              return (
                <button
                  key={choice.answer}
                  type="button"
                  data-need-option=""
                  data-recommended={choice.recommended || undefined}
                  data-lit={lightOf(`answer:${choice.answer}`, props.lit, null)}
                  aria-pressed={single ? undefined : chosen}
                  onClick={() => {
                    if (single) return props.onAnswer({ [question.id]: choice.answer });
                    setOwn((all) => ({ ...all, [question.id]: "" }));
                    setPicked((all) => {
                      const now = all[question.id] ?? [];
                      const next = question.multiSelect
                        ? chosen
                          ? now.filter((value) => value !== choice.answer)
                          : [...now, choice.answer]
                        : [choice.answer];
                      return { ...all, [question.id]: next };
                    });
                  }}
                >
                  <span data-need-option-title="">{choice.label}</span>
                  {choice.recommended ? <span className="sr-only">Recommended</span> : null}
                  <LightLine light={lightOf(`answer:${choice.answer}`, props.lit, null)} />
                  {/* The Cell's own words on a choice are what the person decides by. */}
                  {choice.description ? (
                    <span data-need-option-says="">{choice.description}</span>
                  ) : null}
                </button>
              );
            })}
            {question.other === null ? null : writing === question.id ? (
              <Field
                placeholder={question.other}
                onSend={(words) => {
                  if (single) return props.onAnswer({ [question.id]: words.trim() });
                  setOwn((all) => ({ ...all, [question.id]: words }));
                  setPicked((all) => ({ ...all, [question.id]: [] }));
                  setWriting(null);
                }}
                onCancel={() => setWriting(null)}
              />
            ) : (
              <button
                type="button"
                data-need-option=""
                aria-pressed={single ? undefined : Boolean(own[question.id]?.trim())}
                onClick={() => setWriting(question.id)}
              >
                <span data-need-option-title="">
                  {own[question.id]?.trim() ? `“${own[question.id]?.trim()}”` : "Other…"}
                </span>
              </button>
            )}
          </div>
        </div>
      ))}
      {single ? null : (
        <button type="button" data-need-send="" disabled={!complete} onClick={send}>
          Send answers
        </button>
      )}
    </div>
  );
}
