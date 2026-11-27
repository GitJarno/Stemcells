// An ask's pieces (stemcells/tasks/the-ask.md): who asks, what a choice does, and the buttons and
// words the card a Cell's chat docks is drawn with (`ChatAsk.tsx`).

import { Linking, Pressable } from "react-native";

import { cellNameOf } from "../cell/kit";
import { diskFailure } from "../disk/kit";
import { CODE_FONT } from "../tokens";
import { AppText } from "../upstream/cells";
import { useFreeSpace } from "../disk/useFreeSpace";
import { useMachineDisk } from "../upstream/disk";
import { type CardOption, type Given, type Need, spansOf } from "./kit";
import type { Ask } from "./line";

/** Who asks: the Cell's name, or a Subcell's under its parent's. */
export const whoOf = (need: Need): string =>
  need.parentThreadId === null
    ? cellNameOf(need.threadId)
    : `${cellNameOf(need.parentThreadId)} › ${need.title}`;

export interface AskActs {
  readonly choose: (option: CardOption, given?: Given) => void;
  readonly later: () => void;
}

/** A failed turn reads its machine's disk: a full one says so, and offers the cleanup Cell. */
export function useFailureDisk(ask: Ask): FailureDisk {
  const disk = useMachineDisk(ask.environmentId);
  return {
    disk: disk ? diskFailure(ask.need.key, disk.free) : null,
    freeSpace: useFreeSpace(ask.environmentId),
  };
}

export interface FailureDisk {
  readonly disk: ReturnType<typeof diskFailure> | null;
  readonly freeSpace: (() => Promise<void>) | null;
}

/** The cleanup Cell is a new Cell on the full machine: the ask stays until it retries. */
export const chooserOf =
  (choose: AskActs["choose"], freeSpace: FailureDisk["freeSpace"]) =>
  (option: CardOption, given?: Given) =>
    option.choice.kind === "freeSpace" ? void freeSpace?.() : choose(option, given);

/** An option's button: filled when it's the one to take. */
export function Pill(props: {
  readonly title: string;
  readonly filled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      className={
        props.filled
          ? "rounded-full bg-foreground px-3.5 py-1.5 active:opacity-70"
          : "rounded-full border border-border px-3.5 py-1.5 active:bg-subtle"
      }
    >
      <AppText
        className={
          props.filled
            ? "font-t3-medium text-sm text-background"
            : "font-t3-medium text-sm text-foreground"
        }
      >
        {props.title}
      </AppText>
    </Pressable>
  );
}

/** An ask's words: links open where the phone opens them, code in the code face, bold bold. */
export function Words(props: { readonly text: string; readonly repo: string | null }) {
  return spansOf(props.text, props.repo).map((span, index) =>
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
