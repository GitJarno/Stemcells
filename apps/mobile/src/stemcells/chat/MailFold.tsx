import type { ComponentType } from "react";
import * as Haptics from "expo-haptics";
import { type ColorValue, Pressable } from "react-native";

import { bodyOf, mailWord } from "../../../../../stemcells/words/cellMail.ts";
import { useIsAskiChat } from "../aski/useAskiChat";
import { cellNameOf } from "../cell/kit";
import { AppText } from "../upstream/cells";
import { T3Wordmark, ThreadDisclosureChevron } from "../upstream/mailFold";

interface FoldProps<Environment, Thread> {
  readonly environmentId: Environment;
  readonly senderThreadId?: Thread;
  readonly summary: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly iconSubtleColor: ColorValue;
}

/** A message from another Cell, folded to one line: Stemcells' mark, Cell Mail, its sender. */
export function MailFold<Environment, Thread extends string>(
  props: FoldProps<Environment, Thread> & {
    readonly fallback: ComponentType<FoldProps<Environment, Thread>>;
  },
) {
  const { fallback: Fallback, ...fold } = props;
  return props.senderThreadId === undefined ? (
    <Fallback {...fold} />
  ) : (
    <SentMailFold {...fold} sender={props.senderThreadId} />
  );
}

function SentMailFold(props: {
  readonly sender: string;
  readonly summary: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly iconSubtleColor: ColorValue;
}) {
  const aski = useIsAskiChat(props.sender);
  const label = `${mailWord(aski)} from ${aski ? "Aski" : cellNameOf(props.sender)}`;
  const summary = bodyOf(props.summary);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${summary}`}
      accessibilityHint={`Double tap to ${props.expanded ? "hide" : "show"} the message.`}
      accessibilityState={{ expanded: props.expanded }}
      hitSlop={4}
      className="min-h-10 flex-row items-center gap-1.5 px-3.5 py-2"
      onPress={() => {
        void Haptics.selectionAsync();
        props.onToggle();
      }}
    >
      <T3Wordmark colorClassName="accent-user-bubble-foreground-muted" height={10} />
      <AppText
        numberOfLines={1}
        className="max-w-[60%] shrink-0 font-t3-medium text-sm text-user-bubble-foreground-muted"
      >
        {label}
      </AppText>
      <AppText numberOfLines={1} className="min-w-0 shrink text-sm text-user-bubble-foreground">
        {summary}
      </AppText>
      <ThreadDisclosureChevron
        expanded={props.expanded}
        collapsedDirection="down"
        size={11}
        tintColor={props.iconSubtleColor}
      />
    </Pressable>
  );
}
