// The home's stages, a list each, all kept mounted under the stages' pill at the home's foot
// (`StagePill.tsx`), so UIKit's segment slides whole; a tap brings the chosen list in on the UI
// thread, and turns the header's sky (`Sky.tsx`) in the same frame. Lists out of sight render
// nothing new and keep their place.

import {
  memo,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  makeMutable,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import { ScreenVeils } from "../edge/ScreenVeils";
import { useContentTopInset, useDuoBarBottom, useHomeSidebar } from "../upstream/home";
import { readInboxSky, skyOver, useInboxSky } from "../line/kit";
import { CopyLayer } from "./CopyLayer";
import { enteringX, HomeCellsHeld, HomeInFront, HomeStageContext, StagePageContext } from "./state";
import { Sky } from "./Sky";
import { StagePill } from "./StagePill";
import { riseSky, turnSky } from "./useSky";

/** As UIKit's segment slides: one short ease-out, whatever the distance. */
const SWITCH = { duration: 200, easing: Easing.out(Easing.cubic) };
/** How far a list comes in from the side it lies on, points. */
const SHIFT = 20;

interface Page {
  readonly opacity: SharedValue<number>;
  /** How far it stands aside as it comes in, points. */
  readonly x: SharedValue<number>;
}

/** Turns the home to the stage at `next`, on the UI thread. */
function turn(
  pages: ReadonlyArray<Page>,
  front: SharedValue<number>,
  next: number,
  still: boolean,
) {
  "worklet";
  const from = front.get();
  if (from === next || pages[next] === undefined) return;
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
export function useStagePages<Stage extends string>(stages: readonly Stage[], opening: Stage) {
  const [pages] = useState(() =>
    stages.map((stage): Page => ({
      opacity: makeMutable(stage === opening ? 1 : 0),
      x: makeMutable(0),
    })),
  );
  const front = useSharedValue(stages.indexOf(opening));
  const reduced = useReducedMotion();
  return useMemo(
    () => ({
      stages,
      pages,
      /** Called in the tap's own frame, before React renders the chosen stage; `still` at once. */
      show: (stage: Stage, still = reduced) => {
        // The sky turns whichever way the list does: the first home to show takes it as it stands.
        turnSky(skyOver(stage, readInboxSky()), reduced);
        scheduleOnUI(turn, pages, front, stages.indexOf(stage), still);
      },
    }),
    [stages, pages, front, reduced],
  );
}

export function StagePages<Stage extends string>(props: {
  readonly home: ReturnType<typeof useStagePages<Stage>>;
  readonly tab: Stage;
  readonly render: (stage: Stage) => ReactNode;
}) {
  const { home, tab } = props;
  const sidebar = useHomeSidebar();
  const barBottom = useDuoBarBottom();
  const inFront = use(HomeInFront);
  const held = use(HomeCellsHeld);
  // Where a list rests: under the inset T3's list rests under, at the native header's foot.
  const inset = useContentTopInset();
  // The rest mount once the first has shown, so a switch only ever shows a list.
  const [warm, setWarm] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Follow a stage chosen without a tap (where the home opens) at once; a tap has turned already.
  useLayoutEffect(() => {
    home.show(tab, true);
  }, [home, tab]);
  const inbox = useInboxSky();
  const reduced = useReducedMotion();
  const risen = useRef(inbox.clears);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Turn the UI thread's sky as Input's dawn lifts with each answer, and rise at its all-clear.
  useEffect(() => {
    if (inbox.clears === risen.current) turnSky(skyOver(tab, inbox), reduced);
    else {
      risen.current = inbox.clears;
      riseSky(reduced);
    }
  }, [inbox, tab, reduced]);
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
      {sidebar ? null : <ScreenVeils bottom barBottom={barBottom} />}
      <Sky />
      <StagePill />
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
  const value = useMemo(() => ({ active, inset }), [active, inset]);
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
