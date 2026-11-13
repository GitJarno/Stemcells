// The collection's small parts, shared by its views: a titled section and a chip to pick with.

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "../upstream/disk";

export const NUMBERS = { fontVariant: ["tabular-nums" as const] };

export const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** A Cell that stands in on a tile: no chat's, so its look is only what the tile gives it. */
export const STAND_IN = "collection";

export function Section(props: {
  readonly title: string;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3 px-2">
        <AppText
          textRole="footnote"
          accessibilityRole="header"
          className="shrink font-t3-medium text-foreground-muted"
        >
          {props.title}
        </AppText>
        {props.trailing}
      </View>
      {props.children}
    </View>
  );
}

/** One of a row to pick from: a machine, or a Cell to dress. */
export function Chip(props: {
  readonly on: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.on }}
      accessibilityLabel={props.label}
      onPress={props.onPress}
      className={`min-h-11 flex-row items-center gap-2 rounded-full border px-3.5 active:opacity-70 ${
        props.on ? "border-transparent bg-subtle-strong" : "border-border"
      }`}
    >
      {props.children}
      <AppText
        className={`text-sm ${props.on ? "font-t3-medium text-foreground" : "text-foreground-muted"}`}
        numberOfLines={1}
      >
        {props.label}
      </AppText>
    </Pressable>
  );
}
