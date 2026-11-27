// A plan's rows (stemcells/tasks/aski-orchestrator.md, decisions 4, 5 and 12), the same over
// Aski's composer and in a ```plan fence. A Cell's row says its name, model, project and title;
// one that waits says why, marks the field Aski was unsure of, and opens to every word the Cell
// will be told. A deletion is a card of its own (`HoldCard.tsx`).

import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";

import type { ModelEntry, PlaceEntry } from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  CALL_BACK_MS,
  callable,
  canStart,
  confirm,
  confirmAll,
  drop,
  dropAll,
  held,
  setNewName,
  setPlace,
  type TrayAct,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import { cellNameOf } from "../../../../../../stemcells/words/cellNames.ts";
import {
  CALL_BACK,
  DICTATED,
  DROP,
  LEFT_OVER,
  placeLabel,
  START,
  START_ALL,
} from "../../../../../../stemcells/words/plans.ts";
import { Pill } from "../../line/Ask";
import { useThreadShellsSelected } from "../../upstream/cells";
import { AppText, Dialog, Menu, SymbolView } from "../../upstream/plans";
import { HoldCard } from "./HoldCard";
import { planCarrier, trays } from "./run";
import type { PlanEntry } from "./trays";
import {
  CLOSE_PLAN,
  headOf,
  HIDE_MESSAGE,
  messageSpans,
  modelLine,
  NEW_PROJECT_NAME,
  SHOW_MESSAGE,
  STATUS_WORDS,
  unsureOf,
  whyLines,
} from "./view";

/** The plans the phone holds; a view draws again when any of them changes. */
export function usePlans(): ReadonlyMap<string, PlanEntry> {
  return useSyncExternalStore(trays.subscribe, trays.read, trays.read);
}

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
  if (tray === null) return null;
  const exists = new Set(here === "" ? [] : here.split(",").map(Number));
  const head = headOf(tray);
  const back = new Set(callable(tray, now).map((one) => one.act.i));
  const blocked = held(tray);
  const leftOver = tray.plan.leftOver
    .map((n) => tray.plan.pieces.find((piece) => piece.n === n)?.text ?? "")
    .filter((text) => text.length > 0)
    .join(" ");
  return (
    <View>
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
          {head.startAll ? (
            <Pill filled title={START_ALL} onPress={() => trays.change(entry.id, confirmAll)} />
          ) : null}
          {entry.door === "composer" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CLOSE_PLAN}
              hitSlop={12}
              onPress={() => {
                trays.change(entry.id, dropAll);
                trays.leave(entry.id);
              }}
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
        <View
          key={one.act.i}
          className={index > 0 || head.line !== null ? "border-t border-border-subtle" : undefined}
        >
          {one.act.kind === "destroy" ? (
            <HoldCard
              act={one.act}
              status={one.status === "done" || one.status === "dropped" ? one.status : "waiting"}
              refused={entry.refused.get(one.act.i) ?? null}
              onHeld={() => void planCarrier().destroy(entry.id, one.act.i)}
              onDrop={() => trays.change(entry.id, (next) => drop(next, one.act.i))}
            />
          ) : (
            <CellRow
              id={entry.id}
              one={one}
              started={exists.has(one.act.i)}
              blocked={blocked}
              back={back.has(one.act.i)}
              places={props.places}
              models={props.models}
              open={props.open}
            />
          )}
        </View>
      ))}
      {leftOver.length > 0 ? (
        <AppText className="border-t border-border-subtle px-4 py-2 text-xs text-foreground-muted">
          {LEFT_OVER(leftOver)}
        </AppText>
      ) : null}
    </View>
  );
}

