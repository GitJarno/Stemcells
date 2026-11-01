// Aski over the home's tabs, drawn once over every stage's list (`StagePages.tsx`): a tap on Aski
// opens its chat, on its line rolls another (`greeting.ts`), both taken in each list's room
// (`HeaderSpace`) so a drag there scrolls. Eyes `^ ^` once every Cell has landed or while copies
// fly (`copies.ts`); night falls on Settled (`useNight.ts`); a disk in need shows under the tabs.

import { use, useState, useSyncExternalStore } from "react";
import { type LayoutRectangle, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LayoutAnimationConfig, makeMutable } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { DiskPlates } from "../disk/DiskPlate";
import { EYE_LINE, VIEW } from "../aski/drawing";
import { useAskiChat } from "../aski/useAskiChat";
import { AppText } from "../upstream/cells";
import {
  NativePrimaryColumnContext,
  SegmentedControl,
  useHomeThreadSelection,
} from "../upstream/home";
import { askiStandsIn, useCopies } from "./copies";
import { greetingAt } from "./greeting";
import { AtNight, Night } from "./Night";
import { NIGHT_INK, NIGHT_TEXT, skyAt } from "./sky";
import { HomeTabsContext, StagePageContext } from "./state";
import type { TabCounts } from "./tabs";
import { noticing, useNight } from "./useNight";

/** Aski's height, points, and the room over it. */
const ASKI_HEIGHT = 92;
const ASKI_WIDTH = (VIEW.width / VIEW.height) * ASKI_HEIGHT;
const ROOM_OVER = 14;
/** How far the night reaches over the header: the status bar, and a pull past the top. */
const NIGHT_ABOVE = 600;

/** Where a line starts: it moves on each hour, so the home doesn't always open on the same one. */
const seedNow = () => Math.floor(Date.now() / 3_600_000);

/** The line as the header and its room both read it. */
const kept = { seed: seedNow(), rolls: 0 };

type Room = {
  readonly height: number;
  readonly aski: LayoutRectangle | null;
  readonly line: LayoutRectangle | null;
};
/** The header's height and where Aski and its line stand in it, for each list's room. */
let room: Room = { height: 0, aski: null, line: null };
/** The header's height, for the switch on the UI thread: past it, the header is out of sight. */
export const headerHeight = makeMutable(0);
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
function changed() {
  for (const listener of listeners) listener();
}
function measured(part: Partial<Room>) {
  room = { ...room, ...part };
  if (part.height !== undefined) headerHeight.set(part.height);
  changed();
}
const roll = () => {
  kept.rolls += 1;
  changed();
};

/** The header's height and Aski's and its line's places in it. */
export function useHeaderRoom(): Room {
  return useSyncExternalStore(subscribe, () => room);
}

function useLine(counts: TabCounts): string {
  const rolls = useSyncExternalStore(subscribe, () => kept.rolls);
  return greetingAt(counts, rolls, kept.seed);
}

