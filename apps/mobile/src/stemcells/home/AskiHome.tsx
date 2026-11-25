// Aski over the home's tabs, drawn once over every stage's list (`StagePages.tsx`), its touches
// taken in each list's room (`HeaderSpace`). Night falls on Settled (`useNight.ts`). Its height
// never changes with what's going on, so the tabs and lists stand still: what comes and goes takes
// room reserved for it (its line) or floats over the list (`DiskFoot`, `UndoLine`).

import * as Haptics from "expo-haptics";
import { use, useState, useSyncExternalStore } from "react";
import {
  Dimensions,
  type LayoutRectangle,
  PixelRatio,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  makeMutable,
  runOnJS,
  useReducedMotion,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { useBatteryLine } from "../battery/useBatteries";
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
import { drawnX, HomeTabsContext, stageAfterSwipe, StagePageContext, stageToward } from "./state";
import type { TabCounts } from "./tabs";
import { noticing, useNight } from "./useNight";

/**
 * A window at least this tall stands Aski over its line; a shorter one (the folded Duo, a window
 * held sideways) sets it beside, so the list keeps its room.
 */
const ROOMY_FROM = 760;
/** Aski's height, points, and the room over it, standing over its line and beside it. */
const TALL = { aski: 92, over: 14 } as const;
const SHORT = { aski: 60, over: 10 } as const;
const widthOf = (height: number) => (VIEW.width / VIEW.height) * height;
/** How far the night reaches over the header: the status bar, and a pull past the top. */
const NIGHT_ABOVE = 600;
/** Aski's line takes two lines' room, however few it says, as `text-xl` sets them. */
const LINE_ROOM = 2 * 28;
const LINE_ROOM_FILLER = "M\nM";
/** The rest of the header, as its classes and T3's segments set it. */
const OVER_LINE = 12;
const UNDER_LINE = 20 + 36 + 16;
const UNDER_ROW = 16 + 36 + 16;
/** The header's height before it's measured, so a list's first frame stands where it will stay. */
const HEIGHT_BEFORE_MEASURED =
  Dimensions.get("window").height < ROOMY_FROM
    ? SHORT.over + Math.max(SHORT.aski, LINE_ROOM * PixelRatio.getFontScale()) + UNDER_ROW
    : TALL.over + TALL.aski + OVER_LINE + LINE_ROOM * PixelRatio.getFontScale() + UNDER_LINE;

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
let room: Room = { height: HEIGHT_BEFORE_MEASURED, aski: null, line: null };
/** The header's height, for the switch on the UI thread: past it, the header is out of sight. */
export const headerHeight = makeMutable(HEIGHT_BEFORE_MEASURED);
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
function changed() {
  for (const listener of listeners) listener();
}

type Origin = { readonly x: number; readonly y: number };
const ORIGIN: Origin = { x: 0, y: 0 };
/** Aski and its line as each measured itself, in the row that holds them beside each other. */
let parts: { row: Origin; aski: LayoutRectangle | null; line: LayoutRectangle | null } = {
  row: ORIGIN,
  aski: null,
  line: null,
};
const inHeader = (part: LayoutRectangle | null, row: Origin) =>
  part === null ? null : { ...part, x: part.x + row.x, y: part.y + row.y };
function measured(part: {
  readonly height?: number;
  readonly row?: Origin;
  readonly aski?: LayoutRectangle;
  readonly line?: LayoutRectangle;
}) {
  const { height, ...placed } = part;
  parts = { ...parts, ...placed };
  room = {
    height: height ?? room.height,
    aski: inHeader(parts.aski, parts.row),
    line: inHeader(parts.line, parts.row),
  };
  if (height !== undefined) headerHeight.set(height);
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

/** What Aski says: `plain` when it's what a machine's battery needs of you, which no tap rolls. */
function useLine(counts: TabCounts): { readonly line: string; readonly plain: boolean } {
  const rolls = useSyncExternalStore(subscribe, () => kept.rolls);
  const battery = useBatteryLine();
  return battery !== null
    ? { line: battery, plain: true }
    : { line: greetingAt(counts, rolls, kept.seed), plain: false };
}

/** The header, drawn once over the lists: Aski, its line and the tabs. */
export function AskiHome() {
  const home = use(HomeTabsContext);
  const primaryColumn = use(NativePrimaryColumnContext);
  const insets = useSafeAreaInsets();
  const short = useWindowDimensions().height < ROOMY_FROM;
  // A home shown again an hour on opens on another line.
  useState(() => {
    if (kept.seed !== seedNow()) Object.assign(kept, { seed: seedNow(), rolls: 0 });
  });
  const copies = useCopies();
  const ink = useResolveClassNames("text-foreground").color;
  const screen = useResolveClassNames(primaryColumn ? "bg-drawer" : "bg-screen").backgroundColor;
  const dusk = useNight(home === null ? null : home.night);
  const { height, aski: askiAt } = useHeaderRoom();
  const { line } = useLine(home?.counts ?? { input: 0, working: 0, active: 0, asleep: 0 });
  if (home === null) return null;
  const { counts } = home;
  const size = short ? SHORT : TALL;
  const eyesAt = (askiAt?.y ?? size.over) + ((EYE_LINE - VIEW.y) / VIEW.height) * size.aski;
  const skyAtEyes = skyAt(height > 0 ? eyesAt / height : 0);
  // While its copies fly, and once every Cell has landed with none waiting.
  const pleased =
    copies.length > 0 || (counts.input === 0 && counts.working === 0 && counts.active > 0);
  const mood = pleased ? "pleased" : undefined;
  const figure = (
    <View
      ref={askiStandsIn}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: widthOf(size.aski), height: size.aski }}
      onLayout={({ nativeEvent }) =>
        measured(short ? { aski: nativeEvent.layout } : { aski: nativeEvent.layout, row: ORIGIN })
      }
    >
      {dusk === "night" ? null : (
        <AskiFigure height={size.aski} ink={ink} ground={screen} mood={mood} />
      )}
      {dusk === "day" ? null : (
        <AtNight style={StyleSheet.absoluteFill}>
          <AskiFigure
            height={size.aski}
            ink={NIGHT_INK}
            ground={skyAtEyes}
            mood={mood}
            shut={noticing}
          />
        </AtNight>
      )}
    </View>
  );
  const said = (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={short ? "min-w-0 flex-1" : "mt-3 self-stretch px-10"}
      onLayout={({ nativeEvent }) =>
        measured(short ? { line: nativeEvent.layout } : { line: nativeEvent.layout, row: ORIGIN })
      }
    >
      <Line line={line} dusk={dusk} short={short} />
    </View>
  );
  return (
    <View
      className={short ? "pb-4" : "items-center pb-4"}
      pointerEvents="box-none"
      style={{ paddingTop: size.over }}
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
      {short ? (
        <View
          pointerEvents="box-none"
          className="flex-row items-center gap-3 px-5"
          onLayout={({ nativeEvent }) => measured({ row: nativeEvent.layout })}
        >
          {figure}
          {said}
        </View>
      ) : (
        <>
          {figure}
          {said}
        </>
      )}
      <View className={short ? "mt-4 px-4" : "mt-5 self-stretch px-4"}>
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
    </View>
  );
}

