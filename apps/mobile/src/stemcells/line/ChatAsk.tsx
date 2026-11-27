// The ask a Cell's own chat docks over its composer (stemcells/tasks/the-ask.md): what it takes
// to decide and nothing more, the chat above being its context. It stays as the chat scrolls and
// leaves when the ask does; an answer stands in its place with Undo until it goes. On the folded
// Duo it rests as one line that opens on a tap, so the chat keeps its height.

import { useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { useMinute } from "../home/state";
import { NEEDS_YOU } from "../tokens";
import { AppText, SymbolView, useProjectAt } from "../upstream/cells";
import { jumpToMessage, relativeTime, useChatMessages, useDeviceType } from "../upstream/needs";
import { answersFor } from "./answer";
import { chooserOf, type FailureDisk, Pill, Quiet, useFailureDisk, Words } from "./Ask";
import { held } from "./heldLine";
import { askAnchorOf, cardOf, dockedButtonsOf, repositoryUrlOf, spansOf } from "./kit";
import { type Ask, chatAskIn } from "./line";
import { useKeepReadingChat, useReadings } from "./readings";

/** The most steps the card lists: more are the chat's to show. */
const STEPS = 3;

/**
 * The ask a chat docks: its Cell's oldest its machine says, less those just answered and those
 * upstream's own panels over the composer answer. Keeps the machine read meanwhile; a draft
 * (no `environmentId`) has none.
 */
export function useChatAsk(
  environmentId: string | null,
  threadId: string,
  busy: boolean,
): Ask | null {
  const minute = useMinute();
  useKeepReadingChat(environmentId, threadId, busy, minute);
  const readings = useReadings();
  const { answered } = useSyncExternalStore(held.subscribe, held.read);
  if (environmentId === null) return null;
  return chatAskIn(readings.get(environmentId), environmentId, threadId, answered);
}

export function ChatAsk(props: {
  readonly ask: Ask | null;
  readonly environmentId: string;
  readonly threadId: string;
  /** Whether this connection may answer: without, the card only says what's asked. */
  readonly canAnswer: boolean;
  readonly contentMaxWidth: number | undefined;
}) {
  const { line } = useSyncExternalStore(held.subscribe, held.read);
  const about = line?.kind === "held" ? line.act : line?.kind === "said" ? line.about : null;
  const ours =
    about !== null &&
    about.environmentId === props.environmentId &&
    about.threadId === props.threadId;
  // An answer to this chat's ask stands where the ask stood, until it goes.
  const shown = ours && line !== null && line.kind !== "done" ? line : null;
  if (props.ask === null && shown === null) return null;
  return (
    <Animated.View
      key={shown === null ? props.ask?.key : `line:${shown.kind}`}
      className="px-[12px] pb-1.5"
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(140)}
    >
      <View className="w-full self-center" style={{ maxWidth: props.contentMaxWidth }}>
        {shown !== null ? (
          <View className={`${CARD} flex-row items-center gap-3 py-2.5`}>
            <AppText className="flex-1 text-sm text-foreground-secondary" numberOfLines={2}>
              {shown.kind === "held" ? shown.act.words : shown.words}
            </AppText>
            {shown.kind === "held" ? <Quiet label="Undo" onPress={held.undo} /> : null}
          </View>
        ) : props.ask?.need.kind === "failed" ? (
          <FailedDock ask={props.ask} canAnswer={props.canAnswer} />
        ) : props.ask ? (
          <Dock ask={props.ask} canAnswer={props.canAnswer} disk={null} freeSpace={null} />
        ) : null}
      </View>
    </Animated.View>
  );
}

/** As upstream's docked approval card (`PendingApprovalCard.tsx`). */
const CARD = "rounded-[20px] border border-border bg-card-alt px-4";

type DockProps = { readonly ask: Ask; readonly canAnswer: boolean };

function FailedDock(props: DockProps) {
  return <Dock {...props} {...useFailureDisk(props.ask)} />;
}

function Dock(props: DockProps & FailureDisk) {
  const { ask } = props;
  const { need } = ask;
  const now = Date.parse(useMinute());
  const card = cardOf(need, now, props.disk);
  const place = { environmentId: ask.environmentId, projectId: need.projectId };
  const repo = repositoryUrlOf(useProjectAt(place)?.repositoryIdentity);
  const folds = useDeviceType() === "duo-folded";
  const [opened, setOpened] = useState(false);
  const anchor = askAnchorOf(need, useChatMessages(ask.environmentId, need.threadId));
  const age = relativeTime(need.since, now);
  if (folds && !opened)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens what it asks"
        onPress={() => setOpened(true)}
        className={`${CARD} flex-row items-center gap-2 py-2.5 active:opacity-70`}
      >
        <Dot />
        <AppText className="flex-1 font-t3-medium text-sm text-foreground" numberOfLines={1}>
          {spansOf(card.headline)
            .map((span) => span.text)
            .join("")}
        </AppText>
        <AppText className="text-xs tabular-nums text-foreground-muted">{age}</AppText>
        <SymbolView name="chevron.up" size={11} tintColorClassName="accent-icon" />
      </Pressable>
    );
  const { choose, later } = answersFor(ask);
  const { primary, rest, notNow } = dockedButtonsOf(card);
  const pick = chooserOf(choose, props.freeSpace);
  const steps = card.steps.slice(0, STEPS);
  return (
    <View className={`${CARD} gap-2 py-3`}>
      <View className="flex-row items-center gap-1.5">
        <Dot />
        <AppText className="flex-1 font-t3-medium text-xs text-foreground-muted">
          Input · {age}
        </AppText>
        {anchor === null ? null : (
          <Quiet
            label="↑ Where it asked"
            onPress={() => jumpToMessage(ask.environmentId, need.threadId, anchor.messageId)}
          />
        )}
        {folds ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fold"
            hitSlop={10}
            onPress={() => setOpened(false)}
            className="pl-2"
          >
            <SymbolView name="chevron.down" size={11} tintColorClassName="accent-icon" />
          </Pressable>
        ) : null}
      </View>
      <AppText accessibilityRole="header" className="font-t3-bold text-base text-foreground">
        <Words text={card.headline} repo={repo} />
      </AppText>
      {steps.map((step, index) => (
        <AppText key={step} className="text-sm text-foreground-secondary">
          {index + 1}. <Words text={step} repo={repo} />
        </AppText>
      ))}
      {card.steps.length > STEPS ? (
        <AppText className="text-sm text-foreground-muted">
          {card.steps.length - STEPS} more in the chat
        </AppText>
      ) : null}
      {card.next ? (
        <AppText className="text-sm text-foreground-muted">
          Then <Words text={card.next} repo={repo} />
        </AppText>
      ) : null}
      {props.canAnswer && (primary !== null || rest.length > 0 || notNow !== null) ? (
        <View className="flex-row flex-wrap items-center gap-2 pt-1">
          {primary ? <Pill filled title={primary.title} onPress={() => pick(primary)} /> : null}
          {rest.map((option) => (
            <Pill
              key={option.id}
              filled={false}
              title={option.title}
              onPress={() => pick(option)}
            />
          ))}
          {notNow ? <Pill filled={false} title="Not now" onPress={later} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Dot() {
  return <View className="size-1.5 rounded-full" style={{ backgroundColor: NEEDS_YOU }} />;
}
