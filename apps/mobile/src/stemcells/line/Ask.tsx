// An ask as a message (stemcells/tasks/aski-asks.md, decisions 4 to 6, and unblocking.md): who,
// project and age; what to do, largest; what the Cell did, two lines until More; what waits on it
// and where its reply points; the options side by side, Reply… last, which opens a full-width
// field. A Cell's own choices to a question stay rows. Closed, an ask says only who asks and what.

import { useEffect, useState, type ReactNode } from "react";
import { Linking, Pressable, View } from "react-native";

import { cellNameOf } from "../cell/kit";
import { diskFailure } from "../disk/kit";
import { ThreadCell } from "../cell/ThreadCell";
import { CODE_FONT, NEEDS_YOU } from "../tokens";
import { AppText, type EnvironmentThreadShell } from "../upstream/cells";
import { useFreeSpace } from "../disk/useFreeSpace";
import { useMachineDisk } from "../upstream/disk";
import { AppTextInput, relativeTime } from "../upstream/needs";
import {
  cardOf,
  type CardOption,
  type CardQuestion,
  type Given,
  LATER,
  type Need,
  NOTHING_TO_DO,
  spansOf,
} from "./kit";
import type { Ask } from "./line";

/** An allow can't land in an ask's first moment: one opening under the finger is read first. */
const READ_BEFORE_ALLOW_MS = 1_000;

/** Who asks: the Cell's name, or a Subcell's under its parent's. */
export const whoOf = (need: Need): string =>
  need.parentThreadId === null
    ? cellNameOf(need.threadId)
    : `${cellNameOf(need.parentThreadId)} › ${need.title}`;

export interface AskActs {
  readonly choose: (option: CardOption, given?: Given) => void;
  readonly later: () => void;
  /** Absent when the phone can't settle it (its chat isn't on the phone). */
  readonly settle: (() => void) | null;
  readonly openChat: () => void;
}

type AskCardProps = {
  readonly ask: Ask;
  readonly cell: EnvironmentThreadShell | undefined;
  readonly project: string | null;
  readonly now: number;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly acts: AskActs;
};

export function AskCard(props: AskCardProps) {
  return props.ask.need.kind === "failed" ? (
    <FailedAsk {...props} />
  ) : (
    <AskBody {...props} disk={null} freeSpace={null} />
  );
}

/** A failed turn reads its machine's disk: a full one says so, and offers the cleanup Cell. */
function FailedAsk(props: AskCardProps) {
  const disk = useMachineDisk(props.ask.environmentId);
  const freeSpace = useFreeSpace(props.ask.environmentId);
  return (
    <AskBody
      {...props}
      disk={disk ? diskFailure(props.ask.need.key, disk.free) : null}
      freeSpace={freeSpace}
    />
  );
}

function AskBody(
  props: AskCardProps & {
    readonly disk: ReturnType<typeof diskFailure> | null;
    readonly freeSpace: (() => Promise<void>) | null;
  },
) {
  const { need } = props.ask;
  const card = cardOf(need, props.now, props.disk);
  // The cleanup Cell is a new Cell on the full machine: the ask stays until it retries.
  const choose = (option: CardOption, given?: Given) =>
    option.choice.kind === "freeSpace"
      ? void props.freeSpace?.()
      : props.acts.choose(option, given);
  const head = (
    <View className="flex-row items-center gap-2">
      {props.cell ? <ThreadCell thread={props.cell} points={1} /> : null}
      <AppText className="shrink text-xs text-foreground-secondary" numberOfLines={1}>
        {whoOf(need)}
      </AppText>
      {props.project ? (
        <AppText className="shrink text-xs text-foreground-muted" numberOfLines={1}>
          {props.project}
        </AppText>
      ) : null}
      <View className="flex-1" />
      {/* An ask that holds up a running turn says so in its age's amber. */}
      <AppText
        className="text-xs text-foreground-muted"
        style={need.blocks ? { color: NEEDS_YOU } : undefined}
      >
        {relativeTime(need.since)}
      </AppText>
    </View>
  );
  if (!props.open)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens this ask"
        onPress={props.onOpen}
        className="mx-3 mb-2 gap-1.5 rounded-[20px] bg-grouped-card px-4 py-3 active:opacity-70"
      >
        {head}
        <AppText className="text-base text-foreground" numberOfLines={2}>
          {spansOf(card.headline)
            .map((span) => span.text)
            .join("")}
        </AppText>
      </Pressable>
    );
  // "Nothing to do" is the foot's Settle; a reply comes last.
  const options = card.options.filter((option) => option.id !== NOTHING_TO_DO);
  const rows = [
    ...options.filter((option) => option.choice.kind !== "reply"),
    ...options.filter((option) => option.choice.kind === "reply"),
  ];
  return (
    <View className="mx-3 mb-2 gap-3 rounded-[20px] bg-grouped-card px-4 py-3.5">
      {head}
      <AppText accessibilityRole="header" className="font-t3-bold text-xl text-foreground">
        <Words text={card.headline} />
      </AppText>
      {card.steps.map((step, index) => (
        <AppText key={step} className="text-base text-foreground">
          {index + 1}. <Words text={step} />
        </AppText>
      ))}
      {card.quote ? <Context text={card.quote} /> : null}
      {card.request ? (
        <AppText
          selectable
          className="rounded-xl bg-subtle px-3 py-2 text-xs text-foreground"
          style={{ fontFamily: CODE_FONT }}
        >
          {card.request}
        </AppText>
      ) : null}
      {card.next ? (
        <AppText className="text-sm text-foreground-secondary">
          <AppText className="font-t3-medium text-sm text-foreground">
            Then {cellNameOf(need.parentThreadId ?? need.threadId)}:
          </AppText>{" "}
          <Words text={card.next} />
        </AppText>
      ) : null}
      {card.links.length > 0 ? (
        <AppText className="text-sm text-foreground-muted">
          <Words text={card.links.map((link) => `[${link.label}](${link.url})`).join(" · ")} />
        </AppText>
      ) : null}
      {card.why ? <AppText className="text-xs text-foreground-muted">{card.why}</AppText> : null}
      {card.note ? <AppText className="text-sm text-foreground-muted">{card.note}</AppText> : null}
      {card.questions.length > 0 ? (
        <Questions
          questions={card.questions}
          onAnswer={(answers) => props.acts.choose(ANSWER, { answers })}
        />
      ) : null}
      {rows.length > 0 ? <Options options={rows} onChoose={choose} /> : null}
      <View className="flex-row gap-5 pt-1">
        {card.later ? <Quiet label={LATER.title} onPress={props.acts.later} /> : null}
        {props.acts.settle ? <Quiet label="Settle" onPress={props.acts.settle} /> : null}
        <Quiet label="Open chat" onPress={props.acts.openChat} />
      </View>
    </View>
  );
}

