// An ask (stemcells/tasks/aski-asks.md, unblocking.md), in Flying's and Landed's card: the Cell
// and its name left, what to do as the title, its age top right, its project bottom right. Open,
// it grows under that head: what the Cell did, what waits on it, the options, Reply… last, which
// opens a full-width field. A Cell's own choices to a question stay rows.

import { useEffect, useState, type ReactNode } from "react";
import { Linking, Pressable, View } from "react-native";

import { cellNameOf } from "../cell/kit";
import { diskFailure } from "../disk/kit";
import { CellBesideRow, type CardMarks, marksWidth } from "../home/RowCell";
import { CODE_FONT, NEEDS_YOU } from "../tokens";
import { AppText, type EnvironmentThreadShell, useProject } from "../upstream/cells";
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
    <AskHead
      cell={props.cell}
      name={whoOf(need)}
      // A Subcell's ask names it over its parent's title.
      over={need.parentThreadId === null ? null : `› ${need.title}`}
      title={
        props.open ? (
          <Words text={card.headline} />
        ) : (
          spansOf(card.headline)
            .map((span) => span.text)
            .join("")
        )
      }
      open={props.open}
      corner={relativeTime(need.since)}
      // An ask that holds up a running turn says so in its age's amber.
      urgent={need.blocks}
    />
  );
  if (!props.open)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${whoOf(need)} asks`}
        accessibilityHint="Opens this ask"
        onPress={props.onOpen}
        className={`${CARD} active:opacity-70`}
      >
        {head}
      </Pressable>
    );
  // "Nothing to do" is the foot's Settle; a reply comes last.
  const options = card.options.filter((option) => option.id !== NOTHING_TO_DO);
  const rows = [
    ...options.filter((option) => option.choice.kind !== "reply"),
    ...options.filter((option) => option.choice.kind === "reply"),
  ];
  return (
    <View className={`${CARD} gap-3`}>
      {head}
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

/** A card as T3's rows are on the home (`upstream/substitutes/thread-list-v2-row-appearance.ts`). */
const CARD = "mx-3 mb-2 rounded-[20px] bg-grouped-card py-3 pl-3 pr-4";

const NO_PULL_REQUEST = () => undefined;

/**
 * An ask's head, as a card row's: its Cell and name on the left, the title beside them, the
 * corner's words top right, the project's mark bottom right. A Cell whose chat isn't on the
 * phone has its name alone.
 */
export function AskHead(props: {
  readonly cell: EnvironmentThreadShell | undefined;
  readonly name?: string;
  readonly over: string | null;
  readonly title: ReactNode;
  readonly open: boolean;
  readonly corner: string;
  readonly urgent: boolean;
}) {
  const { cell } = props;
  const project = useProject(
    cell ? { environmentId: cell.environmentId, projectId: cell.projectId } : null,
  );
  const marks: CardMarks = {
    machine: null,
    machineLabel: null,
    pr: null,
    prLabel: null,
    onOpenPullRequests: NO_PULL_REQUEST,
    project,
  };
  const body = (
    <View className="flex-row items-start gap-2">
      <View className="min-w-0 flex-1 gap-0.5">
        {props.over ? (
          <AppText className="text-xs text-foreground-muted" numberOfLines={1}>
            {props.over}
          </AppText>
        ) : null}
        <AppText
          accessibilityRole={props.open ? "header" : undefined}
          className={
            props.open
              ? "font-t3-bold text-lg text-foreground"
              : "font-t3-medium text-base text-foreground"
          }
          numberOfLines={props.open ? undefined : 2}
        >
          {props.title}
        </AppText>
      </View>
      {/* As wide as the marks under it, so the title's second line never runs beneath them. */}
      <View className="items-end" style={{ minWidth: marksWidth(marks), paddingTop: 2 }}>
        <AppText
          className="text-xs font-t3-bold tabular-nums text-foreground-muted"
          style={props.urgent ? { color: NEEDS_YOU } : undefined}
        >
          {props.corner}
        </AppText>
      </View>
    </View>
  );
  if (cell === undefined)
    return (
      <View className="gap-1 pl-1">
        <AppText className="text-[10px] text-foreground-muted">{props.name}</AppText>
        {body}
      </View>
    );
  return (
    <CellBesideRow thread={cell} marks={marks}>
      {/* Room under a one-line title for the marks, as a card row keeps. */}
      <View style={{ minHeight: 40 }}>{body}</View>
    </CellBesideRow>
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
