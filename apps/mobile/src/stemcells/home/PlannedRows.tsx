// Aski's planned rows at the top of the home's Awake list (stemcells/tasks/aski-orchestrator.md,
// decision 12): each lands where Aski's copy does, its Cell forms, and its line settles. After
// its birth T3's own row stands in: in a sidebar, always in sight, under a copy of ours, so its
// swipe and menu come at once; on a page, once Awake is out of sight.

import { createContext, use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View, type ViewInstance } from "react-native";
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import {
  ARRIVAL_BEAT_MS,
  ARRIVALS,
  chipWords,
  DECODE_STEPS,
  type DecodedPart,
  decodeAt,
} from "../../../../../stemcells/aski/arrivals.ts";
import type { Planned } from "../../../../../stemcells/aski/planned.ts";
import { formingFrom } from "../cell/forming";
import { cellNameOf, clockSeconds } from "../cell/kit";
import { RowLight } from "../glow/RowLight";
import { rowStateOf, rowStatusOf } from "../line/kit";
import { cellKey } from "../line/line";
import { CODE_FONT } from "../tokens";
import { AppText, type EnvironmentThreadShell, threadHasUnseenCompletion } from "../upstream/cells";
import { useHomeSidebar, useProjects } from "../upstream/home";
import { THREAD_LIST_V2_ROW_CONTENT_CLASS_NAME } from "../upstream/substitutes/thread-list-v2-row-appearance";
import { glideBy } from "./awakeGlide";
import { arrivalDone } from "./hops";
import { ENTER, entering, LEAVE, MOVE } from "./listMotion";
import { openOnPressIn } from "./opening";
import {
  type Arrival,
  cellsListed,
  type Handed,
  handOver,
  releaseKept,
  slotStandsIn,
  useArrivals,
  useHanded,
  useKept,
} from "./plannedArrivals";
import { Since } from "./RowCell";
import { CELL, ROW_TITLE, RowCreature, RowMark, RowShell } from "./RowShell";
import {
  CellStates,
  HomeCellsHeld,
  HomeInFront,
  HomeStageContext,
  StagePageContext,
} from "./state";

// A dev build's hands on the planned rows (`planLab.ts`).
if (__DEV__) void import("./planLab");

/** What the home hands its planned rows: the Cells its machines list, by thread id, and how one opens. */
export const PlannedHome = createContext<{
  readonly threads: ReadonlyMap<string, EnvironmentThreadShell>;
  readonly open: (thread: EnvironmentThreadShell) => void;
} | null>(null);

/** A row as T3's card is on the phone (`upstream/substitutes/thread-list-v2-row-appearance.ts`), and as its row is in a sidebar. */
const SHAPE = {
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 20 },
  sidebar: { marginHorizontal: 0, marginBottom: 0, borderRadius: 12 },
} as const;
const SIDEBAR_PAD = { top: 10, right: 12, bottom: 10, left: 12, gap: 8 };
type Pad = typeof SIDEBAR_PAD;

const points = (value: unknown, otherwise: number) =>
  typeof value === "number" ? value : otherwise;

/** A row's padding and the gap after its Cell, as T3's card has them at the app's text size. */
function usePad(sidebar: boolean): Pad {
  const card = useResolveClassNames(`${THREAD_LIST_V2_ROW_CONTENT_CLASS_NAME} gap-2`);
  if (sidebar) return SIDEBAR_PAD;
  const upright = points(card.paddingVertical, 12);
  return {
    top: points(card.paddingTop, upright),
    right: points(card.paddingRight, 16),
    bottom: points(card.paddingBottom, upright),
    left: points(card.paddingLeft, 12),
    gap: points(card.gap, 8),
  };
}
/** The narrowest line, points, that still says the Cell's name, and its effort: the title keeps the rest. */
const FITS = { name: 300, effort: 400, chip: 220 };
const CHIP_SIZE = 11;

/** How tall a row stands with its gap, by shape, as last laid out: what the list glides by as one lands. */
const stood = { card: 57, sidebar: 48 };