/** A question's answers go as this option, which carries no row of its own. */
const ANSWER: CardOption = {
  id: "answer",
  title: "Send answers",
  consequence: null,
  recommended: false,
  warn: false,
  allows: false,
  words: null,
  choice: { kind: "answer" },
};

function Quiet(props: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} hitSlop={8}>
      <AppText className="text-sm text-foreground-muted">{props.label}</AppText>
    </Pressable>
  );
}

/** The Cell's words, two lines until More shows them all, in place. */
function Context(props: { readonly text: string }) {
  const [long, setLong] = useState(false);
  const [more, setMore] = useState(false);
  return (
    <View>
      <AppText className="text-sm text-foreground-secondary" numberOfLines={more ? undefined : 2}>
        <Words text={props.text} />
      </AppText>
      {/* The words unclamped, unseen, to tell whether they run past two lines. */}
      <AppText
        aria-hidden
        className="absolute inset-x-0 top-0 text-sm opacity-0"
        onTextLayout={(event) => setLong(event.nativeEvent.lines.length > 2)}
      >
        {props.text}
      </AppText>
      {long && !more ? <Quiet label="More" onPress={() => setMore(true)} /> : null}
    </View>
  );
}

function Row(props: {
  readonly title: string;
  readonly lit?: boolean;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly onPress: () => void;
  readonly children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true, selected: props.pressed }}
      disabled={props.disabled}
      onPress={props.onPress}
      className={
        props.lit || props.pressed
          ? "gap-0.5 rounded-xl bg-subtle-strong px-3 py-2.5 active:opacity-70"
          : "gap-0.5 rounded-xl px-3 py-2.5 active:bg-subtle"
      }
    >
      <AppText
        className={
          props.disabled
            ? "text-base text-foreground-muted"
            : "font-t3-medium text-base text-foreground"
        }
      >
        {props.title}
      </AppText>
      {props.children}
    </Pressable>
  );
}

/**
 * The ask's options side by side (unblocking.md, decision 6), the recommended one filled. What
 * the recommended or a warned one does shows under them. One that takes words turns the row
 * into a full-width field, focused.
 */
