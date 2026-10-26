import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { keepCard, KINDS, useAutonomy, type Kind } from "../autonomy/autonomy";
import { TakingFuse } from "../autonomy/Cards";
import { cellNameOf } from "../cell/name";
import { timing } from "../tokens/motion";
import { useNowMinuteMs, useOpenFromNeeds, usePrimaryEnvironmentId } from "../upstream/needs";
import { useSettleCell } from "../upstream/settle";
import { useCellPlace } from "../upstream/thread";
import { commandsFor, type Given } from "./actions";
import { cardOf, LATER, type CardOption, type CardQuestion } from "./card";
import type { Shown } from "./display";
import type { Hold } from "./holds";
import { holds } from "./live";
import { openPeek } from "./peeking";
import { type Lit, lit, useLit } from "./answers/lit";
import { answering, land } from "./walk";

/** Who the card is for: the Cell's name, or a subagent's under its parent's. */
export function whoOf(need: Shown["need"]): string {
  return need.parentThreadId === null
    ? cellNameOf(need.threadId)
    : `${cellNameOf(need.parentThreadId)} › ${need.title}`;
}

/** The kind of take a card Aski took was, by its need (the server's `autonomy/kinds.ts`). */
const TAKEN: Partial<Record<Shown["need"]["kind"], Kind>> = {
  failed: "retry",
  prose: "goAhead",
  plan: "implement",
};

/** Whether a card still takes an answer: live, and no answer of the person's held, sending or sent. */
export function answerableOf(shown: Shown, hold: Hold | undefined): boolean {
  if (shown.goneAt !== null || hold === undefined) return shown.goneAt === null;
  return hold.state === "failed" || hold.state === "stale";
}

/** Whether the keyboard is on `card` or in it, as a walk's step leaves it (walk.ts). */
const keyedIn = (card: HTMLElement): boolean =>
  card.matches(":focus-visible") || card.querySelector(":focus-visible") !== null;

/** What a held answer says it chose. */
export const pickLabel = (option: CardOption, given: Given): string =>
  given.words ? `${option.title.replace(/…$/, "")}: “${given.words.trim()}”` : option.title;

/** Why a held answer wasn't sent: the need changed under it. */
const staleLine = (need: Shown["need"], who: string): string =>
  need.kind === "stuck"
    ? `${who} moved again before yours went. Yours wasn't sent.`
    : `${who} already had an answer. Yours wasn't sent.`;

/** Where the words of an answer that wasn't sent went. */
const backLine = (hold: Hold | undefined): string =>
  hold?.wordsBack ? " Your words are back in Aski's composer." : "";

/**
 * One need: who and where, what is asked, and the options, each one app
 * action. A choice folds the card to it for the undo window; a need that is
 * gone greys in place and says why.
 */
