// A feat's moment on the phone, as the Mac's card (`apps/web/src/stemcells/collection/
// FeatCard.tsx`): near the bottom, it names the feat, the Cell whose fact did it and what it
// unlocked, with one button to wear it and a way to the collection. It takes no focus and leaves
// on its own, on a swipe aside, or by its close button.

import * as Haptics from "expo-haptics";
import { useEffect, useEffectEvent, useLayoutEffect } from "react";
import { AccessibilityInfo, Platform, Pressable, View, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useKeyboardState } from "react-native-keyboard-controller";
import Animated, {
  cancelAnimation,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";

import { cellNameOf, clockSeconds, moment } from "../cell/kit";
import type { NeedsConnection } from "../line/read";
import { Button, openCollection } from "../upstream/collection";
import { AppText, SymbolView } from "../upstream/disk";
import { useCellDriver, useLookOf } from "./CellMini";
import { CellStill } from "./CellStill";
import { HUES } from "./hues";
import {
  COLLECTION,
  featName,
  featSaid,
  RARITY_NAMES,
  type Standing,
  toggled,
  wornIdOf,
} from "./kit";
import { markSeen, wear } from "./read";

/** How long the card stays when nothing sends it away, in ms. */
const STAYS = 14_000;
/** The bottom bar or a chat's composer, which the card stands over (upstream's dictation pill alike). */
const BOTTOM_CHROME = 64;
/** A Cell with no chat: a feat no single Cell did. */
const STAND_IN = "collection";

const FLOATS = {
  shadowColor: "#000000",
  shadowOpacity: 0.3,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 8,
} satisfies ViewStyle;

const SWIPE = { duration: 160, reduceMotion: ReduceMotion.System };
const ARRIVES = FadeInDown.duration(200).reduceMotion(ReduceMotion.System);
const LEAVES = FadeOut.duration(150).reduceMotion(ReduceMotion.System);

export function FeatMoment(props: {
  readonly environmentId: string;
  readonly connection: NeedsConnection | null;
  readonly standing: Standing;
  /** What the Cell that did it wears by the person's choice. */
  readonly worn: readonly string[];
  /** The rung above the one earned, put in view at once; null at a ladder's top. */
  readonly next: Standing | null;
  readonly onDone: () => void;
}) {
  const card = <Card {...props} />;
  // Over a sheet too, as upstream's dictation pill is.
  return Platform.OS === "ios" ? <FullWindowOverlay>{card}</FullWindowOverlay> : card;
}

function Card(props: Parameters<typeof FeatMoment>[0]) {
  const { environmentId, connection, onDone } = props;
  const { feat, state } = props.standing;
  const threadId = state.earned?.threadId ?? null;
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardState((each) => each.height);
  const reduced = useReducedMotion();
  const driver = useCellDriver(environmentId, threadId);
  const own = useLookOf(threadId ?? STAND_IN);

  const arrived = useEffectEvent(() => {
    if (connection !== null) markSeen(environmentId, connection, [feat.id]);
    if (threadId !== null && !reduced) moment(threadId, "feat", clockSeconds());
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AccessibilityInfo.announceForAccessibility(`${COLLECTION.earned}: ${featName(feat)}`);
  });
  const stayed = useEffectEvent(() => onDone());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The card is shown: note the feat as seen on its machine, let the Cell that earned it mark the moment and tick, once; then leave after its stay, clearing the timer.
  useEffect(() => {
    arrived();
    const leave = setTimeout(() => stayed(), STAYS);
    return () => clearTimeout(leave);
  }, []);

  const aside = useSharedValue(0);
  const width = useSharedValue(0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Cancel the swipe's animation when the card leaves.
  useLayoutEffect(() => () => cancelAnimation(aside), [aside]);
  // A swipe to either side sends it away, as it does T3's own notices (`components/ui/Toast.tsx`).
  const swipe = usePanGesture({
    activeOffsetX: [-10, 10],
    failOffsetY: [-12, 12],
    onUpdate: (event) => {
      aside.set(event.translationX);
    },
    onDeactivate: (event) => {
      const thrown = Math.abs(event.velocityX) > 800 && event.translationX * event.velocityX > 0;
      if (!event.canceled && (Math.abs(event.translationX) > width.value * 0.25 || thrown)) {
        const direction = Math.sign(event.translationX || event.velocityX);
        aside.set(
          withTiming(direction * (width.value + 24), SWIPE, (finished) => {
            if (finished) runOnJS(onDone)();
          }),
        );
      } else {
        aside.set(withTiming(0, SWIPE));
      }
    },
  });
  const swiped = useAnimatedStyle(() => ({ transform: [{ translateX: aside.value }] }));

  const wornId = wornIdOf(feat.reward);
  const name = threadId === null ? null : cellNameOf(threadId);
  const look = threadId === null ? [] : own;
  const wearing = wornId !== undefined && props.worn.includes(wornId);
  const hue = HUES[feat.rarity];
  return (
    <View pointerEvents="box-none" className="absolute inset-0 items-center justify-end">
      <Animated.View
        entering={ARRIVES}
        exiting={LEAVES}
        pointerEvents="box-none"
        className="w-full max-w-[440px] px-3"
        style={{ paddingBottom: Math.max(insets.bottom, keyboard, 12) + BOTTOM_CHROME }}
        onLayout={(event) => width.set(event.nativeEvent.layout.width)}
        onAccessibilityEscape={onDone}
      >
        <GestureDetector gesture={swipe}>
          <Animated.View collapsable={false} style={[FLOATS, swiped]}>
            <View
              accessibilityLabel={COLLECTION.earned}
              className="flex-row gap-3 overflow-hidden rounded-2xl border border-border bg-grouped-card py-3 pl-4 pr-1"
            >
              <View className={`absolute inset-y-0 left-0 w-[3px] ${hue.fill}`} />
              <View className="w-14 items-center justify-center">
                <CellStill
                  name={threadId ?? STAND_IN}
                  look={wornId === undefined ? look : [wornId, ...look]}
                  provider={driver}
                  points={3}
                  scene={feat.reward.kind === "act" ? `act/${feat.reward.id}` : undefined}
                />
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <AppText className={`text-3xs font-t3-bold uppercase tracking-wider ${hue.ink}`}>
                  {COLLECTION.rarityFeat(RARITY_NAMES[feat.rarity])}
                </AppText>
                <AppText className="text-sm font-t3-medium text-foreground">
                  {featName(feat)}
                </AppText>
                <AppText className="text-xs text-foreground-muted">{featSaid(feat, name)}</AppText>
                {props.next === null ? null : (
                  <AppText className="text-xs text-foreground-muted">
                    {COLLECTION.nextRung(featName(props.next.feat))}
                  </AppText>
                )}
                <View className="mt-1.5 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  {wornId !== undefined && threadId !== null && name !== null && !wearing ? (
                    <Button
                      label={COLLECTION.putOn(name)}
                      size="compact"
                      tone="primary"
                      disabled={connection === null}
                      onPress={() => {
                        if (connection === null) return;
                        void wear(environmentId, connection, threadId, toggled(props.worn, wornId));
                        if (!reduced) moment(threadId, "dressed", clockSeconds());
                      }}
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onDone();
                      openCollection();
                    }}
                    className="min-h-11 justify-center active:opacity-70"
                  >
                    <AppText className="text-sm text-primary-text">{COLLECTION.title}</AppText>
                  </Pressable>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={COLLECTION.dismiss}
                onPress={onDone}
                className="-mt-2 size-11 items-center justify-center active:opacity-70"
              >
                <SymbolView
                  name="xmark"
                  size={14}
                  tintColorClassName="accent-icon-muted"
                  type="monochrome"
                />
              </Pressable>
            </View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}
