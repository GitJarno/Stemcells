// The home's stages, a list each, kept mounted under one header (`AskiHome.tsx`) that never mounts
// again, so UIKit's segment slides whole; a tap brings the chosen list in on the UI thread. The
// header stands where the front list's own offset puts its room, and on nothing else, so it can't
// drift from the list. Lists out of sight render nothing new and keep their place.

import { memo, use, useLayoutEffect, useMemo, useState, type ReactNode, type Ref } from "react";
import { type ScrollViewInstance, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  scrollTo,
  type SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useEvent,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnUI } from "react-native-worklets";

import { ScreenVeils } from "../edge/ScreenVeils";
import { NativePrimaryColumnContext } from "../upstream/home";
import { AskiHome, headerHeight, useHeaderRoom } from "./AskiHome";
import { CopyLayer } from "./CopyLayer";
import {
  carriedOffset,
  enteringX,
  HomeCellsHeld,
  HomeInFront,
  HomeStageContext,
  type StagePage,
  StagePageContext,
} from "./state";

/** As UIKit's segment slides: one short ease-out, whatever the distance. */
const SWITCH = { duration: 200, easing: Easing.out(Easing.cubic) };
/** How far a list comes in from the side it lies on, points. */
const SHIFT = 20;

type Page = Omit<StagePage, "active" | "minHeight"> & {
  readonly opacity: SharedValue<number>;
  readonly x: SharedValue<number>;
};

function usePage(shown: boolean, top: number): Page {
  const ref = useAnimatedRef();
  const offset = useSharedValue(top);
  const opacity = useSharedValue(shown ? 1 : 0);
  const x = useSharedValue(0);
  return useMemo(() => ({ ref, offset, opacity, x }), [ref, offset, opacity, x]);
}

/** Turns the home to the stage at `next`, on the UI thread. */
function turn(
  pages: ReadonlyArray<Page>,
  front: SharedValue<number>,
  next: number,
  still: boolean,
  top: number,
) {
  "worklet";
  const from = front.get();
  const to = pages[next];
  if (from === next || to === undefined) return;
  const leaving = pages[from];
  if (leaving !== undefined) {
    const at = carriedOffset(leaving.offset.get(), to.offset.get(), top, headerHeight.get());
    to.offset.set(at);
    scrollTo(to.ref, 0, at, false);
  }
  front.set(next);
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]!;
    const shows = index === next;
    if (still) {
      page.opacity.set(shows ? 1 : 0);
      page.x.set(0);
      continue;
    }
    if (shows) page.x.set(enteringX(page.opacity.get(), page.x.get(), from, next, SHIFT));
    page.opacity.set(withTiming(shows ? 1 : 0, SWITCH));
    if (shows) page.x.set(withTiming(0, SWITCH));
  }
}

/** The stages' pages, in the segments' order, and a turn to one of them from a tap. */
export function useStagePages<Stage extends string>(
  stages: readonly [Stage, Stage, Stage, Stage],
  opening: Stage,
) {
  const at = stages.indexOf(opening);
  // Where a list rests under UIKit's inset, as T3's list takes it (`contentInsetStartAdjustment`).
  const top = -useSafeAreaInsets().top;
  const a = usePage(at === 0, top);
  const b = usePage(at === 1, top);
  const c = usePage(at === 2, top);
  const d = usePage(at === 3, top);
  const front = useSharedValue(at);
  const reduced = useReducedMotion();
  return useMemo(() => {
    const pages = [a, b, c, d];
    return {
      stages,
      pages,
      front,
      top,
      /** Called in the tap's own frame, before React renders the chosen stage; `still` at once. */
      show: (stage: Stage, still = reduced) =>
        scheduleOnUI(turn, pages, front, stages.indexOf(stage), still, top),
    };
  }, [stages, a, b, c, d, front, reduced, top]);
}