/** How long the lowest born row stands settled before it is handed to T3's list in sight, ms: past a copy's stand, so one hand-over ends before the next. */
const HANDS_AFTER = 400;
/** The layer the copies of handed rows stand on, over Awake's list (`HandedRows`). */
let layer: ViewInstance | null = null;

/** The planned rows of the stage this list shows: Awake's, latest on top. */
export function PlannedRows() {
  const stage = use(HomeStageContext);
  return stage === "awake" ? <Rows /> : null;
}

function Rows() {
  const arrivals = useArrivals();
  const kept = useKept();
  const handed = useHanded();
  const awake = use(CellStates);
  const home = use(PlannedHome);
  const sidebar = useHomeSidebar();
  const shape = sidebar ? "sidebar" : "card";
  const inFront = use(HomeInFront);
  const page = use(StagePageContext);
  const seen = inFront && (page === null || page.active);
  const anchor = useRef<ViewInstance>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell the arrivals where Aski's copy lands while this list is the one in sight.
  useEffect(() => (seen ? slotStandsIn(anchor.current) : undefined), [seen]);
  const listed = arrivals
    .map((arrival) => arrival.row.threadId)
    .filter((threadId) => home?.threads.has(threadId))
    .join(" ");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell the arrivals' timers which planned Cells the machines list now.
  useEffect(() => {
    if (listed !== "") cellsListed(listed.split(" "));
  }, [listed]);
  // A born row keeps its place only while it is watched, and its Cell is awake: T3's own row stands in then.
  const left = kept
    .map((row) => row.threadId)
    .filter((threadId) => {
      const thread = home?.threads.get(threadId);
      return !seen || thread === undefined || !awake.has(cellKey(thread));
    })
    .join(" ");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand the rows nobody is watching to T3's list, where its late insert is not seen.
  useEffect(() => {
    if (left !== "") releaseKept(left.split(" "));
  }, [left]);
  const { width } = useWindowDimensions();
  const [laid, setLaid] = useState(0);
  const pad = usePad(sidebar);
  const outer = laid > 0 ? laid : width;
  const line = lineIn(outer - 2 * SHAPE[shape].marginHorizontal, pad);
  return (
    <View onLayout={(event) => setLaid(event.nativeEvent.layout.width)}>
      <View
        ref={anchor}
        pointerEvents="none"
        style={{
          position: "absolute",
          top: pad.top,
          left: SHAPE[shape].marginHorizontal + pad.left,
          ...CELL,
        }}
      />
      {[
        ...[...arrivals].reverse().map((arrival) => ({ row: arrival.row, arrival })),
        ...[...kept].reverse().map((row) => ({ row, arrival: null })),
      ].map(({ row, arrival }, index, all) => (
        <PlannedRow
          key={row.threadId}
          row={row}
          arrival={arrival}
          thread={home?.threads.get(row.threadId) ?? null}
          shape={shape}
          pad={pad}
          line={line}
          seen={seen}
          last={index === all.length - 1}
        />
      ))}
      {/* The room of a row handed to T3's list, held until the list's own row has taken it. */}
      {handed.map((each) =>
        each.landed ? null : <View key={each.row.threadId} style={{ height: each.room }} />,
      )}
    </View>
  );
}

/** The room a row's line has in a row `width` wide. */
const lineIn = (width: number, pad: Pad) => width - pad.left - pad.right - CELL.width - pad.gap;

/**
 * Where the copies of rows being handed to T3's list stand: a layer over Awake's list, moving
 * with it (`upstream/substitutes/HomeScreen.tsx`). A copy stands exactly where its row stood
 * until T3's own row has come in under it, then both change in one draw.
 */
export function HandedRows() {
  const handed = useHanded();
  const home = use(PlannedHome);
  const sidebar = useHomeSidebar();
  const pad = usePad(sidebar);
  const view = useRef<ViewInstance>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell the rows which layer their copies stand on, for as long as it is mounted.
  useEffect(() => {
    const own = view.current;
    layer = own;
    return () => {
      if (layer === own) layer = null;
    };
  }, []);
  return (
    <View ref={view} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {handed.map((each) => (
        <Copy
          key={each.row.threadId}
          handed={each}
          thread={home?.threads.get(each.row.threadId) ?? null}
          shape={sidebar ? "sidebar" : "card"}
          pad={pad}
        />
      ))}
    </View>
  );
}

