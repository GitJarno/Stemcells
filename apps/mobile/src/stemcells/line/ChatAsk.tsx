// The ask a Cell's chat ends on (stemcells/tasks/the-ask.md): what it takes to decide and
// nothing more, under the Cell's last reply and scrolling with it, the reply being its context.
// A tap on a line shows the reply it came from. An answer goes at once; one that fails says so
// here.

import { createContext, type ReactElement, type ReactNode, use, useSyncExternalStore } from "react";
import { View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { useMinute } from "../home/state";
import { AppText, useProjectAt } from "../upstream/cells";
import { jumpToMessage, relativeTime, useChatMessages } from "../upstream/needs";
import { answering, answersFor } from "./answer";
import { chooserOf, type FailureDisk, Pill, useFailureDisk, Words } from "./Ask";
import { askButtonsOf, askPlaceOf, cardOf, repositoryUrlOf, STATUS_WORDS } from "./kit";
import { type Ask, chatAskIn } from "./line";
import { useKeepReadingChat, useReadings } from "./readings";
import { StatusSymbol } from "./StatusSymbol";

/** The most steps the card lists: more are the reply's to show. */
const STEPS = 3;

/**
 * The ask a chat ends on: its Cell's oldest its machine says, less those just answered and those
 * upstream's own panels over the composer answer. A draft (no `environmentId`) has none.
 */
function useShownAsk(environmentId: string | null, threadId: string): Ask | null {
  const readings = useReadings();
  const { answered } = useSyncExternalStore(answering.subscribe, answering.read);
  if (environmentId === null) return null;
  return chatAskIn(readings.get(environmentId), environmentId, threadId, answered);
}

/** The chat's ask, for the composer under it, which keeps the Cell's machine read meanwhile. */
export function useChatAsk(
  environmentId: string | null,
  threadId: string,
  busy: boolean,
): Ask | null {
  useKeepReadingChat(environmentId, threadId, busy, useMinute());
  return useShownAsk(environmentId, threadId);
}

/** The chat a thread screen shows, and whether this connection may answer in it. */
export interface AskChat {
  readonly environmentId: string;
  readonly threadId: string;
  readonly canAnswer: boolean;
}

/** Set by the thread screen (`upstream/substitutes/ThreadDetailScreen.tsx`) for its feed's end. */
export const AskChatContext = createContext<AskChat | null>(null);

/** Upstream's feed footer with the chat's ask first in it (`upstream/seams/ThreadFeed.ts`). */
export function withAskAtEnd(footer: ReactNode): ReactElement {
  return (
    <>
      <AskAtEnd />
      {footer}
    </>
  );
}

function AskAtEnd() {
  const chat = use(AskChatContext);
  const ask = useShownAsk(chat?.environmentId ?? null, chat?.threadId ?? "");
  return chat === null ? null : <ChatAsk ask={ask} {...chat} />;
}

function ChatAsk(props: AskChat & { readonly ask: Ask | null }) {
  const { failed } = useSyncExternalStore(answering.subscribe, answering.read);
  // An answer to this chat that didn't go: on its ask's card, or alone once the ask is off.
  const failure =
    [...failed.values()].find(
      (each) => each.environmentId === props.environmentId && each.threadId === props.threadId,
    )?.words ?? null;
  if (props.ask === null && failure === null) return null;
  return (
    <Animated.View
      key={props.ask?.key ?? "failure"}
      className="mb-3"
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(140)}
    >
      {props.ask === null ? (
        <View className={`${CARD} py-2.5`}>
          <AppText className="text-sm text-foreground-secondary">{failure}</AppText>
        </View>
      ) : props.ask.need.kind === "failed" ? (
        <FailedCard ask={props.ask} canAnswer={props.canAnswer} failure={failure} />
      ) : (
        <Card
          ask={props.ask}
          canAnswer={props.canAnswer}
          failure={failure}
          disk={null}
          freeSpace={null}
        />
      )}
    </Animated.View>
  );
}

/** As upstream's approval card (`PendingApprovalCard.tsx`). */
const CARD = "rounded-[20px] border border-border bg-card-alt px-4";

type CardProps = {
  readonly ask: Ask;
  readonly canAnswer: boolean;
  /** Why the last answer to this chat didn't go. */
  readonly failure: string | null;
};

function FailedCard(props: CardProps) {
  return <Card {...props} {...useFailureDisk(props.ask)} />;
}

function Card(props: CardProps & FailureDisk) {
  const { ask } = props;
  const { need } = ask;
  const now = Date.parse(useMinute());
  const card = cardOf(need, now, props.disk);
  const place = { environmentId: ask.environmentId, projectId: need.projectId };
  const repo = repositoryUrlOf(useProjectAt(place)?.repositoryIdentity);
  const at = askPlaceOf(need, useChatMessages(ask.environmentId, need.threadId));
  // The phone's markdown can't mark words in the reply, so a line shows the reply it came from.
  const show =
    at === null ? undefined : () => jumpToMessage(ask.environmentId, need.threadId, at.messageId);
  const line = show === undefined ? {} : { onPress: show, accessibilityHint: "Shows the reply" };
  const status = need.kind === "permission" ? "approval" : "input";
  const { choose, later } = answersFor(ask);
  const { primary, rest, notNow } = askButtonsOf(card);
  const pick = chooserOf(choose, props.freeSpace);
  const steps = card.steps.slice(0, STEPS);
  return (
    <View className={`${CARD} gap-2 py-3`}>
      <View className="flex-row items-center gap-1.5">
        <StatusSymbol status={status} size={13} />
        <AppText className="flex-1 font-t3-medium text-xs text-foreground-muted">
          {STATUS_WORDS[status]} · {relativeTime(need.since, now)}
        </AppText>
      </View>
      <AppText
        accessibilityRole="header"
        className="font-t3-bold text-base text-foreground"
        {...line}
      >
        <Words text={card.headline} repo={repo} />
      </AppText>
      {steps.map((step, index) => (
        <AppText key={step} className="text-sm text-foreground-secondary" {...line}>
          {index + 1}. <Words text={step} repo={repo} />
        </AppText>
      ))}
      {card.steps.length > STEPS ? (
        <AppText className="text-sm text-foreground-muted">
          {card.steps.length - STEPS} more in the reply
        </AppText>
      ) : null}
      {card.next ? (
        <AppText className="text-sm text-foreground-muted" {...line}>
          Then <Words text={card.next} repo={repo} />
        </AppText>
      ) : null}
      {props.failure !== null ? (
        <AppText className="text-sm text-foreground-secondary">{props.failure}</AppText>
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
