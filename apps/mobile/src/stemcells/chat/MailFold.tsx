import type { ComponentType } from "react";
import * as Haptics from "expo-haptics";
import { type ColorValue, Image, Pressable, View } from "react-native";

import { bodyOf, mailWord } from "../../../../../stemcells/words/cellMail.ts";
import { AskiFigure } from "../aski/AskiFigure";
import { useIsAskiChat } from "../aski/useAskiChat";
import { cellNameOf } from "../cell/kit";
import { AppText } from "../upstream/cells";
import {
  contextChipAccent,
  T3Wordmark,
  ThreadDisclosureChevron,
  useOpenLinkedThread,
  useUniwindTheme,
} from "../upstream/mailFold";
import { cellHref, cellPill } from "./cellLinks";
import { useCellStills } from "./useCellStills";

interface FoldProps<Environment, Thread> {
  readonly environmentId: Environment;
  readonly senderThreadId?: Thread;
  /** Upstream passes it only for a sender on a linked machine, which this row opens nothing on. */
  readonly senderTitle?: string;
  readonly summary: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly iconSubtleColor: ColorValue;
}

/** A message from another Cell, folded to one line: Stemcells' mark, Cell Mail, its sender. */
export function MailFold<Environment extends string, Thread extends string>(
  props: FoldProps<Environment, Thread> & {
    readonly fallback: ComponentType<FoldProps<Environment, Thread>>;
  },
) {
  const { fallback: Fallback, ...fold } = props;
  return props.senderThreadId === undefined ? (
    <Fallback {...fold} />
  ) : (
    <SentMailFold
      {...fold}
      sender={props.senderThreadId}
      elsewhere={props.senderTitle !== undefined}
    />
  );
}

/** The pill's text size, in points: `text-sm`. */
const TEXT = 14;
const NO_ONE: ReadonlySet<string> = new Set();

// The sender's pill is a button of its own beside the line's: VoiceOver reaches it, and a tap on
// it opens the sender's chat while a tap anywhere else on the line folds or unfolds.
function SentMailFold(props: {
  readonly environmentId: string;
  readonly sender: string;
  readonly elsewhere: boolean;
  readonly summary: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly iconSubtleColor: ColorValue;
}) {
  const aski = useIsAskiChat(props.sender);
  const name = aski ? "Aski" : cellNameOf(props.sender);
  const lead = `${mailWord(aski)} from`;
  const summary = bodyOf(props.summary, name);
  const stills = useCellStills(props.environmentId, aski ? NO_ONE : new Set([props.sender]));
  const toggle = () => {
    void Haptics.selectionAsync();
    props.onToggle();
  };
  return (
    <Pressable
      accessible={false}
      hitSlop={4}
      className="min-h-10 flex-row items-center gap-1.5 px-3.5 py-2"
      onPress={toggle}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${lead} ${name}: ${summary}`}
        accessibilityHint={`Double tap to ${props.expanded ? "hide" : "show"} the message.`}
        accessibilityState={{ expanded: props.expanded }}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={toggle}
        className="max-w-[60%] shrink-0 flex-row items-center gap-1.5"
      >
        <T3Wordmark colorClassName="accent-user-bubble-foreground-muted" height={10} />
        <AppText
          numberOfLines={1}
          className="shrink font-t3-medium text-sm text-user-bubble-foreground-muted"
        >
          {lead}
        </AppText>
        {props.elsewhere ? (
          <View className="shrink flex-row items-center gap-1">
            {stills.has(props.sender) ? (
              <Image source={{ uri: stills.get(props.sender) }} style={FACE} />
            ) : null}
            <AppText
              numberOfLines={1}
              className="shrink font-t3-medium text-sm text-user-bubble-foreground-muted"
            >
              {name}
            </AppText>
          </View>
        ) : null}
      </View>
      {props.elsewhere ? null : (
        <SenderPill
          environmentId={props.environmentId}
          sender={props.sender}
          name={name}
          aski={aski}
          stills={stills}
        />
      )}
      <AppText
        accessible={false}
        importantForAccessibility="no"
        numberOfLines={1}
        className="-ml-1.5 min-w-0 shrink text-sm text-user-bubble-foreground"
      >
        <AppText className="text-user-bubble-foreground-muted">: </AppText>
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

const FACE = { width: TEXT, height: TEXT } as const;

/**
 * The sender as a chat's words draw a Cell they name (`cellPill`), to the native pill's metrics
 * (`native/useEnrichedLinkVariants.ts`): its still, or Aski, then its name in the Cell tone.
 */
function SenderPill(props: {
  readonly environmentId: string;
  readonly sender: string;
  readonly name: string;
  readonly aski: boolean;
  readonly stills: ReadonlyMap<string, string>;
}) {
  const open = useOpenLinkedThread();
  const theme = useUniwindTheme();
  const pill = cellPill(
    cellHref(props.environmentId, props.sender),
    props.environmentId,
    new Map([[props.name, props.sender]]),
    props.stills,
  );
  const ink =
    contextChipAccent(pill?.chip.accent, theme, theme["--color-user-bubble-foreground"]) ??
    theme["--color-user-bubble-foreground"];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${props.name}`}
      // Up and down to the row's edges, never sideways onto the words that fold it.
      hitSlop={{ top: 9, bottom: 9 }}
      className="max-w-[40%] shrink-0 flex-row items-center"
      style={PILL}
      onPress={() => open({ environmentId: props.environmentId, threadId: props.sender })}
    >
      {props.aski ? (
        <AskiFigure height={TEXT} ink={ink} ground={theme["--color-user-bubble"]} />
      ) : pill?.icon ? (
        <Image source={pill.icon} style={FACE} />
      ) : null}
      <AppText numberOfLines={1} className="shrink font-t3-medium text-sm" style={{ color: ink }}>
        {props.name}
      </AppText>
    </Pressable>
  );
}

const PILL = { gap: TEXT / 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 } as const;