export function StagePages<Stage extends string>(props: {
  readonly home: ReturnType<typeof useStagePages<Stage>>;
  readonly tab: Stage;
  readonly night: boolean;
  readonly render: (stage: Stage) => ReactNode;
}) {
  const { home, tab } = props;
  const insets = useSafeAreaInsets();
  const primaryColumn = use(NativePrimaryColumnContext);
  const inFront = use(HomeInFront);
  const held = use(HomeCellsHeld);
  const { height } = useHeaderRoom();
  const [viewport, setViewport] = useState(0);
  // The rest mount once the first has shown, so a switch only ever shows a list.
  const [warm, setWarm] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Follow a stage chosen without a tap (where the home opens) at once; a tap has turned already.
  useLayoutEffect(() => {
    home.show(tab, true);
  }, [home, tab]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Mount the other stages' lists once the first has drawn its first frame.
  useLayoutEffect(() => {
    if (warm) return;
    const frame = requestAnimationFrame(() => setWarm(true));
    return () => cancelAnimationFrame(frame);
  }, [warm]);
  const header = useAnimatedStyle(() => ({
    transform: [{ translateY: -(home.pages[home.front.get()]?.offset.get() ?? home.top) }],
  }));
  // A list can scroll the header out of sight however short, so the header never has to move.
  const minHeight = viewport + height + home.top;
  return (
    <View
      className={primaryColumn ? "flex-1 bg-drawer" : "flex-1 bg-screen"}
      onLayout={({ nativeEvent }) => setViewport(nativeEvent.layout.height)}
    >
      {home.stages.map((stage, index) => {
        const active = stage === tab;
        const page = home.pages[index]!;
        return (
          <Stage
            key={stage}
            stage={stage}
            page={page}
            active={active}
            mounted={active || warm}
            minHeight={minHeight}
            inFront={inFront && active}
            held={held || !active}
          >
            {props.render(stage)}
          </Stage>
        );
      })}
      <Animated.View
        pointerEvents="box-none"
        style={[{ position: "absolute", left: 0, right: 0, top: 0 }, header]}
      >
        <View
          pointerEvents="box-none"
          style={{ paddingLeft: insets.left, paddingRight: insets.right }}
        >
          <AskiHome />
        </View>
      </Animated.View>
      {primaryColumn ? null : <ScreenVeils night={props.night} bottom />}
      <CopyLayer />
    </View>
  );
}

function Stage(props: {
  readonly stage: string;
  readonly page: Page;
  readonly active: boolean;
  readonly mounted: boolean;
  readonly minHeight: number;
  readonly inFront: boolean;
  readonly held: boolean;
  readonly children: ReactNode;
}) {
  const { page, active, minHeight } = props;
  const value = useMemo(() => ({ ...page, active, minHeight }), [page, active, minHeight]);
  const style = useAnimatedStyle(() => ({
    opacity: page.opacity.get(),
    transform: [{ translateX: page.x.get() }],
  }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <HomeStageContext value={props.stage}>
        <StagePageContext value={value}>
          <HomeInFront value={props.inFront}>
            <HomeCellsHeld value={props.held}>
              <Kept active={active} mounted={props.mounted}>
                {props.children}
              </Kept>
            </HomeCellsHeld>
          </HomeInFront>
        </StagePageContext>
      </HomeStageContext>
    </Animated.View>
  );
}

/** A stage out of sight renders nothing new; it catches up as it is chosen. */
const Kept = memo(
  (props: { readonly active: boolean; readonly mounted: boolean; readonly children: ReactNode }) =>
    props.mounted ? props.children : null,
  (before, after) => !after.active && before.mounted === after.mounted,
);

/** Scroll views mounted into a stage, each stood where its stage stands once. */
const stood = new WeakSet<ScrollViewInstance>();

function handOn(own: Ref<ScrollViewInstance> | undefined, node: ScrollViewInstance | null) {
  if (typeof own === "function") own(node);
  else if (own) own.current = node;
}

/**
 * A stage's scroll view hands its offset to the stage on the UI thread, for the header to follow,
 * and stands where the stage does as it mounts: a list swapped for an empty line keeps Aski put.
 */
export function useStageScrollView(
  page: StagePage | null,
  own: Ref<ScrollViewInstance> | undefined,
) {
  const offset = page?.offset ?? null;
  const handler = useEvent<{ contentOffset: { y: number } }>(
    (event) => {
      "worklet";
      offset?.set(event.contentOffset.y);
    },
    ["onScroll", "onScrollEndDrag", "onMomentumScrollEnd"],
  ) as unknown as {
    workletEventHandler: {
      registerForEvents: (tag: number) => void;
      unregisterFromEvents: (tag: number) => void;
    };
  };
  const ref = page?.ref ?? null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Listen to the native scroll view's scroll on the UI thread, as Reanimated's own useScrollOffset does.
  useLayoutEffect(() => {
    if (ref === null) return;
    return ref.observe((tag) => {
      if (typeof tag !== "number") return;
      handler.workletEventHandler.registerForEvents(tag);
      return () => handler.workletEventHandler.unregisterFromEvents(tag);
    });
  }, [ref, handler]);
  return useMemo(() => {
    if (ref === null) return own;
    return (node: ScrollViewInstance | null) => {
      handOn(own, node);
      if (node === null) return;
      ref?.(node as never);
      if (stood.has(node) || offset === null) return;
      stood.add(node);
      node.scrollTo({ y: offset.get(), animated: false });
    };
  }, [own, ref, offset]);
}
