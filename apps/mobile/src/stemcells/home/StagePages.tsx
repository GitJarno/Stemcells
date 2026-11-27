// The home's stages, a list each, all kept mounted under the stages' pill (`StagePill.tsx`), so
// UIKit's segment slides whole; a tap brings the chosen list in on the UI thread and turns the sky
// (`Sky.tsx`) in the same frame. The title and the sky go up with the list in front (`head.ts`).
// Lists out of sight render nothing new and keep their place.

import { memo, use, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  makeMutable,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnUI } from "react-native-worklets";

import { ScreenVeils } from "../edge/ScreenVeils";
import { useContentTopInset, useDuoBarBottom, useHomeSidebar } from "../upstream/home";
import { SKY_AT, skyAtStage } from "../line/kit";
import { CopyLayer } from "./CopyLayer";
import { head } from "./head";
import {
  enteringX,
  headShown,
  HomeCellsHeld,
  HomeInFront,
  HomeStageContext,
  PILL_HEIGHT,
  STAGE_ROOM,
  StagePageContext,
} from "./state";
import { usePillStays } from "./pillPlace";
import { Sky } from "./Sky";
import { StagePill } from "./StagePill";
import { turnSky } from "./useSky";

/** As UIKit's segment slides: one short ease-out, whatever the distance. */
const SWITCH = { duration: 200, easing: Easing.out(Easing.cubic) };
/** How far a list comes in from the side it lies on, points. */
const SHIFT = 20;

interface Page {
  readonly opacity: SharedValue<number>;
  /** How far it stands aside as it comes in, points. */
  readonly x: SharedValue<number>;
  /** How far its list carries the title up. */
  readonly lift: SharedValue<number>;
}

/** The title's glide on a switch: from where it stood (`from`) to the list in front's, by `t`. */
interface Glide {
  readonly from: SharedValue<number>;
  readonly t: SharedValue<number>;
}

/** Turns the home to the stage at `next`, on the UI thread. */
function turn(
  pages: ReadonlyArray<Page>,
  front: SharedValue<number>,
  glide: Glide,
  next: number,
  still: boolean,
) {
  "worklet";
  const from = front.get();
  if (from === next || pages[next] === undefined) return;
  front.set(next);
  glide.from.set(head.lift.get());
  glide.t.set(still ? 1 : 0);
  if (!still) glide.t.set(withTiming(1, SWITCH));
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
export function useStagePages<Stage extends string>(stages: readonly Stage[], opening: Stage) {
  const [pages] = useState(() =>
    stages.map((stage): Page => ({
      opacity: makeMutable(stage === opening ? 1 : 0),
      x: makeMutable(0),
      lift: makeMutable(0),
    })),
  );
  const front = useSharedValue(stages.indexOf(opening));
  const from = useSharedValue(0);
  const t = useSharedValue(1);
  const reduced = useReducedMotion();
  return useMemo(() => {
    const glide = { from, t };
    return {
      stages,
      pages,
      front,
      glide,
      /** Called in the tap's own frame, before React renders the chosen stage; `still` at once. */
      show: (stage: Stage, still = reduced) => {
        // The sky turns whichever way the list does: the first home to show takes it as it stands.
        turnSky(skyAtStage(stage), reduced);
        scheduleOnUI(turn, pages, front, glide, stages.indexOf(stage), still);
      },
    };
  }, [stages, pages, front, from, t, reduced]);
}

export function StagePages<Stage extends string>(props: {
  readonly home: ReturnType<typeof useStagePages<Stage>>;
  readonly tab: Stage;
  readonly render: (stage: Stage) => ReactNode;
}) {
  const { home, tab } = props;
  const sidebar = useHomeSidebar();
  const barBottom = useDuoBarBottom();
  const pillStays = usePillStays();
  const inFront = use(HomeInFront);
  const held = use(HomeCellsHeld);
  // Where a list rests: under the inset T3's list rests under, at the native header's foot.
  const inset = useContentTopInset();
  // The bar's row, under the status bar or the Duo's camera band: the title fades out across it.
  const bar = inset - useSafeAreaInsets().top;
  const { pages, front, glide } = home;
  useAnimatedReaction(
    () => {
      const live = pages[front.get()]?.lift.get() ?? 0;
      return glide.from.get() + (live - glide.from.get()) * glide.t.get();
    },
    (lift) => {
      head.lift.set(lift);
      head.shown.set(headShown(lift, bar));
    },
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A home leaving the screen leaves the title at rest for the header's next screen.
  useEffect(
    () => () => {
      head.lift.set(0);
      head.shown.set(1);
    },
    [],
  );
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
  return (
    <View className={sidebar ? "flex-1 bg-drawer" : "flex-1 bg-screen"}>
      {home.stages.map((stage, index) => {
        const active = stage === tab;
        return (
          <Stage
            key={stage}
            stage={stage}
            page={home.pages[index]!}
            active={active}
            mounted={active || warm}
            inset={inset}
            inFront={inFront && active}
            held={held || !active}
          >
            {props.render(stage)}
          </Stage>
        );
      })}
      {/* One top edge in every posture; the sidebar's foot is the split's own. */}
      <ScreenVeils
        bottom={!sidebar}
        barBottom={barBottom}
        chromeBottom={pillStays ? inset + STAGE_ROOM + PILL_HEIGHT : undefined}
      />
      <Sky night={skyAtStage(tab) === SKY_AT.night} />
      <StagePill top={inset} />
      <CopyLayer shown={inFront} />
    </View>
  );
}

function Stage(props: {
  readonly stage: string;
  readonly page: Page;
  readonly active: boolean;
  readonly mounted: boolean;
  readonly inset: number;
  readonly inFront: boolean;
  readonly held: boolean;
  readonly children: ReactNode;
}) {
  const { page, active, inset } = props;
  const value = useMemo(() => ({ active, inset, lift: page.lift }), [active, inset, page]);
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
