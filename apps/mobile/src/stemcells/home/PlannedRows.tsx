// Aski's planned rows at the top of the home's Awake list (stemcells/tasks/aski-orchestrator.md,
// decision 12), as the Mac's column has them (`apps/web/src/stemcells/rail/Planned.tsx`): each
// lands where Aski's copy does, its Cell forms, and its line settles out of glyphs on the Cells'
// beat. A row keeps its place here until its birth is over; then T3's own row stands in for it.

import { createContext, use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View, type ViewInstance } from "react-native";
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
import { openPlannedRow, type Planned } from "../../../../../stemcells/aski/planned.ts";
import { CHECK_ROW_WORDS, UNSURE_WORDS } from "../../../../../stemcells/words/planned.ts";
import { useAskiChat } from "../aski/useAskiChat";
import { CellFigure } from "../cell/CellFigure";
import { formingFrom } from "../cell/forming";
import { cellNameOf, clockSeconds } from "../cell/kit";
import { type Face, faceOf } from "../cell/mood";
import { useCellLook } from "../cell/roster";
import { instanceOf } from "../cell/ThreadCell";
import { RowLight } from "../glow/RowLight";
import { rowStateOf, rowStatusOf } from "../line/kit";
import { cellKey } from "../line/line";
import { ProjectMark } from "../project/ProjectMark";
import { titleMarkLayout } from "../project/titleMark";
import { CODE_FONT } from "../tokens";
import {
  AppText,
  type EnvironmentThreadShell,
  resolveThreadListV2Status,
  threadHasUnseenCompletion,
  useEnvironmentProviders,
  useThemeAppearance,
} from "../upstream/cells";
import { useHomeSidebar, useProjects } from "../upstream/home";
import { THREAD_LIST_V2_ROW_CONTENT_CLASS_NAME } from "../upstream/substitutes/thread-list-v2-row-appearance";
import { glideBy } from "./awakeGlide";
import { arrivalDone } from "./hops";
import { ENTER, entering, LEAVE, MOVE } from "./listMotion";
import { openOnPressIn } from "./opening";
import {
  type Arrival,
  cellsListed,
  releaseKept,
  slotStandsIn,
  useArrivals,
  useKept,
} from "./plannedArrivals";
import { Since } from "./RowCell";
import {
  CellStates,
  HomeCellsHeld,
  HomeInFront,
  HomeStageContext,
  StagePageContext,
  useMinute,
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
/** A Cell's box at two points a cell (`cell/look.ts`, `BOX`). */
const CELL = { width: 26, height: 28 };
/** The narrowest line, points, that still says the Cell's name, and its effort: the title keeps the rest. */
const FITS = { name: 300, effort: 400, chip: 220 };
const CHIP_SIZE = 11;

/** How tall a row stands with its gap, by shape, as last laid out: what the list glides by as one lands. */
const stood = { card: 57, sidebar: 48 };

/** The planned rows of the stage this list shows: Awake's, latest on top. */
export function PlannedRows(props: { readonly gutter?: number }) {
  const stage = use(HomeStageContext);
  return stage === "awake" ? <Rows gutter={props.gutter ?? 0} /> : null;
}

function Rows(props: { readonly gutter: number }) {
  const arrivals = useArrivals();
  const kept = useKept();
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
  const line =
    outer -
    2 * (SHAPE[shape].marginHorizontal + props.gutter) -
    pad.left -
    pad.right -
    CELL.width -
    pad.gap;
  return (
    <View onLayout={(event) => setLaid(event.nativeEvent.layout.width)}>
      <View
        ref={anchor}
        pointerEvents="none"
        style={{
          position: "absolute",
          top: pad.top,
          left: SHAPE[shape].marginHorizontal + props.gutter + pad.left,
          ...CELL,
        }}
      />
      {[
        ...[...arrivals].reverse().map((arrival) => ({ row: arrival.row, arrival })),
        ...[...kept].reverse().map((row) => ({ row, arrival: null })),
      ].map(({ row, arrival }) => (
        <PlannedRow
          key={row.threadId}
          row={row}
          arrival={arrival}
          thread={home?.threads.get(row.threadId) ?? null}
          shape={shape}
          gutter={props.gutter}
          pad={pad}
          line={line}
          seen={seen}
        />
      ))}
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

/** The mark of the field a check row is unsure of. */
function Unsure(props: { readonly row: Planned; readonly field: NonNullable<Planned["unsure"]> }) {
  if (props.row.tier !== "check" || props.row.unsure !== props.field) return null;
  return (
    <AppText
      className="text-xs font-semibold text-primary-text"
      style={{ fontFamily: CODE_FONT }}
      accessibilityLabel={UNSURE_WORDS[props.field]}
    >
      ?
    </AppText>
  );
}

function PlannedRow(props: {
  readonly row: Planned;
  /** Its arrival; null once its birth is over and it only keeps its place (`plannedArrivals.ts`, kept). */
  readonly arrival: Arrival | null;
  readonly thread: EnvironmentThreadShell | null;
  readonly shape: keyof typeof SHAPE;
  readonly gutter: number;
  readonly pad: Pad;
  /** The room its line has, points: what of its birth words fits. */
  readonly line: number;
  readonly seen: boolean;
}) {
  const { row, arrival, thread, shape } = props;
  const home = use(PlannedHome);
  const held = use(HomeCellsHeld);
  const aski = useAskiChat(null);
  const projects = useProjects();
  const project = projects.find((each) => String(each.id) === row.projectId) ?? null;
  const reduced = useReducedMotion();
  const outline = row.tier === "check";
  const look = useCellLook(row.threadId);
  const ground = useThemeAppearance() === "light" ? "light" : "black";
  const providers = useEnvironmentProviders();
  const driver =
    (thread === null
      ? undefined
      : providers
          .get(thread.environmentId)
          ?.find((provider) => provider.instanceId === instanceOf(thread))?.driver) ??
    row.driver ??
    null;
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
  const minute = useMinute();
  const face: Face =
    thread === null
      ? { mood: "awake" }
      : faceOf(thread, resolveThreadListV2Status(thread), { now: Date.parse(minute), driver });
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

  const { fontScale } = useWindowDimensions();
  const base = useResolveClassNames("text-base").fontSize;
  const family = useResolveClassNames("font-sans").fontFamily;
  const mark = titleMarkLayout((typeof base === "number" ? base : 16) * fontScale, family);
  const { pad } = props;
  // An outline's hairline takes its room from the padding, so the row stands as tall filled in.
  const edge = outline ? 1 : 0;
  const moved = useAnimatedStyle(() => ({
    opacity: dims.get(),
    transform: [{ translateY: own.get() }],
  }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.get() }));
  const titleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: titleShift.get() }] }));
  const forms = formingFrom(row.threadId, new Date(row.born).toISOString());
  const onPress = () => {
    if (outline) {
      // Whoever holds the plan shows it; Aski's chat, where it stands, comes forward.
      openPlannedRow(row);
      if (aski !== null) home?.open(aski);
    } else if (thread !== null) home?.open(thread);
  };
  return (
    <Animated.View
      entering={
        fades ? FadeIn.duration(ENTER.duration).reduceMotion(ReduceMotion.Never) : undefined
      }
      onLayout={(event) => {
        stood[shape] = event.nativeEvent.layout.height + SHAPE[shape].marginBottom;
      }}
      className={
        outline
          ? "border border-dashed border-border"
          : shape === "card"
            ? "bg-grouped-card"
            : undefined
      }
      style={[
        {
          marginHorizontal: SHAPE[shape].marginHorizontal + props.gutter,
          marginBottom: SHAPE[shape].marginBottom,
          borderRadius: SHAPE[shape].borderRadius,
          borderCurve: "continuous",
          overflow: "hidden",
        },
        moved,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={outline ? `${row.title}. ${CHECK_ROW_WORDS}` : row.title}
        disabled={leaving || (!outline && thread === null)}
        onPressIn={thread === null || outline ? undefined : () => openOnPressIn(thread)}
        onPress={onPress}
        style={({ pressed }) => ({
          paddingTop: pad.top - edge,
          paddingRight: pad.right - edge,
          paddingBottom: pad.bottom - edge,
          paddingLeft: pad.left - edge,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          className="flex-row items-center"
          style={{ gap: pad.gap, minHeight: CELL.height, opacity: outline ? 0.55 : 1 }}
        >
          {flying && thread !== null ? <RowLight thread={thread} band fill={FILL} /> : null}
          {/* One figure from its outline to its first work: T3's row draws it from there. */}
          <CellFigure
            name={row.threadId}
            mood={face.mood}
            activity={face.activity}
            provider={driver}
            look={look}
            points={2}
            plays={face.activity !== undefined || face.mood === "pleased"}
            ground={ground}
            formingFrom={outline ? undefined : forms}
            outline={outline}
            held={held}
          />
          <View className="min-w-0 flex-1 flex-row items-center">
            {project === null ? null : (
              <View
                style={{
                  width: mark.width,
                  opacity: marked !== undefined && marked.settled === 0 ? 0 : 0.4,
                }}
              >
                <ProjectMark project={project} size={mark.size} />
              </View>
            )}
            <Unsure row={row} field="place" />
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
                    <Unsure row={row} field="model" />
                  </View>
                ) : null}
              </Animated.View>
            )}
            <Animated.View style={[{ flexShrink: 1, flexGrow: 1, minWidth: 0 }, titleStyle]}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Words
                  words={row.title}
                  now={titled}
                  className={`text-base font-t3-medium ${shape === "sidebar" ? "text-drawer-foreground" : "text-foreground"}`}
                  shrinks
                />
                {settling === null ? <Unsure row={row} field="words" /> : null}
              </View>
            </Animated.View>
          </View>
          {/* Its birth over, it says how long it has been like this, as every Awake row does. */}
          {timed && thread !== null && rowState !== null && state?.since ? (
            <Animated.View entering={arrival === null ? undefined : entering()}>
              <Since
                since={state.since}
                status={rowStatusOf(rowState, thread.hasPendingApprovals)}
              />
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const FILL = { position: "absolute", top: -12, right: -16, bottom: -12, left: -12 } as const;