function Copy(props: {
  readonly handed: Handed;
  readonly thread: EnvironmentThreadShell | null;
  readonly shape: keyof typeof SHAPE;
  readonly pad: Pad;
}) {
  const { frame, row } = props.handed;
  return (
    <View
      style={{
        position: "absolute",
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
      }}
    >
      <PlannedRow
        row={row}
        arrival={null}
        thread={props.thread}
        shape={props.shape}
        pad={props.pad}
        line={lineIn(frame.width, props.pad)}
        seen={false}
        copy
      />
    </View>
  );
}

const beatNow = (from: number) => Math.floor((clockSeconds() * 1000 - from) / ARRIVAL_BEAT_MS);

/** A line's parts as they settle from `from` (ms on the Cells' clock), one step a beat; null once each is its own words, or with no `from`. */
function useSettling(parts: ReadonlyArray<string>, from: number | undefined): DecodedPart[] | null {
  const [step, setStep] = useState(() => (from === undefined ? DECODE_STEPS : beatNow(from)));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Step the line's one-shot settle on the Cells' beat, and stop when it is done or the row goes.
  useEffect(() => {
    if (from === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const at = beatNow(from);
      setStep(Math.min(at, DECODE_STEPS));
      if (at >= DECODE_STEPS) return;
      timer = setTimeout(
        tick,
        Math.max(0, from + (at + 1) * ARRIVAL_BEAT_MS - clockSeconds() * 1000),
      );
    };
    tick();
    return () => clearTimeout(timer);
  }, [from]);
  if (from === undefined || step >= DECODE_STEPS) return null;
  return decodeAt(parts, Math.max(-1, step));
}

/** One part of the line: its own words, or while it settles their room with the step's glyphs over it. */
function Words(props: {
  readonly words: string;
  readonly now: DecodedPart | undefined;
  readonly className: string;
  readonly code?: boolean;
  /** It gives way when the line is short: the title. */
  readonly shrinks?: boolean;
}) {
  const settling = props.now !== undefined && props.now.settled < props.words.length;
  const font = props.code ? { fontFamily: CODE_FONT, fontSize: CHIP_SIZE } : null;
  return (
    <View style={props.shrinks ? { flexShrink: 1, minWidth: 0 } : { flexShrink: 0 }}>
      <AppText
        className={props.className}
        numberOfLines={1}
        style={[font, settling ? { opacity: 0 } : null]}
      >
        {props.words}
      </AppText>
      {settling ? (
        <AppText
          className={props.className}
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[font, { position: "absolute", top: 0, left: 0, right: 0 }]}
        >
          {props.now!.text}
        </AppText>
      ) : null}
    </View>
  );
}

