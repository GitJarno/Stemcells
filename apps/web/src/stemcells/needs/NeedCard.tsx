import { useEffect, useState, type KeyboardEvent } from "react";

import { cellNameOf } from "../cell/name";
import { timing } from "../tokens/motion";
import { useNowMinuteMs, useOpenFromNeeds, usePrimaryEnvironmentId } from "../upstream/needs";
import { useCellPlace } from "../upstream/thread";
import { commandsFor, type Given } from "./actions";
import { cardOf, LATER, type CardOption, type CardQuestion } from "./card";
import type { Shown } from "./display";
import type { Hold } from "./holds";
import { holds } from "./live";
import { type Lit, lit, useLit } from "./answers/lit";

/** Who the card is for: the Cell's name, or a subagent's under its parent's. */
export function whoOf(need: Shown["need"]): string {
  return need.parentThreadId === null
    ? cellNameOf(need.threadId)
    : `${cellNameOf(need.parentThreadId)} › ${need.title}`;
}

/** What a held answer says it chose. */
export const pickLabel = (option: CardOption, given: Given): string =>
  given.words ? `${option.title.replace(/…$/, "")}: “${given.words.trim()}”` : option.title;

/** Why a held answer wasn't sent: the need changed under it. */
const staleLine = (need: Shown["need"], who: string): string =>
  need.kind === "stuck"
    ? `${who} moved again before yours went. Yours wasn't sent.`
    : `${who} already had an answer. Yours wasn't sent.`;

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
  // What the words in Aski's composer do to this card (answers/lit.ts).
  const lights = useLit();
  const fromWords = lights.reading.get(need.key) ?? null;
  const asked = lights.asked.get(need.key) ?? null;

  // An allow can't land in the card's first moment: a card arriving under
  // the pointer is read before it is clicked.
  const [allowReady, setAllowReady] = useState(false);
  useEffect(() => {
    const allowAt = (props.seenAt ?? 0) + timing("readBeforeAllow");
    const timer = setTimeout(() => setAllowReady(true), Math.max(0, allowAt - Date.now()));
    return () => clearTimeout(timer);
  }, [props.seenAt]);

  const choose = (option: CardOption, given: Given = {}) => {
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
  const answerable = !gone && !folded && hold?.state !== "sent";

  return (
    <section
      data-stemcells-need=""
      data-blocks={need.blocks || undefined}
      data-gone={gone || undefined}
      aria-label={`${need.number} ${who}: ${card.headline}`}
    >
      <header data-need-head="">
        <span data-need-number="">{need.number}</span>
        <span data-need-who="">{who}</span>
        {place ? <span data-need-place="">{place.name}</span> : null}
        <span data-need-tag="">{card.tag}</span>
      </header>
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
      {card.note ? <p data-need-note="">{card.note}</p> : null}

      {gone ? (
        <p data-need-receipt="">
          {hold?.state === "sent"
            ? "Sent."
            : hold?.state === "stale"
              ? staleLine(need, who)
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
          {hold?.state === "failed" || hold?.state === "stale" ? (
            <p data-need-receipt="" data-warn="">
              {hold.state === "stale" ? staleLine(need, who) : hold.why}
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
        <button type="button" onClick={() => open.chat(need.threadId)}>
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