/** Aski's line in its room of two lines, at night in the night's ink. */
function Line(props: {
  readonly line: string;
  readonly dusk: ReturnType<typeof useNight>;
  readonly short: boolean;
}) {
  const { line, dusk } = props;
  const type = props.short ? "text-left text-lg" : "text-center text-xl";
  return (
    <>
      {/* Sets the room at whatever text size the person reads, unseen. */}
      <AppText className={`${type} opacity-0`} numberOfLines={2}>
        {LINE_ROOM_FILLER}
      </AppText>
      <View
        className={
          props.short
            ? "absolute inset-0 justify-center"
            : "absolute inset-x-10 inset-y-0 justify-center"
        }
      >
        <LayoutAnimationConfig skipEntering>
          <Animated.View key={line} entering={FadeIn.duration(220)}>
            <AppText
              className={type}
              style={dusk === "night" ? { color: NIGHT_TEXT } : undefined}
              numberOfLines={2}
            >
              {line}
            </AppText>
            {dusk === "turning" ? (
              <AtNight style={StyleSheet.absoluteFill}>
                <AppText className={type} style={{ color: NIGHT_TEXT }} numberOfLines={2}>
                  {line}
                </AppText>
              </AtNight>
            ) : null}
          </Animated.View>
        </LayoutAnimationConfig>
      </View>
    </>
  );
}

/**
 * The header's room at the top of a stage's list, where Aski and its line take their taps, and
 * a sideways swipe turns the stage (`stageAfterSwipe`), the list drawn along under the finger.
 */
export function HeaderSpace() {
  const page = use(StagePageContext);
  const home = use(HomeTabsContext);
  const aski = useAskiChat(home?.environmentId ?? null);
  const openChat = useHomeThreadSelection();
  const reduced = useReducedMotion();
  const { height, aski: askiAt, line: lineAt } = useHeaderRoom();
  const { line, plain } = useLine(home?.counts ?? { input: 0, working: 0, active: 0, asleep: 0 });
  const stages = home?.options.map((option) => option.id) ?? [];
  const tab = home?.tab ?? "";
  const x = page?.x ?? null;
  const turnTo = (stage: string) => {
    void Haptics.selectionAsync();
    home?.choose(stage);
  };
  const swipe = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onUpdate: (event) => {
      if (reduced || x === null) return;
      x.set(drawnX(event.translationX, stageToward(stages, tab, event.translationX) !== null));
    },
    onDeactivate: (event) => {
      const next = event.canceled
        ? null
        : stageAfterSwipe(stages, tab, event.translationX, event.velocityX);
      if (next !== null) runOnJS(turnTo)(next);
      else x?.set(withSpring(0, SPRING_BACK));
    },
  });
  if (page === null || home === null) return null;
  return (
    <GestureDetector gesture={swipe}>
      <View style={{ height }}>
        {askiAt === null ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aski"
            accessibilityHint="Opens Aski's chat"
            disabled={aski === null}
            onPress={() => aski !== null && openChat(aski)}
            hitSlop={8}
            style={placeOf(askiAt)}
          />
        )}
        {lineAt === null ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={line}
            accessibilityHint="Shows another line"
            // What waits on you is said plainly, and only that.
            disabled={home.counts.input > 0 || plain}
            onPress={roll}
            style={placeOf(lineAt)}
          />
        )}
      </View>
    </GestureDetector>
  );
}

/** A list let go short of a turn settles back on the web's settle spring (`--sc-motion-settle-*`). */
const SPRING_BACK = { duration: 300, dampingRatio: 0.85 } as const;

/** A part's place in the room, where it stands in the header. */
const placeOf = (part: LayoutRectangle) =>
  ({
    position: "absolute",
    left: part.x,
    top: part.y,
    width: part.width,
    height: part.height,
  }) as const;
