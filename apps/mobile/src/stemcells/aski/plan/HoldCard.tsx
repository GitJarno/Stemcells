// A deletion on the phone (stemcells/tasks/aski-orchestrator.md, decision 7): a card naming
// what goes, what was heard and what stays, confirmed only by a hand held on the named thing
// until it fills. A tap does nothing, and no word or key confirms it: the target has no press
// handler at all, only a finger going down and coming up.

import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { DestroyAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { canDestroy } from "../../../../../../stemcells/orchestrator/tray.ts";
import {
  DROP,
  HOLD_HEARD,
  HOLD_PRESS,
  HOLD_UNKNOWN,
  holdLine,
  holdStays,
} from "../../../../../../stemcells/words/plans.ts";
import { Pill } from "../../line/Ask";
import { AppText } from "../../upstream/plans";
import { HOLD_MS, STATUS_WORDS } from "./view";

/** The thing a deletion names, as the hand reads it. */
function named(act: DestroyAct): string {
  if (act.target === "cells" && act.cells.length > 0)
    return act.cells.map((cell) => cell.name).join(", ");
  return act.place?.name ?? "";
}

export function HoldCard(props: {
  readonly act: DestroyAct;
  readonly status: "waiting" | "dropped" | "done";
  /** Why the last try didn't go. */
  readonly refused: string | null;
  readonly onHeld: () => void;
  readonly onDrop: () => void;
}) {
  const { act, status } = props;
  const reduced = useReducedMotion();
  const fill = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Under Reduce Motion the fill comes up in place, with no edge crossing the name.
  const filling = useAnimatedStyle(
    () => (reduced ? { opacity: fill.get() } : { opacity: 1, transform: [{ scaleX: fill.get() }] }),
    [reduced],
  );
  const down = () => {
    if (timer.current !== null) return;
    fill.set(
      withTiming(1, {
        duration: HOLD_MS,
        easing: Easing.linear,
        // The fill is the hold's own clock: it runs under Reduce Motion too, as a fade.
        reduceMotion: ReduceMotion.Never,
      }),
    );
    timer.current = setTimeout(() => {
      timer.current = null;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      props.onHeld();
    }, HOLD_MS);
  };
  const up = () => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    cancelAnimation(fill);
    fill.set(withTiming(0, { duration: 160, reduceMotion: ReduceMotion.Never }));
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A card taken off the screen mid-hold must not confirm: its timer goes with it.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );
  const can = canDestroy(act);
  const name = named(act);
  return (
    <View className="gap-1.5 px-4 py-3">
      <AppText accessibilityRole="header" className="font-t3-bold text-base text-foreground">
        {holdLine(act)}
      </AppText>
      <AppText className="text-sm text-foreground-secondary">{HOLD_HEARD(act.words)}</AppText>
      {status !== "waiting" ? (
        <AppText className="text-sm text-foreground-muted">{STATUS_WORDS[status]}</AppText>
      ) : !can ? (
        <>
          <AppText className="text-sm text-foreground-muted">{HOLD_UNKNOWN}</AppText>
          <View className="flex-row justify-end pt-1">
            <Pill filled={false} title={DROP} onPress={props.onDrop} />
          </View>
        </>
      ) : (
        <>
          <AppText className="text-sm text-foreground-muted">{holdStays(act)}</AppText>
          {props.refused !== null ? (
            <AppText className="text-sm text-danger-foreground">{props.refused}</AppText>
          ) : null}
          <View className="flex-row items-center gap-2 pt-1.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${HOLD_PRESS}: ${name}`}
              accessibilityHint={holdLine(act)}
              onPressIn={down}
              onPressOut={up}
              // A long hold must not be cancelled as a stray press by a small slide of the thumb.
              pressRetentionOffset={24}
              className="min-h-11 flex-1 justify-center overflow-hidden rounded-[14px] border border-border bg-subtle"
            >
              <Animated.View
                pointerEvents="none"
                // The danger ink, thinned: the card tone alone is too dim on a dark screen.
                className="absolute inset-0 bg-danger-foreground/25"
                style={[{ transformOrigin: "left" }, filling]}
              />
              <View className="px-3.5 py-2">
                <AppText className="font-t3-bold text-sm text-foreground" numberOfLines={2}>
                  {name}
                </AppText>
                <AppText className="text-xs text-foreground-muted">{HOLD_PRESS}</AppText>
              </View>
            </Pressable>
            <Pill filled={false} title={DROP} onPress={props.onDrop} />
          </View>
        </>
      )}
    </View>
  );
}