function PlannedRow(props: {
  readonly row: Planned;
  /** Its arrival; null once its birth is over and it only keeps its place (`plannedArrivals.ts`, kept). */
  readonly arrival: Arrival | null;
  readonly thread: EnvironmentThreadShell | null;
  readonly shape: keyof typeof SHAPE;
  readonly pad: Pad;
  /** The room its line has, points: what of its birth words fits. */
  readonly line: number;
  readonly seen: boolean;
  /** It stands lowest of the planned rows, next to T3's list: the one that can be handed over where it stands. */
  readonly last?: boolean;
  /** It is a handed row's copy (`Copy`): it fills its frame, and hands nothing over itself. */
  readonly copy?: boolean;
}) {
  const { row, arrival, thread, shape } = props;
  const copy = props.copy === true;
  const self = useRef<ViewInstance>(null);
  // A sidebar's list is never out of sight, so its born row would never get T3's swipe and menu.
  const hands =
    arrival === null && props.last === true && props.seen && thread !== null && shape === "sidebar";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand a settled row to T3's list where it stands, measured on the copies' layer.
  useEffect(() => {
    if (!hands) return;
    const timer = setTimeout(() => {
      const over = layer;
      const own = self.current;
      if (own === null || over === null) return;
      // In the window, both: the layer stands over the list, and is no ancestor to measure in.
      over.measureInWindow((left, top) =>
        own.measureInWindow((x, y, width, height) => {
          if (width <= 0) return;
          handOver(
            row.threadId,
            { x: x - left, y: y - top, width, height },
            height + SHAPE[shape].marginBottom,
          );
        }),
      );
    }, HANDS_AFTER);
    return () => clearTimeout(timer);
  }, [hands, row.threadId, shape]);
  const home = use(PlannedHome);
  const held = use(HomeCellsHeld);
  const projects = useProjects();
  const project = projects.find((each) => String(each.id) === row.projectId) ?? null;
  const reduced = useReducedMotion();
  // It plays only as it lands in sight: seen later, or again in another list, it stands.
  const [plays] = useState(
    () =>
      arrival !== null &&
      arrival.forms &&
      props.seen &&
      clockSeconds() * 1000 - arrival.at < 3 * ARRIVAL_BEAT_MS,
  );
  const [fades] = useState(
    () => arrival !== null && !arrival.forms && clockSeconds() * 1000 - arrival.at < 250,
  );
  const own = useSharedValue(plays ? stood[shape] : 0);
  const state = use(CellStates).get(thread === null ? "" : cellKey(thread));
  const rowState =
    thread === null ? null : rowStateOf(state?.stage, threadHasUnseenCompletion(thread));
  const flying = rowState === "flying";
  const leaving = arrival?.state === "gone";
  const dims = useSharedValue(1);
  const went = useRef(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Glide the list under the row as it lands, once on the UI thread, and close over it when it leaves unlisted.
  useLayoutEffect(() => {
    if (plays) {
      glideBy(stood[shape]);
      own.set(withTiming(0, MOVE));
    }
    return () => {
      if (went.current && !reduced) glideBy(-stood[shape]);
    };
  }, [plays, own, shape, reduced]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fade a dropped row out where it stands, on the UI thread.
  useEffect(() => {
    if (!leaving) return;
    went.current = true;
    dims.set(withTiming(0, LEAVE));
  }, [leaving, dims]);

  // Its birth words go once its Cell is listed and their time is up; the title takes their place.
  const fading = arrival?.state === "fading";
  const [bare, setBare] = useState(arrival === null);
  // Its time comes in once the title has taken the birth words' place.
  const [timed, setTimed] = useState(arrival === null);
  const words = useSharedValue(1);
  const titleShift = useSharedValue(0);
  const birthWidth = useRef(0);
  const key = thread === null ? null : cellKey(thread);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fade the birth words on the UI thread, then drop them from the line; T3's row, which stands in next, has entered already.
  useEffect(() => {
    if (!fading) return;
    if (key !== null) arrivalDone(key);
    words.set(withTiming(0, LEAVE));
    const timer = setTimeout(() => setBare(true), ARRIVALS.fade);
    return () => clearTimeout(timer);
  }, [fading, key, words]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Glide the title from where the birth words held it, before paint.
  useLayoutEffect(() => {
    if (!bare || timed) return;
    const glides = !reduced && birthWidth.current > 0;
    if (glides) {
      titleShift.set(birthWidth.current);
      titleShift.set(withTiming(0, MOVE));
    }
    const timer = setTimeout(() => setTimed(true), glides ? MOVE.duration : 0);
    return () => clearTimeout(timer);
  }, [bare, timed, reduced, titleShift]);

  const fits = {
    name: props.line >= FITS.name,
    chip: row.modelName !== "" && props.line >= FITS.chip,
    effort: props.line >= FITS.effort,
  };
  const model = row.modelName;
  const effort = fits.effort ? chipWords(row).slice(model.length) : "";
  const name = cellNameOf(row.threadId);
  const parts = ["#", fits.name ? name : "", fits.chip ? model : "", effort, row.title];
  const settling = useSettling(
    parts,
    plays && arrival !== null ? arrival.at + ARRIVALS.settles * ARRIVAL_BEAT_MS : undefined,
  );
  const [marked, named, modelled, efforted, titled] = settling ?? [];

  const { pad } = props;
  const moved = useAnimatedStyle(() => ({
    opacity: dims.get(),
    transform: [{ translateY: own.get() }],
  }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.get() }));
  const titleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: titleShift.get() }] }));
  const forms = formingFrom(row.threadId, new Date(row.born).toISOString());
  const onPress = () => {
    if (thread !== null) home?.open(thread);
  };
  return (
    <Animated.View
      ref={self}
      collapsable={false}
      entering={
        fades ? FadeIn.duration(ENTER.duration).reduceMotion(ReduceMotion.Never) : undefined
      }
      onLayout={
        copy
          ? undefined
          : (event) => {
              stood[shape] = event.nativeEvent.layout.height + SHAPE[shape].marginBottom;
            }
      }
      className={shape === "card" ? "bg-grouped-card" : undefined}
      style={[
        {
          marginHorizontal: copy ? 0 : SHAPE[shape].marginHorizontal,
          marginBottom: copy ? 0 : SHAPE[shape].marginBottom,
          borderRadius: SHAPE[shape].borderRadius,
          borderCurve: "continuous",
          overflow: "hidden",
        },
        moved,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.title}
        disabled={leaving || thread === null}
        onPressIn={thread === null ? undefined : () => openOnPressIn(thread)}
        onPress={onPress}
        style={({ pressed }) => ({
          paddingTop: pad.top,
          paddingRight: pad.right,
          paddingBottom: pad.bottom,
          paddingLeft: pad.left,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <RowShell
          style={{ gap: pad.gap, minHeight: CELL.height }}
          lined
          under={flying && thread !== null ? <RowLight thread={thread} band fill={FILL} /> : null}
          // One figure from its first glyph to its first work: T3's row draws it from there.
          creature={
            <RowCreature
              threadId={row.threadId}
              thread={thread}
              driver={row.driver}
              formingFrom={forms}
              held={held}
            />
          }
          // Its birth over, it says how long it has been like this, as every Awake row does.
          trailing={
            timed && thread !== null && rowState !== null && state?.since ? (
              <Animated.View entering={arrival === null ? undefined : entering()}>
                <Since
                  since={state.since}
                  status={rowStatusOf(rowState, thread.hasPendingApprovals)}
                />
              </Animated.View>
            ) : null
          }
        >
          <>
            {project === null ? null : (
              <RowMark
                project={project}
                opacity={marked !== undefined && marked.settled === 0 ? 0 : 0.4}
              />
            )}
            {bare || !(fits.name || fits.chip) ? null : (
              <Animated.View
                className="flex-row items-center"
                style={[{ gap: 6, paddingRight: 6 }, wordsStyle]}
                onLayout={(event) => {
                  birthWidth.current = event.nativeEvent.layout.width;
                }}
              >
                {fits.name ? (
                  <Words words={name} now={named} className="text-base text-foreground-muted" />
                ) : null}
                {fits.chip ? (
                  <View
                    className="flex-row items-center border border-border-subtle"
                    style={{
                      gap: 3,
                      paddingHorizontal: 5,
                      borderRadius: 6,
                      opacity: modelled !== undefined && !modelled.started ? 0 : 1,
                    }}
                  >
                    <Words words={model} now={modelled} className="text-foreground-muted" code />
                    {effort === "" ? null : (
                      <Words words={effort} now={efforted} className="text-foreground-muted" code />
                    )}
                  </View>
                ) : null}
              </Animated.View>
            )}
            <Animated.View style={[{ flexShrink: 1, flexGrow: 1, minWidth: 0 }, titleStyle]}>
              <Words
                words={row.title}
                now={titled}
                className={`${ROW_TITLE} ${shape === "sidebar" ? "text-drawer-foreground" : "text-foreground"}`}
                shrinks
              />
            </Animated.View>
          </>
        </RowShell>
      </Pressable>
    </Animated.View>
  );
}

const FILL = { position: "absolute", top: -12, right: -16, bottom: -12, left: -12 } as const;
