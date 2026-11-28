// A plan's card (stemcells/tasks/aski-orchestrator.md, decisions 4, 5, 12, 15, 16 and 18), the
// same over Aski's composer and in a ```plan fence: its headline, a row a Cell (`PlanRow.tsx`),
// and while Cells wait its foot, Cancel and the one Send. Nothing starts before that Send. A
// deletion is a card of its own (`HoldCard.tsx`).

import { useEffect, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import type { ModelEntry, PlaceEntry } from "../../../../../../stemcells/orchestrator/plan.ts";
import { rowSays } from "../../../../../../stemcells/orchestrator/rows.ts";
import {
  CALL_BACK_MS,
  callable,
  comesAfter,
  counts,
  dropAll,
  held,
  onOf,
  send,
  type Tray,
  type TrayAct,
  unsendable,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import {
  CANCEL,
  DICTATED,
  LEFT_OVER,
  SEND,
  SEND_WAITS,
} from "../../../../../../stemcells/words/plans.ts";
import { ENTER, LEAVE } from "../../home/listMotion";
import { Pill } from "../../line/Ask";
import { readSoon, useReadings } from "../../line/readings";
import { useThreadShellsSelected } from "../../upstream/cells";
import { AppText, SymbolView, useStartsApart } from "../../upstream/plans";
import { HoldCard } from "./HoldCard";
import { projectIdOf } from "./pick";
import { type CellAct, PlanRow } from "./PlanRow";
import { planCarrier, trays } from "./run";
import { beatsOf, sentNow } from "./sent";
import type { PlanEntry } from "./trays";
import { CLOSE_PLAN, dropHold, getsWorktree, headOf, seenIn } from "./view";

/** From this width, points, a card sets a task on one line; under it the pickers stand under the title. */
const ONE_LINE = 520;
/** Under this width the window is a phone's, or the folded Duo's: Awake is not in sight beside the chat. */
const NARROW = 600;
/** A plan first drawn this long ago, ms, has arrived: its rows stand when they are drawn again. */
const ARRIVED = 400;

/** When each plan was first drawn, ms: its rows arrive once, however often their views are rebuilt. */
const drawn = new Map<string, number>();

/** The clock, read again once the last Cell that can be called back no longer can. */
function useCallBackClock(entry: PlanEntry): number {
  const [now, setNow] = useState(() => Date.now());
  const latest = Math.max(
    0,
    ...(entry.tray?.acts ?? []).map((one) => (one.status === "started" ? (one.startedAt ?? 0) : 0)),
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Call back stands for ten seconds: one timer takes it away when they are over.
  useEffect(() => {
    const left = latest + CALL_BACK_MS - Date.now();
    if (latest === 0 || left <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), left + 50);
    return () => clearTimeout(timer);
  }, [latest]);
  return Math.max(now, latest);
}

const isCell = (one: TrayAct): one is CellAct => one.act.kind === "start";

export function PlanPanel(props: {
  readonly entry: PlanEntry;
  readonly places: ReadonlyArray<PlaceEntry>;
  readonly models: ReadonlyArray<ModelEntry>;
  /** Aski's own words: each Cell's message stands open. */
  readonly open: boolean;
}) {
  const { entry } = props;
  const tray = entry.tray;
  const now = useCallBackClock(entry);
  // A Cell another device already started is that Cell, whatever this phone's tray says.
  const here = useThreadShellsSelected((shells) =>
    (tray?.acts ?? [])
      .flatMap((one) =>
        one.act.kind === "start" &&
        shells.some(
          (shell) =>
            shell.id === (one.act as { threadId: string }).threadId &&
            shell.environmentId === entry.environmentId,
        )
          ? [one.act.i]
          : [],
      )
      .join(","),
  );
  const reading = useReadings().get(entry.environmentId);
  const startsApart = useStartsApart(entry.environmentId);
  const flying = (tray?.acts ?? []).filter((one) => one.status === "started").length;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A Cell that just started isn't in its machine's last reading: the machine is read again.
  useEffect(() => {
    if (flying > 0) readSoon(entry.environmentId);
  }, [flying, entry.environmentId]);
  const window = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const ground = useResolveClassNames("bg-card-alt").backgroundColor;
  // Its rows arrive a stagger apart as the plan does, and stand when their views are rebuilt.
  const [arrives] = useState(() => {
    const first = drawn.get(entry.id) ?? Date.now();
    drawn.set(entry.id, first);
    return entry.door === "composer" && Date.now() - first < ARRIVED;
  });
  /** The Cells a Send just took, while the foot folds away under them. */
  const [folding, setFolding] = useState<number | null>(null);
  const foot = useSharedValue(1);
  const folds = useAnimatedStyle(() => ({
    opacity: foot.get(),
    transform: [{ scaleY: 0.9 + 0.1 * foot.get() }],
  }));
  if (tray === null) return null;
  const narrow = window.width < NARROW;
  const exists = new Set(here === "" ? [] : here.split(",").map(Number));
  const seenOf = seenIn(
    reading === undefined || reading.state === "none" ? undefined : reading.list?.cells,
  );
  /** A row as it reads: one whose Cell is in the app started, whoever started it. */
  const shownOf = <One extends TrayAct>(one: One): One =>
    exists.has(one.act.i) && (one.status === "waiting" || one.status === "queued")
      ? { ...one, status: "started" }
      : one;
  const apartOf = (one: CellAct): boolean => {
    if (one.status !== "waiting" && one.status !== "queued" && one.status !== "starting")
      return false;
    // Start now on a Cell that came after others is the phone's own start, in the project's folder.
    if (one.status === "starting" && comesAfter(one.act)) return false;
    const projectId = projectIdOf(one.act);
    return getsWorktree(tray, one.act, projectId === null ? false : startsApart(projectId));
  };
  const head = headOf(tray, seenOf);
  const back = new Set(callable(tray, now).map((one) => one.act.i));
  const blocked = held(tray);
  const waits = counts(tray).waiting > 0;
  const stagger = arrives ? beatsOf([0, 1], narrow).get(1)! : 0;
  const leftOver = tray.plan.leftOver
    .map((n) => tray.plan.pieces.find((piece) => piece.n === n)?.text ?? "")
    .filter((text) => text.length > 0)
    .join(" ");
  const sendIt = () => {
    const on = onOf(tray).map((one) => one.act.i);
    if (unsendable(tray) !== null) return;
    // The moment first: each row asks when its Cell forms as the tray changes.
    sentNow(entry.id, on, narrow);
    setFolding(on.length);
    foot.set(
      withTiming(0, LEAVE, (finished) => {
        if (finished) runOnJS(setFolding)(null);
      }),
    );
    planCarrier();
    trays.change(entry.id, send);
  };
  const cancel = () => {
    trays.change(entry.id, dropAll);
    if (entry.door === "composer") trays.leave(entry.id);
  };
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {head.line !== null ? (
        <View className="min-h-11 flex-row items-center gap-2 px-4 pt-1">
          <AppText
            accessibilityRole="header"
            className="flex-1 font-t3-medium text-xs text-foreground-muted"
          >
            {head.line}
          </AppText>
          {tray.plan.dictated ? (
            <AppText className="text-xs text-foreground-tertiary">{DICTATED}</AppText>
          ) : null}
          {/* While Cells wait, Cancel in the foot closes it. */}
          {entry.door === "composer" && !waits && folding === null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CLOSE_PLAN}
              hitSlop={12}
              onPress={cancel}
              className="size-7 items-center justify-center active:opacity-70"
            >
              <SymbolView
                name="xmark"
                size={12}
                tintColorClassName="accent-foreground-muted"
                type="monochrome"
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {tray.acts.map((one, index) => (
        <Animated.View
          key={one.act.i}
          entering={
            arrives
              ? FadeIn.duration(ENTER.duration)
                  .easing(ENTER.easing)
                  .delay(index * stagger)
              : undefined
          }
          className={index > 0 || head.line !== null ? "border-t border-border-subtle" : undefined}
        >
          {isCell(one) ? (
            <PlanRow
              id={entry.id}
              environmentId={entry.environmentId}
              one={shownOf(one)}
              says={rowSays(tray, shownOf(one), seenOf)}
              apart={apartOf(shownOf(one))}
              blocked={blocked}
              back={back.has(one.act.i)}
              places={props.places}
              models={props.models}
              open={props.open}
              wide={width >= ONE_LINE}
              width={width}
              ground={typeof ground === "string" ? ground : "transparent"}
            />
          ) : one.act.kind === "destroy" ? (
            <HoldCard
              act={one.act}
              status={one.status === "done" || one.status === "dropped" ? one.status : "waiting"}
              refused={entry.refused.get(one.act.i) ?? null}
              onHeld={() => void planCarrier().destroy(entry.id, one.act.i)}
              onDrop={() => trays.change(entry.id, (next) => dropHold(next, one.act.i))}
            />
          ) : null}
        </Animated.View>
      ))}
      {leftOver.length > 0 ? (
        <AppText className="border-t border-border-subtle px-4 py-2 text-xs text-foreground-muted">
          {LEFT_OVER(leftOver)}
        </AppText>
      ) : null}
      {waits ? (
        <Foot tray={tray} onCancel={cancel} onSend={sendIt} />
      ) : folding !== null ? (
        // The Send it carried, fading where it stood; then its room is given back.
        <Animated.View style={[{ transformOrigin: "top" }, folds]} pointerEvents="none">
          <FootLine reason="" sends={folding} able />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The plan's one yes, and its no: all or nothing, and why it waits when it does. */
function Foot(props: {
  readonly tray: Tray;
  readonly onCancel: () => void;
  readonly onSend: () => void;
}) {
  const why = unsendable(props.tray);
  return (
    <FootLine
      reason={
        why === "held" ? SEND_WAITS.held : why === null || why === "nothing" ? "" : SEND_WAITS.place
      }
      sends={onOf(props.tray).length}
      able={why === null}
      onCancel={props.onCancel}
      onSend={props.onSend}
    />
  );
}

function FootLine(props: {
  readonly reason: string;
  readonly sends: number;
  readonly able: boolean;
  readonly onCancel?: () => void;
  readonly onSend?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-end gap-2 border-t border-border-subtle px-4 py-2.5">
      <AppText className="flex-1 text-right text-xs text-foreground-muted" numberOfLines={2}>
        {props.reason}
      </AppText>
      <Pill filled={false} title={CANCEL} onPress={props.onCancel ?? (() => undefined)} />
      <View
        className={props.able ? undefined : "opacity-40"}
        pointerEvents={props.able ? "auto" : "none"}
        accessibilityState={{ disabled: !props.able }}
        accessibilityHint={props.reason === "" ? undefined : props.reason}
      >
        <Pill filled title={SEND(props.sends)} onPress={props.onSend ?? (() => undefined)} />
      </View>
    </View>
  );
}
