// One Cell of a plan (stemcells/tasks/aski-orchestrator.md, decision 18), built from the Awake
// row's own pieces (`home/RowShell.tsx`). Before Send it is a task: its title, its project and
// model to change, and the words it is told; a swipe left switches it off and back on. It
// swipes left because a swipe right is the chat's way back. Sent, it reads as its Cell stands.

import { StackActions, useNavigation } from "@react-navigation/native";
import { type ReactNode, useMemo, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  Keyframe,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";

import type {
  ModelEntry,
  PlaceEntry,
  StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import type { RowSays } from "../../../../../../stemcells/orchestrator/rows.ts";
import {
  drop,
  setNewName,
  setPlace,
  toggle,
  type TrayAct,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import {
  CALL_BACK,
  DROP,
  OWN_WORKTREE,
  placeLabel,
  START_NOW,
  SWITCH_OFF,
  SWITCH_ON,
  TOLD,
} from "../../../../../../stemcells/words/plans.ts";
import { formingFrom } from "../../cell/forming";
import { clockSeconds } from "../../cell/kit";
import { ENTER, MOVE } from "../../home/listMotion";
import {
  CELL,
  ROW_TITLE,
  RowCreature,
  RowMark,
  RowShell,
  useTitleMarkLayout,
} from "../../home/RowShell";
import { Pill } from "../../line/Ask";
import { useThreadShellsSelected } from "../../upstream/cells";
import { ComposerModelControl, ThreadSwipeable, useModelChoice } from "../../upstream/planRow";
import {
  AppText,
  Dialog,
  Menu,
  SymbolView,
  useNewCellDefaults,
  useProjects,
} from "../../upstream/plans";
import { selectionOf } from "./launch";
import { PLAN_PICK, projectIdOf } from "./pick";
import { planCarrier, trays } from "./run";
import { formsAt } from "./sent";
import {
  HIDE_MESSAGE,
  messageSpans,
  modelLine,
  NEW_PROJECT_NAME,
  SHOW_MESSAGE,
  STATUS_WORDS,
  SWITCH_HINT,
  switchLabel,
  unsureOf,
  whyLines,
} from "./view";

/** A plan's Cell: an act that starts one. */
export type CellAct = TrayAct & { readonly act: StartAct };

/** The gap after a Cell at its row's start, points: the Awake row's `gap-2`. */
const GAP = 8;
/** A row switched off: dim, and its title struck through. */
const OFF = { opacity: 0.45 } as const;
/** A row seen this long after its Cell began to form stands as it is, seconds. */
const LATE = 0.25;

const SWITCH = "switch";

export function PlanRow(props: {
  readonly id: string;
  readonly environmentId: string;
  /** The act as it reads: started once its Cell is in the app. */
  readonly one: CellAct;
  /** Its Cell's standing, or what it comes after. */
  readonly says: RowSays;
  /** It isn't a Cell yet, and will work in a worktree of its own. */
  readonly apart: boolean;
  /** A deletion is held: nothing starts before it. */
  readonly blocked: boolean;
  /** It started within the last ten seconds: one tap stops and archives it. */
  readonly back: boolean;
  readonly places: ReadonlyArray<PlaceEntry>;
  readonly models: ReadonlyArray<ModelEntry>;
  /** Aski's own words: the message stands open. */
  readonly open: boolean;
  /** The card is wide enough for a task on one line. */
  readonly wide: boolean;
  /** The card's width, points: how far a full swipe reaches. */
  readonly width: number;
  /** The card's own colour, behind the row as it swipes. */
  readonly ground: string;
}) {
  const { one, id } = props;
  const act = one.act;
  const [open, setOpen] = useState(props.open || act.risks.length > 0);
  const waiting = one.status === "waiting";
  const off = waiting && one.off === true;
  const switchIt = useMemo(
    () => () => trays.change(id, (tray) => toggle(tray, act.i)),
    [id, act.i],
  );
  // Kept the same between draws: the swipe rebuilds its gesture when its action changes.
  const action = useMemo(
    () => ({
      accessibilityLabel: switchLabel(act.title, off),
      icon: off ? ("arrow.uturn.backward" as const) : ("slash.circle" as const),
      label: off ? SWITCH_ON : SWITCH_OFF,
      onPress: switchIt,
    }),
    [act.title, off, switchIt],
  );
  const flip = () => setOpen(!open);
  const told = open ? <Told act={act} /> : null;
  return (
    <ThreadSwipeable
      threadKey={`plan:${id}:${act.i}`}
      threadTitle={act.title}
      backgroundColor={props.ground}
      // Its swipe is a waiting task's alone: a Cell that was sent is called back or dropped by a tap.
      dormant={!waiting}
      enableTrackpadSwipe
      fullSwipeAction="primary"
      fullSwipeWidth={props.width}
      onDelete={switchIt}
      primaryAction={action}
      secondaryAction={null}
    >
      {() =>
        waiting ? (
          <Task {...props} one={one} off={off} open={open} onFlip={flip} onSwitch={switchIt}>
            {told}
          </Task>
        ) : (
          <Sent {...props} one={one} open={open} onFlip={flip}>
            {told}
          </Sent>
        )
      }
    </ThreadSwipeable>
  );
}

type RowProps = Parameters<typeof PlanRow>[0] & {
  readonly open: boolean;
  readonly onFlip: () => void;
  /** The words it is told, when they stand open. */
  readonly children: ReactNode;
};

/** The words in a word's place at a row's end, and the chevron to what the Cell is told. */
function Trailing(props: {
  readonly word: string;
  readonly danger?: boolean;
  readonly open: boolean;
}) {
  return (
    <>
      {props.word === "" ? null : (
        <AppText
          className={
            props.danger ? "text-xs text-danger-foreground" : "text-xs text-foreground-muted"
          }
          numberOfLines={1}
        >
          {props.word}
        </AppText>
      )}
      <SymbolView
        name={props.open ? "chevron.up" : "chevron.down"}
        size={10}
        tintColorClassName="accent-foreground-muted"
        type="monochrome"
      />
    </>
  );
}

/** A task that waits for Send. */
function Task(props: RowProps & { readonly off: boolean; readonly onSwitch: () => void }) {
  const { one, id, off, open } = props;
  const act = one.act;
  const navigation = useNavigation();
  const unsure = unsureOf(act);
  const whys = whyLines(act, props.blocked);
  const flips = {
    accessibilityRole: "button" as const,
    accessibilityLabel: `${act.title}. ${open ? HIDE_MESSAGE : SHOW_MESSAGE}`,
    accessibilityHint: SWITCH_HINT,
    accessibilityState: { expanded: open },
    accessibilityActions: [{ name: SWITCH, label: off ? SWITCH_ON : SWITCH_OFF }],
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
      if (event.nativeEvent.actionName === SWITCH) props.onSwitch();
    },
    onPress: props.onFlip,
  };
  const title = (
    <AppText
      className={`${ROW_TITLE} text-foreground ${off ? "line-through" : ""}`}
      numberOfLines={1}
    >
      {act.title}
    </AppText>
  );
  const trailing = <Trailing word={off ? SWITCH_OFF : props.says.word} open={open} />;
  const place = (
    <TaskPlace
      id={id}
      environmentId={props.environmentId}
      act={act}
      places={props.places}
      unsure={unsure.place}
    />
  );
  const model = (
    <View className="min-w-0 shrink flex-row items-center gap-1">
      {unsure.model ? <View className="size-1.5 rounded-full bg-stage-input" /> : null}
      <TaskModel
        environmentId={props.environmentId}
        act={act}
        models={props.models}
        ground={props.ground}
        onPress={() => {
          Keyboard.dismiss();
          navigation.dispatch(StackActions.push(PLAN_PICK, { planId: id, i: act.i }));
        }}
      />
      {props.apart ? (
        <AppText className="shrink-0 text-xs text-foreground-muted">{OWN_WORKTREE}</AppText>
      ) : null}
    </View>
  );
  // The pickers stand a little into the row's padding: each keeps a hand's 44 points.
  const picks = { marginVertical: -6 } as const;
  return (
    <View className="gap-1 px-4 py-2" style={off ? OFF : undefined}>
      {props.wide ? (
        <View className="flex-row items-center gap-3" style={picks}>
          <View className="max-w-[30%] shrink-0" pointerEvents={off ? "none" : "auto"}>
            {place}
          </View>
          <Pressable {...flips} className="min-w-0 flex-1 active:opacity-70">
            {title}
          </Pressable>
          <View className="max-w-[40%] shrink-0" pointerEvents={off ? "none" : "auto"}>
            {model}
          </View>
          <Pressable
            accessible={false}
            onPress={props.onFlip}
            hitSlop={10}
            className="flex-row items-center gap-2 active:opacity-70"
          >
            {trailing}
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable {...flips} className="min-h-7 flex-row items-center gap-2 active:opacity-70">
            <View className="min-w-0 flex-1">{title}</View>
            {trailing}
          </Pressable>
          <View
            className="flex-row items-center gap-3"
            style={picks}
            pointerEvents={off ? "none" : "auto"}
          >
            <View className="max-w-[45%] shrink-0">{place}</View>
            {model}
          </View>
        </>
      )}
      {whys.length === 0 ? null : (
        <View className="gap-0.5">
          {whys.map((line) => (
            <View key={line} className="flex-row items-center gap-1.5">
              <View className="size-1.5 rounded-full bg-stage-input" />
              <AppText className="flex-1 text-xs text-foreground-secondary">{line}</AppText>
            </View>
          ))}
        </View>
      )}
      {props.children}
    </View>
  );
}

/** A waiting task's project: a menu of the machine's, its mark the trigger; a new one is renamed. */
function TaskPlace(props: {
  readonly id: string;
  readonly environmentId: string;
  readonly act: StartAct;
  readonly places: ReadonlyArray<PlaceEntry>;
  readonly unsure: boolean;
}) {
  const { act, id } = props;
  const mark = useTitleMarkLayout();
  const projectId = projectIdOf(act);
  const project =
    useProjects().find(
      (each) => each.environmentId === props.environmentId && String(each.id) === projectId,
    ) ?? null;
  const name = placeLabel(act);
  const renames = act.place?.how === "new";
  const trigger = (symbol: "chevron.down" | "pencil") => (
    <View className="min-h-11 flex-row items-center">
      {project === null ? (
        // No project to draw yet: its mark's room, empty.
        <View style={{ width: mark.width }}>
          <View
            className="border border-dashed border-border"
            style={{ width: mark.size, height: mark.size, borderRadius: mark.size * 0.25 }}
          />
        </View>
      ) : (
        <RowMark project={project} opacity={1} />
      )}
      <AppText
        className={
          props.unsure
            ? "shrink font-t3-medium text-sm text-foreground underline decoration-dotted"
            : "shrink text-sm text-foreground-secondary"
        }
        numberOfLines={1}
      >
        {name}
      </AppText>
      <View className="pl-1">
        <SymbolView
          name={symbol}
          size={symbol === "pencil" ? 11 : 10}
          tintColorClassName="accent-foreground-muted"
          type="monochrome"
        />
      </View>
    </View>
  );
  if (renames)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${NEW_PROJECT_NAME}: ${name}`}
        onPress={() =>
          Dialog.prompt({
            title: NEW_PROJECT_NAME,
            confirmText: "OK",
            initialValue: act.place?.name ?? "",
            onConfirm: (next) => trays.change(id, (tray) => setNewName(tray, act.i, next)),
          })
        }
        className="active:opacity-70"
      >
        {trigger("pencil")}
      </Pressable>
    );
  return (
    <Menu
      title="Project"
      actions={props.places.map((each) => ({
        id: each.id,
        title: each.name,
        state: each.id === act.place?.id ? ("on" as const) : ("off" as const),
      }))}
      onPressAction={({ nativeEvent }) => {
        const picked = props.places.find((each) => each.id === nativeEvent.event);
        if (picked !== undefined)
          trays.change(id, (tray) => setPlace(tray, act.i, { id: picked.id, name: picked.name }));
      }}
      accessibilityLabel={`Project: ${name}`}
      accessibilityRole="button"
    >
      <Pressable className="active:opacity-70">{trigger("chevron.down")}</Pressable>
    </Menu>
  );
}

/** A waiting task's model and effort: the composer's own control, which opens the composer's own sheet. */
function TaskModel(props: {
  readonly environmentId: string;
  readonly act: StartAct;
  readonly models: ReadonlyArray<ModelEntry>;
  readonly ground: string;
  readonly onPress: () => void;
}) {
  const projectId = projectIdOf(props.act);
  const defaults = useNewCellDefaults(props.environmentId, projectId);
  const selection = selectionOf(props.act, { defaultModel: defaults.model, models: props.models });
  const { option, driver } = useModelChoice(props.environmentId, projectId, selection);
  return (
    <View className="min-w-0 shrink">
      <ComposerModelControl
        modelOption={option}
        selection={selection}
        provider={driver}
        prompt=""
        surfaceColor={props.ground}
        onPress={props.onPress}
      />
    </View>
  );
}

/** The exact words the Cell is sent, the risky phrases marked. */
function Told(props: { readonly act: StartAct }) {
  return (
    <View className="mt-1 gap-1 rounded-xl bg-subtle px-3 py-2">
      <AppText className="text-xs text-foreground-muted">{TOLD}</AppText>
      <AppText className="text-sm text-foreground-secondary" selectable>
        {messageSpans(props.act).map((span, index) =>
          span.risky ? (
            // oxlint-disable-next-line react/no-array-index-key -- spans have no identity but their place
            <AppText key={index} className="font-t3-medium text-sm text-warning-foreground">
              {span.text}
            </AppText>
          ) : (
            span.text
          ),
        )}
      </AppText>
    </View>
  );
}

/** The line making room as its Cell forms at the row's start: once, by a transform. */
const makesRoom = (delay: number) =>
  new Keyframe({
    0: { transform: [{ translateX: -(CELL.width + GAP) }] },
    100: { transform: [{ translateX: 0 }], easing: MOVE.easing },
  })
    .duration(MOVE.duration)
    .delay(delay);

/** Under Reduce Motion the row changes in a cross-fade. */
const fadesIn = () => FadeIn.duration(ENTER.duration).reduceMotion(ReduceMotion.Never);

/** A Cell that was sent: its creature at the row's start once it is one, and how it stands. */
function Sent(props: RowProps) {
  const { one, id, open } = props;
  const act = one.act;
  const reduced = useReducedMotion();
  const cell = one.status === "starting" || one.status === "started";
  const thread = useThreadShellsSelected((shells) =>
    cell
      ? (shells.find(
          (shell) => shell.id === act.threadId && shell.environmentId === props.environmentId,
        ) ?? null)
      : null,
  );
  const projectId = projectIdOf(act);
  const project =
    useProjects().find(
      (each) => each.environmentId === props.environmentId && String(each.id) === projectId,
    ) ?? null;
  // Sent from here it forms at its turn; started by the server or another device, as its chat begins.
  const forms =
    formsAt(id, act.i) ?? (thread === null ? undefined : formingFrom(thread.id, thread.createdAt));
  const now = clockSeconds();
  // It plays only as it is sent in sight: seen later, or again, it stands.
  const plays = cell && forms !== undefined && now - forms < LATE;
  const enters = !plays
    ? undefined
    : reduced
      ? fadesIn()
      : makesRoom(Math.max(0, (forms - now) * 1000));
  // A Cell just started here is flying before its machine's next reading says so.
  const word =
    props.says.word !== ""
      ? props.says.word
      : one.status === "started" && props.back
        ? STATUS_WORDS.started
        : "";
  const line = props.says.line ?? "";
  return (
    <View className="gap-1 px-4 py-2.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${act.title}. ${open ? HIDE_MESSAGE : SHOW_MESSAGE}`}
        accessibilityState={{ expanded: open }}
        onPress={props.onFlip}
        className="active:opacity-70"
      >
        <RowShell
          className="flex-row items-center gap-2"
          style={{ minHeight: CELL.height }}
          creature={
            cell ? (
              <Animated.View entering={plays && reduced ? fadesIn() : undefined}>
                <RowCreature
                  threadId={act.threadId}
                  thread={thread}
                  formingFrom={reduced ? undefined : forms}
                />
              </Animated.View>
            ) : null
          }
          trailing={<Trailing word={word} danger={one.status === "failed"} open={open} />}
        >
          <Animated.View entering={enters} className="flex-row items-center">
            {project === null ? null : <RowMark project={project} />}
            <AppText
              className={`${ROW_TITLE} shrink ${cell ? "text-foreground" : "text-foreground-muted"}`}
              numberOfLines={1}
            >
              {act.title}
            </AppText>
          </Animated.View>
        </RowShell>
      </Pressable>
      {/* Its Cell's own line once it has one; until then where and on what it flies. */}
      <AppText className="text-xs text-foreground-muted" numberOfLines={2}>
        {line !== ""
          ? line
          : `${placeLabel(act)} · ${modelLine(act, props.models, props.apart).text}`}
      </AppText>
      {one.status === "failed" && one.reason !== undefined ? (
        <AppText className="text-xs text-danger-foreground">{one.reason}</AppText>
      ) : null}
      {props.says.stuck !== null ? (
        <AppText className="text-xs text-warning-foreground">{props.says.stuck}</AppText>
      ) : null}
      {props.children}
      {one.status === "queued" ? (
        <View className="flex-row justify-end gap-2 pt-1">
          <Pill
            filled={false}
            title={DROP}
            onPress={() => trays.change(id, (tray) => drop(tray, act.i))}
          />
          {props.blocked ? null : (
            <Pill
              filled={false}
              title={START_NOW}
              onPress={() => planCarrier().startNow(id, act.i)}
            />
          )}
        </View>
      ) : props.back ? (
        // The hand that sent it is still there to take it back.
        <View className="flex-row justify-end pt-1">
          <Pill
            filled={false}
            title={CALL_BACK}
            onPress={() => void planCarrier().callBack(id, act.i)}
          />
        </View>
      ) : null}
    </View>
  );
}