export function NeedCard(props: {
  shown: Shown;
  hold: Hold | undefined;
  /** When this page first saw the need. */
  seenAt: number | null;
  /** Opens the asking chat; a peek beside the cards unless the list says otherwise. */
  openChat?: ((threadId: string) => void) | undefined;
  /** In a queue, a card that isn't the open one shows only who asks and what. */
  queued?: { readonly open: boolean; readonly onOpen: () => void } | undefined;
}) {
  const { need, goneAt } = props.shown;
  const hold = props.hold;
  const card = cardOf(need, useNowMinuteMs());
  const who = whoOf(need);
  const environmentId = usePrimaryEnvironmentId();
  const place = useCellPlace(
    environmentId === null ? null : { environmentId, threadId: need.threadId, draftId: null },
  );
  const open = useOpenFromNeeds();
  const settle = useSettleCell();
  // What the words in Aski's composer do to this card (answers/lit.ts).
  const lights = useLit();
  const fromWords = lights.reading.get(need.key) ?? null;
  const asked = lights.asked.get(need.key) ?? null;
  // Whether Aski is about to take this card for the person, or took it.
  const autonomy = useAutonomy();
  const taking = autonomy?.taking.find((each) => each.key === need.key) ?? null;
  const took = TAKEN[need.kind];
  const tookIt = took !== undefined && autonomy?.took.includes(need.key) === true;

  // An allow can't land in the card's first moment: a card arriving under
  // the pointer is read before it is clicked.
  const [allowReady, setAllowReady] = useState(false);
  useEffect(() => {
    const allowAt = (props.seenAt ?? 0) + timing("readBeforeAllow");
    const timer = setTimeout(() => setAllowReady(true), Math.max(0, allowAt - Date.now()));
    return () => clearTimeout(timer);
  }, [props.seenAt]);

  const section = useRef<HTMLElement>(null);
  // An answer of the person's own keeps the card from Aski's take.
  const keepFromAski = () => {
    if (taking !== null) void keepCard(need.key);
  };
  const choose = (option: CardOption, given: Given = {}) => {
    keepFromAski();
    answering(section.current);
    lit.answered(need.key);
    holds.hold({
      key: need.key,
      threadId: need.threadId,
      label: pickLabel(option, given),
      commands: commandsFor(need, option.choice, given, Date.now()),
    });
  };

  const gone = goneAt !== null;
  const folded = hold !== undefined && (hold.state === "holding" || hold.state === "sending");
  const answerable = answerableOf(props.shown, hold);
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
  useLayoutEffect(() => {
    if (collapsed || !landOnOpen.current || section.current === null) return;
    landOnOpen.current = false;
    land(section.current);
  }, [collapsed]);

  const head = (
    <>
      <span data-need-number="">{need.number}</span>
      <span data-need-who="">{who}</span>
      {place ? <span data-need-place="">{place.name}</span> : null}
      <span data-need-tag="">{card.tag}</span>
    </>
  );

  // What it asks, where the headline alone doesn't say: the question, the quote or the command.
  const what = card.questions[0]?.question ?? card.quote ?? card.request;

  if (collapsed) {
    return (
      <section
        ref={section}
        // The walk lands here, and the card opens (walk.ts).
        tabIndex={-1}
        data-stemcells-need=""
        data-open=""
        data-queued=""
        data-blocks={need.blocks || undefined}
        aria-label={`${need.number} ${who}: ${card.headline}`}
        onFocus={(event) => {
          if (event.target === event.currentTarget && keyedIn(event.currentTarget)) openQueued();
        }}
        onClick={openQueued}
      >
        <button type="button" data-need-head="" aria-expanded={false}>
          {head}
        </button>
        <p data-need-headline="">{card.headline}</p>
        {what ? <p data-need-what="">{what}</p> : null}
      </section>
    );
  }

  return (
    <section
      ref={section}
      // The walk lands here when the card recommends nothing (walk.ts).
      tabIndex={-1}
      data-stemcells-need=""
      data-open={answerable || undefined}
      data-blocks={need.blocks || undefined}
      data-gone={gone || undefined}
      aria-label={`${need.number} ${who}: ${card.headline}`}
    >
      <header data-need-head="">{head}</header>
      <p data-need-headline="">{card.headline}</p>
      {card.request ? <pre data-need-request="">{card.request}</pre> : null}
      {card.quote ? <blockquote data-need-quote="">{card.quote}</blockquote> : null}
      {card.steps.length > 0 ? (
        <ol data-need-steps="">
          {card.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {card.why ? <p data-need-why="">{card.why}</p> : null}
      {card.note ? <p data-need-note="">{card.note}</p> : null}

      {gone ? (
        <p data-need-receipt="">
          {hold?.state === "sent"
            ? "Sent."
            : tookIt
              ? KINDS[took].took
              : hold?.state === "stale"
                ? staleLine(need, who) + backLine(hold)
                : need.kind === "stuck"
                  ? "It's moving again."
                  : need.request !== null
                    ? "Answered elsewhere."
                    : "Taken care of elsewhere."}
        </p>
      ) : folded ? (
        <HeldAnswer hold={hold} />
      ) : hold?.state === "sent" ? (
        <p data-need-receipt="">Sent.</p>
      ) : (
        <>
          {taking !== null ? (
            <TakingFuse
              key={taking.at}
              kind={taking.kind}
              from={taking.from}
              at={taking.at}
              onUndo={() => keepCard(need.key)}
            />
          ) : null}
          {hold?.state === "failed" || hold?.state === "stale" ? (
            <p data-need-receipt="" data-warn="">
              {(hold.state === "stale" ? staleLine(need, who) : hold.why) + backLine(hold)}
            </p>
          ) : null}
          {fromWords?.kind === "chosen" && fromWords.words !== null ? (
            <p data-need-pending="">“{fromWords.words}”</p>
          ) : null}
          {card.questions.length > 0 ? (
            <Questions
              questions={card.questions}
              lit={fromWords}
              onAnswer={(answers, label) => {
                keepFromAski();
                answering(section.current);
                lit.answered(need.key);
                holds.hold({
                  key: need.key,
                  threadId: need.threadId,
                  label,
                  commands: commandsFor(need, { kind: "answer" }, { answers }, Date.now()),
                });
              }}
            />
          ) : null}
          {card.options.length > 0 ? (
            <Options
              options={card.options}
              allowReady={allowReady}
              lit={fromWords}
              asked={asked}
              onChoose={choose}
            />
          ) : null}
        </>
      )}

      <footer data-need-foot="">
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
          // Done with it, asked or not: it stops, then settles (upstream/settle.ts).
          <button
            type="button"
            onClick={() => void settle({ environmentId, threadId: need.threadId })}
          >
            Settle
          </button>
        ) : null}
        <button type="button" onClick={() => (props.openChat ?? openPeek)(need.threadId)}>
          Open chat
        </button>
      </footer>
    </section>
  );
}

function HeldAnswer(props: { hold: Hold }) {
  const sending = props.hold.state === "sending";
  return (
    <div data-need-held="">
      <div data-need-held-row="">
        <span data-need-held-what="">{props.hold.label}</span>
        {sending ? (
          <span data-need-held-sending="">Sending…</span>
        ) : (
          <button type="button" onClick={() => holds.undo(props.hold.key)}>
            Undo
          </button>
        )}
      </div>
      {sending ? null : (
        <div data-need-fuse="">
          <i style={{ animationDuration: `${props.hold.endsAt - props.hold.startedAt}ms` }} />
        </div>
      )}
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

function Options(props: {
  options: ReadonlyArray<CardOption>;
  allowReady: boolean;
  lit: Lit | null;
  asked: string | null;
  onChoose: (option: CardOption, given?: Given) => void;
}) {
  const [writing, setWriting] = useState<string | null>(null);
  return (
    <div data-need-options="">
      {props.options.map((option) =>
        writing === option.id ? (
          <Words
            key={option.id}
            placeholder={option.words ?? ""}
            onSend={(words) => props.onChoose(option, { words })}
            onCancel={() => setWriting(null)}
          />
        ) : (
          <button
            key={option.id}
            type="button"
            data-need-option=""
            data-recommended={option.recommended || undefined}
            data-allows={option.allows || undefined}
            data-warn={option.warn || undefined}
            data-lit={lightOf(option.id, props.lit, props.asked)}
            disabled={option.allows && !props.allowReady}
            onClick={() => (option.words ? setWriting(option.id) : props.onChoose(option))}
          >
            <span data-need-option-title="">{option.title}</span>
            {option.recommended ? <span data-need-option-mark="">Recommended</span> : null}
            <LightLine light={lightOf(option.id, props.lit, props.asked)} />
            {option.consequence ? (
              <span data-need-option-consequence="">{option.consequence}</span>
            ) : null}
          </button>
        ),
      )}
    </div>
  );
}

function LightLine(props: { light: keyof typeof LIGHT_LINES | undefined }) {
  return props.light === undefined ? null : (
    <span data-need-option-lit="">{LIGHT_LINES[props.light]}</span>
  );
}

function Words(props: {
  placeholder: string;
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
        Send
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
  onAnswer: (answers: Record<string, string | string[]>, label: string) => void;
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
  const labelFor = (question: CardQuestion, answer: string | string[]) =>
    (Array.isArray(answer) ? answer : [answer])
      .map(
        (value) =>
          question.options.find((choice) => choice.answer === value)?.label ?? `“${value}”`,
      )
      .join(", ");
  const send = () => {
    const answers: Record<string, string | string[]> = {};
    const labels: string[] = [];
    for (const question of props.questions) {
      const answer = answerOf(question);
      if (answer === null) return;
      answers[question.id] = answer;
      labels.push(labelFor(question, answer));
    }
    props.onAnswer(answers, labels.join(" · "));
  };
  const complete = props.questions.every((question) => answerOf(question) !== null);

  return (
    <div data-need-questions="">
      {props.questions.map((question, index) => (
        <div key={question.id} data-need-question="">
          {props.questions.length > 1 ? (
            <p data-need-question-head="">
              {index + 1}. {question.header}
            </p>
          ) : null}
          <p data-need-question-text="">{question.question}</p>
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
                    if (single)
                      return props.onAnswer({ [question.id]: choice.answer }, choice.label);
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
                  {choice.recommended ? <span data-need-option-mark="">Recommended</span> : null}
                  <LightLine light={lightOf(`answer:${choice.answer}`, props.lit, null)} />
                  {choice.description ? (
                    <span data-need-option-consequence="">{choice.description}</span>
                  ) : null}
                </button>
              );
            })}
            {question.other === null ? null : writing === question.id ? (
              <Words
                placeholder={question.other}
                onSend={(words) => {
                  if (single)
                    return props.onAnswer({ [question.id]: words.trim() }, `“${words.trim()}”`);
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
