// The home's header, drawn once over every stage's list (`StagePages.tsx`): the stages, its
// touches taken in each list's room (`HeaderSpace`). Its height never changes, so the lists stand
// still: what comes and goes floats over them (`DiskFoot`, `UndoLine`). Aski moved to its button.

import * as Haptics from "expo-haptics";
import { use, useSyncExternalStore } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { makeMutable, runOnJS, useReducedMotion, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { NativePrimaryColumnContext, SegmentedControl } from "../upstream/home";
import { Night } from "./Night";
import { drawnX, HomeTabsContext, stageAfterSwipe, StagePageContext, stageToward } from "./state";
import { useNight } from "./useNight";

/** The room over the stages, the stages as T3's segments set them, and the room under. */
const OVER = 12;
const SEGMENTS = 36;
const UNDER = 16;
/** The header's height before it's measured, so a list's first frame stands where it will stay. */
const HEIGHT_BEFORE_MEASURED = OVER + SEGMENTS + UNDER;
/** How far the night reaches over the header: the status bar, and a pull past the top. */
const NIGHT_ABOVE = 600;

let height = HEIGHT_BEFORE_MEASURED;
/** The header's height, for the switch on the UI thread: past it, the header is out of sight. */
export const headerHeight = makeMutable(HEIGHT_BEFORE_MEASURED);
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
function measured(next: number) {
  height = next;
  headerHeight.set(next);
  for (const listener of listeners) listener();
}

/** The header's height, for each list's room. */
export function useHeaderRoom(): { readonly height: number } {
  return { height: useSyncExternalStore(subscribe, () => height) };
}

/** The header, drawn once over the lists: the stages. */
export function AskiHome() {
  const home = use(HomeTabsContext);
  const primaryColumn = use(NativePrimaryColumnContext);
  const insets = useSafeAreaInsets();
  const screen = useResolveClassNames(primaryColumn ? "bg-drawer" : "bg-screen").backgroundColor;
  const dusk = useNight(home === null ? null : home.night);
  const { height: measuredHeight } = useHeaderRoom();
  if (home === null) return null;
  return (
    <View
      className="px-4"
      pointerEvents="box-none"
      style={{ paddingTop: OVER, paddingBottom: UNDER }}
      onLayout={({ nativeEvent }) => measured(nativeEvent.layout.height)}
    >
      {dusk === "day" ? null : (
        <Night
          above={NIGHT_ABOVE + insets.top}
          screen={screen}
          height={measuredHeight}
          shooting={home.night}
        />
      )}
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
  );
}

/**
 * The header's room at the top of a stage's list: a sideways swipe turns the stage
 * (`stageAfterSwipe`), the list drawn along under the finger.
 */
export function HeaderSpace() {
  const page = use(StagePageContext);
  const home = use(HomeTabsContext);
  const reduced = useReducedMotion();
  const { height: room } = useHeaderRoom();
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
      <View style={{ height: room }} />
    </GestureDetector>
  );
}

/** A list let go short of a turn settles back on the web's settle spring (`--sc-motion-settle-*`). */
const SPRING_BACK = { duration: 300, dampingRatio: 0.85 } as const;
