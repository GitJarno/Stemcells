// Only your own act hops (stemcells/tasks/phone-line.md, decision 5): a Cell you answered,
// settled or brought back hops along the line, from its old segment to its new one, whose
// count ticks up. Moves you didn't make only change the numbers; with Reduce Motion it just
// leaves. One arc each, then nothing runs. A layer over the home that no touch meets.

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { ThreadCell } from "../cell/ThreadCell";
import type { EnvironmentThreadShell } from "../upstream/cells";
import { hopsOf, type LineStage, type Standings, takeMovedByHand } from "./kit";
import { SEGMENTS } from "./line";

/** The web's `travel` token. */
const HOP_MS = 480;
/** More Cells than this moving at once hop the first few; the rest just arrive. */
const MOST_AT_ONCE = 4;
const STAGGER_MS = 70;
/** How far above the segments a hop's arc rises. */
const RISE = 22;
/** The segmented control's inset in the box that holds it (`AskiHome.tsx`). */
const INSET = 16;
/** A hopping Cell's points per pixel of its miniature: 13 × 14 cells. */
const POINTS = 2;

let segments: ViewInstance | null = null;

/** Where the line's segments stand on the home, while they do. */
export function segmentsStandIn(view: ViewInstance | null): void {
  segments = view;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const measured = (view: ViewInstance | null) =>
  new Promise<Box | null>((resolve) => {
    if (view === null) return resolve(null);
    view.measureInWindow((x, y, width, height) =>
      resolve(width > 0 ? { x, y, width, height } : null),
    );
  });

/** The middle of `stage`'s segment, in the window. */
function middleOf(box: Box, stage: LineStage) {
  const width = (box.width - 2 * INSET) / SEGMENTS.length;
  const index = SEGMENTS.findIndex((segment) => segment.id === stage);
  return { x: box.x + INSET + width * (index + 0.5), y: box.y + box.height / 2 };
}

interface Flight {
  readonly key: string;
  readonly cell: EnvironmentThreadShell;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly delay: number;
}

let flown = 0;

export function Hops(props: {
  readonly standings: Standings;
  readonly cellOf: (threadId: string) => EnvironmentThreadShell | undefined;
}) {
  const before = useRef<Standings | null>(null);
  const layer = useRef<ViewInstance>(null);
  const reduced = useReducedMotion();
  const [flights, setFlights] = useState<ReadonlyArray<Flight>>([]);
  const { standings, cellOf } = props;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Launch a hop for each Cell the person moved whose segment changed since the last draw.
  useEffect(() => {
    const previous = before.current;
    before.current = standings;
    // The first reading has nothing to move from.
    if (previous === null || previous.size === 0 || reduced) return;
    const hops = hopsOf(previous, standings, (threadId) => takeMovedByHand(threadId)).slice(
      0,
      MOST_AT_ONCE,
    );
    if (hops.length === 0) return;
    void Promise.all([measured(segments), measured(layer.current)]).then(([box, origin]) => {
      // Scrolled away, or the home behind a chat: the counts just change.
      if (box === null || origin === null || box.y + box.height < 0) return;
      const launched = hops.flatMap((hop, index): Flight[] => {
        const cell = cellOf(hop.threadId);
        if (cell === undefined) return [];
        flown += 1;
        const at = (stage: LineStage) => {
          const middle = middleOf(box, stage);
          return { x: middle.x - origin.x, y: middle.y - origin.y };
        };
        return [
          {
            key: `${hop.threadId}:${flown}`,
            cell,
            from: at(hop.from),
            to: at(hop.to),
            delay: index * STAGGER_MS,
          },
        ];
      });
      if (launched.length > 0) setFlights((current) => [...current, ...launched]);
    });
  }, [standings, cellOf, reduced]);

  return (
    <View ref={layer} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flights.map((flight) => (
        <HopFlight
          key={flight.key}
          flight={flight}
          onLanded={() =>
            setFlights((current) => current.filter((each) => each.key !== flight.key))
          }
        />
      ))}
    </View>
  );
}

function HopFlight(props: { readonly flight: Flight; readonly onLanded: () => void }) {
  const { flight } = props;
  const progress = useSharedValue(0);
  // The list draws again while a Cell is in the air; its arc runs once, whatever the list does.
  const land = useEffectEvent(props.onLanded);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Run the hop's one arc and drop it once it lands.
  useEffect(() => {
    progress.set(
      withDelay(
        flight.delay,
        withTiming(1, { duration: HOP_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
          if (finished) runOnJS(land)();
        }),
      ),
    );
  }, [flight, progress]);
  const { from, to } = flight;
  const half = (13 * POINTS) / 2;
  const peak = Math.min(from.y, to.y) - RISE;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    // A parabola through the start, the peak at its middle, and the end.
    const y =
      (1 - p) * (1 - p) * from.y +
      2 * p * (1 - p) * (2 * peak - (from.y + to.y) / 2) +
      p * p * to.y;
    return {
      opacity: p === 0 ? 0 : p < 0.85 ? 1 : (1 - p) / 0.15,
      transform: [
        { translateX: from.x + (to.x - from.x) * p - half },
        { translateY: y - half },
        { scale: 1 + 0.15 * Math.sin(Math.PI * p) },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, style]}>
      <ThreadCell thread={flight.cell} points={POINTS} />
    </Animated.View>
  );
}