/** The header, drawn once over the lists: Aski, its line and the tabs. */
export function AskiHome() {
  const home = use(HomeTabsContext);
  const primaryColumn = use(NativePrimaryColumnContext);
  const insets = useSafeAreaInsets();
  // A home shown again an hour on opens on another line.
  useState(() => {
    if (kept.seed !== seedNow()) Object.assign(kept, { seed: seedNow(), rolls: 0 });
  });
  const copies = useCopies();
  const ink = useResolveClassNames("text-foreground").color;
  const screen = useResolveClassNames(primaryColumn ? "bg-drawer" : "bg-screen").backgroundColor;
  const dusk = useNight(home === null ? null : home.night);
  const { height } = useHeaderRoom();
  const line = useLine(home?.counts ?? { input: 0, working: 0, active: 0, asleep: 0 });
  if (home === null) return null;
  const { counts } = home;
  const eyesAt = ROOM_OVER + ((EYE_LINE - VIEW.y) / VIEW.height) * ASKI_HEIGHT;
  const skyAtEyes = skyAt(height > 0 ? eyesAt / height : 0);
  // While its copies fly, and once every Cell has landed with none waiting.
  const pleased =
    copies.length > 0 || (counts.input === 0 && counts.working === 0 && counts.active > 0);
  const mood = pleased ? "pleased" : undefined;
  return (
    <View
      className="items-center pb-4"
      pointerEvents="box-none"
      style={{ paddingTop: ROOM_OVER }}
      onLayout={({ nativeEvent }) => measured({ height: nativeEvent.layout.height })}
    >
      {dusk === "day" ? null : (
        <Night
          above={NIGHT_ABOVE + insets.top}
          screen={screen}
          height={height}
          shooting={home.night}
        />
      )}
      {/* Aski and its line take their touches in each list's room. */}
      <View
        ref={askiStandsIn}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: ASKI_WIDTH, height: ASKI_HEIGHT }}
        onLayout={({ nativeEvent }) => measured({ aski: nativeEvent.layout })}
      >
        {dusk === "night" ? null : (
          <AskiFigure height={ASKI_HEIGHT} ink={ink} ground={screen} mood={mood} />
        )}
        {dusk === "day" ? null : (
          <AtNight style={StyleSheet.absoluteFill}>
            <AskiFigure
              height={ASKI_HEIGHT}
              ink={NIGHT_INK}
              ground={skyAtEyes}
              mood={mood}
              shut={noticing}
            />
          </AtNight>
        )}
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="mt-3 self-stretch px-10"
        onLayout={({ nativeEvent }) => measured({ line: nativeEvent.layout })}
      >
        <LayoutAnimationConfig skipEntering>
          <Animated.View key={line} entering={FadeIn.duration(220)}>
            <AppText
              className="text-center text-xl"
              style={dusk === "night" ? { color: NIGHT_TEXT } : undefined}
              numberOfLines={2}
            >
              {line}
            </AppText>
            {dusk === "turning" ? (
              <AtNight style={StyleSheet.absoluteFill}>
                <AppText
                  className="text-center text-xl"
                  style={{ color: NIGHT_TEXT }}
                  numberOfLines={2}
                >
                  {line}
                </AppText>
              </AtNight>
            ) : null}
          </Animated.View>
        </LayoutAnimationConfig>
      </View>
      <View className="mt-5 self-stretch px-4">
        <SegmentedControl
          role="tab"
          options={home.options.map(({ id, label, count }) => ({
            value: id,
            label: count > 0 ? `${label} ${count}` : label,
            accessibilityLabel: `${label}, ${count}`,
          }))}
          selected={home.tab}
          onSelect={home.choose}
        />
      </View>
      <View className="self-stretch">
        <DiskPlates />
      </View>
    </View>
  );
}

/** The header's room at the top of a stage's list, where Aski and its line take their taps. */
export function HeaderSpace() {
  const page = use(StagePageContext);
  const home = use(HomeTabsContext);
  const aski = useAskiChat(home?.environmentId ?? null);
  const openChat = useHomeThreadSelection();
  const { height, aski: askiAt, line: lineAt } = useHeaderRoom();
  const line = useLine(home?.counts ?? { input: 0, working: 0, active: 0, asleep: 0 });
  if (page === null || home === null) return null;
  return (
    <View style={{ height }}>
      {askiAt === null ? null : (
        <View pointerEvents="box-none" style={rowAt(askiAt)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aski"
            accessibilityHint="Opens Aski's chat"
            disabled={aski === null}
            onPress={() => aski !== null && openChat(aski)}
            hitSlop={8}
            style={{ width: askiAt.width, height: askiAt.height }}
          />
        </View>
      )}
      {lineAt === null ? null : (
        <View pointerEvents="box-none" style={rowAt(lineAt)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={line}
            accessibilityHint="Shows another line"
            // What waits on you is said plainly, and only that.
            disabled={home.counts.input > 0}
            onPress={roll}
            style={{ width: lineAt.width, height: lineAt.height }}
          />
        </View>
      )}
    </View>
  );
}

/** A part's row in the room, at its height in the header, the part centred in it as there. */
const rowAt = (part: LayoutRectangle) =>
  ({
    position: "absolute",
    left: 0,
    right: 0,
    top: part.y,
    height: part.height,
    alignItems: "center",
  }) as const;