function CellRow(props: {
  readonly id: string;
  readonly one: TrayAct;
  /** Its Cell is already in the app. */
  readonly started: boolean;
  /** A deletion is held: nothing starts before it. */
  readonly blocked: boolean;
  /** It started within the last ten seconds: one tap stops and archives it. */
  readonly back: boolean;
  readonly places: ReadonlyArray<PlaceEntry>;
  readonly models: ReadonlyArray<ModelEntry>;
  readonly open: boolean;
}) {
  const { one, id } = props;
  const act = one.act;
  const risky = act.kind === "start" && act.risks.length > 0;
  const [open, setOpen] = useState(props.open || risky);
  if (act.kind !== "start") return null;
  const waiting = one.status === "waiting" && !props.started;
  const status = props.started && one.status === "waiting" ? "started" : one.status;
  const model = modelLine(act, props.models);
  const unsure = waiting ? unsureOf(act) : { place: false, model: false };
  const place = placeLabel(act);
  const renames = waiting && act.place?.how === "new";
  const rename = () =>
    Dialog.prompt({
      title: NEW_PROJECT_NAME,
      confirmText: "OK",
      initialValue: act.place?.name ?? "",
      onConfirm: (name) => trays.change(id, (tray) => setNewName(tray, act.i, name)),
    });
  const placeWords = (
    <AppText
      className={
        unsure.place
          ? "font-t3-medium text-sm text-foreground underline decoration-dotted"
          : "text-sm text-foreground-secondary"
      }
      numberOfLines={1}
    >
      {place}
    </AppText>
  );
  return (
    <View className="gap-1 px-4 py-2.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? HIDE_MESSAGE : SHOW_MESSAGE}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="gap-0.5 active:opacity-70"
      >
        <View className="flex-row items-center gap-2">
          <AppText className="font-t3-bold text-sm text-foreground">
            {cellNameOf(act.threadId)}
          </AppText>
          <AppText
            className={
              unsure.model
                ? "flex-1 text-xs text-foreground underline decoration-dotted"
                : model.dim
                  ? "flex-1 text-xs text-foreground-tertiary"
                  : "flex-1 text-xs text-foreground-muted"
            }
            numberOfLines={1}
          >
            {model.text}
          </AppText>
          {waiting ? null : (
            <AppText
              className={
                status === "failed"
                  ? "text-xs text-danger-foreground"
                  : "text-xs text-foreground-muted"
              }
            >
              {STATUS_WORDS[status as keyof typeof STATUS_WORDS]}
            </AppText>
          )}
          <SymbolView
            name={open ? "chevron.up" : "chevron.down"}
            size={10}
            tintColorClassName="accent-foreground-muted"
            type="monochrome"
          />
        </View>
        <AppText
          className={
            waiting ? "text-sm text-foreground-secondary" : "text-sm text-foreground-muted"
          }
          numberOfLines={open ? undefined : 1}
        >
          {act.title}
        </AppText>
      </Pressable>
      <View className="flex-row items-center gap-1.5">
        <AppText className="text-xs text-foreground-muted">in</AppText>
        {waiting && !renames ? (
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
                trays.change(id, (tray) =>
                  setPlace(tray, act.i, { id: picked.id, name: picked.name }),
                );
            }}
            accessibilityLabel={`Project: ${place}`}
            accessibilityRole="button"
          >
            <Pressable hitSlop={10} className="flex-row items-center gap-1 active:opacity-70">
              {placeWords}
              <SymbolView
                name="chevron.down"
                size={10}
                tintColorClassName="accent-foreground-muted"
                type="monochrome"
              />
            </Pressable>
          </Menu>
        ) : renames ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${NEW_PROJECT_NAME}: ${place}`}
            hitSlop={10}
            onPress={rename}
            className="flex-row items-center gap-1 active:opacity-70"
          >
            {placeWords}
            <SymbolView
              name="pencil"
              size={11}
              tintColorClassName="accent-foreground-muted"
              type="monochrome"
            />
          </Pressable>
        ) : (
          placeWords
        )}
      </View>
      {one.status === "failed" && one.reason !== undefined ? (
        <AppText className="text-xs text-danger-foreground">{one.reason}</AppText>
      ) : null}
      {open ? (
        <View className="mt-1 rounded-xl bg-subtle px-3 py-2">
          <AppText className="text-sm text-foreground-secondary" selectable>
            {messageSpans(act).map((span, index) =>
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
      ) : null}
      {waiting ? (
        <View className="flex-row items-end gap-2 pt-1">
          <View className="flex-1 gap-0.5">
            {whyLines(act, props.blocked).map((line) => (
              <View key={line} className="flex-row items-center gap-1.5">
                <View className="size-1.5 rounded-full bg-stage-input" />
                <AppText className="flex-1 text-xs text-foreground-secondary">{line}</AppText>
              </View>
            ))}
          </View>
          <Pill
            filled={false}
            title={DROP}
            onPress={() => trays.change(id, (tray) => drop(tray, act.i))}
          />
          <StartPill
            enabled={canStart(act) && !props.blocked}
            onPress={() => trays.change(id, (tray) => confirm(tray, act.i))}
          />
        </View>
      ) : props.back ? (
        // Where Start was: the hand that started it is still there to take it back.
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

/** Start, dim while the Cell has nowhere to start or a deletion is held. */
function StartPill(props: { readonly enabled: boolean; readonly onPress: () => void }) {
  return (
    <View
      className={props.enabled ? undefined : "opacity-40"}
      pointerEvents={props.enabled ? "auto" : "none"}
      accessibilityState={{ disabled: !props.enabled }}
    >
      <Pill filled title={START} onPress={props.onPress} />
    </View>
  );
}