function Options(props: {
  readonly options: ReadonlyArray<CardOption>;
  readonly onChoose: (option: CardOption, given?: Given) => void;
}) {
  const [writing, setWriting] = useState<CardOption | null>(null);
  const [allowReady, setAllowReady] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Let an allow land once the ask has been open long enough to read; clear the timer on unmount.
  useEffect(() => {
    const timer = setTimeout(() => setAllowReady(true), READ_BEFORE_ALLOW_MS);
    return () => clearTimeout(timer);
  }, []);
  if (writing !== null)
    return (
      <Field
        placeholder={writing.words ?? ""}
        onSend={(words) => props.onChoose(writing, { words })}
        onCancel={() => setWriting(null)}
      />
    );
  const said =
    props.options.find((option) => option.warn) ??
    props.options.find((option) => option.recommended && !option.allows);
  return (
    <View className="gap-1.5">
      <View className="flex-row flex-wrap gap-2">
        {props.options.map((option) => {
          const filled = option.recommended && !option.allows;
          const disabled = option.allows && !allowReady;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => (option.words ? setWriting(option) : props.onChoose(option))}
              className={
                filled
                  ? "rounded-full bg-foreground px-4 py-2 active:opacity-70"
                  : "rounded-full border border-border px-4 py-2 active:bg-subtle"
              }
              style={option.warn ? { borderColor: NEEDS_YOU } : undefined}
            >
              <AppText
                className={
                  filled
                    ? "font-t3-medium text-base text-background"
                    : disabled
                      ? "text-base text-foreground-muted"
                      : "font-t3-medium text-base text-foreground"
                }
              >
                {option.title}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {said?.consequence ? (
        <AppText
          className="text-sm text-foreground-muted"
          style={said.warn ? { color: NEEDS_YOU } : undefined}
        >
          {said.consequence}
        </AppText>
      ) : null}
    </View>
  );
}

/** An ask's words: links open where the phone opens them, code in the code face, bold bold. */
function Words(props: { readonly text: string }) {
  return spansOf(props.text).map((span, index) =>
    span.kind === "link" ? (
      <AppText
        // oxlint-disable-next-line react/no-array-index-key -- spans have no identity but their place
        key={index}
        accessibilityRole="link"
        className="text-primary-text underline"
        onPress={() => void Linking.openURL(span.url).catch(() => undefined)}
      >
        {span.text}
      </AppText>
    ) : span.kind === "code" ? (
      // oxlint-disable-next-line react/no-array-index-key -- spans have no identity but their place
      <AppText key={index} style={{ fontFamily: CODE_FONT }}>
        {span.text}
      </AppText>
    ) : span.kind === "strong" ? (
      // oxlint-disable-next-line react/no-array-index-key -- spans have no identity but their place
      <AppText key={index} className="font-t3-bold">
        {span.text}
      </AppText>
    ) : (
      span.text
    ),
  );
}

function Field(props: {
  readonly placeholder: string;
  readonly onSend: (words: string) => void;
  readonly onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const send = () => {
    if (text.trim() !== "") props.onSend(text);
  };
  return (
    <View className="gap-2">
      <AppTextInput
        // The person opened this field to type into it.
        autoFocus
        multiline
        value={text}
        placeholder={props.placeholder}
        onChangeText={setText}
        submitBehavior="blurAndSubmit"
        returnKeyType="send"
        onSubmitEditing={send}
      />
      <View className="flex-row justify-end gap-5">
        <Quiet label="Cancel" onPress={props.onCancel} />
        <Pressable
          accessibilityRole="button"
          disabled={text.trim() === ""}
          onPress={send}
          hitSlop={8}
        >
          <AppText
            className={
              text.trim() === ""
                ? "text-sm text-foreground-muted"
                : "font-t3-bold text-sm text-primary-text"
            }
          >
            Send
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A Cell's own questions, its options in its order, each with its own words. One plain
 * question answers on a tap; several, or one taking many picks, answer together.
 */
function Questions(props: {
  readonly questions: ReadonlyArray<CardQuestion>;
  readonly onAnswer: (answers: Record<string, string | string[]>) => void;
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
  const answers = props.questions.map((question) => [question.id, answerOf(question)] as const);
  const complete = answers.every(([, answer]) => answer !== null);
  return (
    <View className="gap-3">
      {props.questions.map((question, index) => (
        <View key={question.id} className="gap-1">
          {/* One question is the ask's own line; several each say theirs. */}
          {props.questions.length > 1 ? (
            <AppText className="font-t3-medium text-sm text-foreground">
              {index + 1}. {question.question}
            </AppText>
          ) : null}
          {question.options.map((choice) => {
            const chosen = (picked[question.id] ?? []).includes(choice.answer);
            return (
              <Row
                key={choice.answer}
                title={choice.label}
                pressed={!single && chosen}
                onPress={() => {
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
                {choice.description ? (
                  <AppText className="text-sm text-foreground-muted">{choice.description}</AppText>
                ) : null}
              </Row>
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
            <Row
              title={own[question.id]?.trim() ? `“${own[question.id]?.trim()}”` : "Reply…"}
              pressed={!single && Boolean(own[question.id]?.trim())}
              onPress={() => setWriting(question.id)}
            />
          )}
        </View>
      ))}
      {single ? null : (
        <Row
          title="Send answers"
          disabled={!complete}
          onPress={() => {
            if (complete)
              props.onAnswer(Object.fromEntries(answers) as Record<string, string | string[]>);
          }}
        />
      )}
    </View>
  );
}
