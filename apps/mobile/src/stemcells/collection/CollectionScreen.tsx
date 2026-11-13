// Settings › Collection on the phone, as the Mac's (`apps/web/src/stemcells/collection/
// CollectionSettings.tsx`): one machine's day so far, a dressing room where the person puts what
// the feats unlocked on a Cell and watches an act, and every feat with how far along it is. One
// Cell on the screen is alive, the one on the stage; every other stands still and costs no frame.

import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect, useEffectEvent, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CellFigure } from "../cell/CellFigure";
import { cellNameOf, clockSeconds, moment, play } from "../cell/kit";
import type { NeedsConnection } from "../line/read";
import { needsConnectionOf } from "../line/readings";
import { useThemeAppearance, useThreadShellsSelected } from "../upstream/cells";
import {
  AppText,
  ScreenScrollView,
  SettingsScreen,
  SymbolView,
  useMachines,
} from "../upstream/disk";
import { useSavedRemoteConnections } from "../upstream/push";
import { CellMini, useCellDriver, useLookOf } from "./CellMini";
import { CellStill } from "./CellStill";
import { cellsToDress } from "./crew";
import { HUES, NEW_DOT } from "./hues";
import {
  actsToShow,
  actWords,
  COLLECTION,
  type Collection,
  FEAT_ACTS,
  featName,
  featProgress,
  featTakes,
  RARITY_NAMES,
  rewardLine,
  rewardShort,
  SECRET,
  type Standing,
  standings,
  type Today,
  todayCounts,
  toggled,
  unlockedPieces,
  wornIdOf,
} from "./kit";
import { markSeen, readCollectionOf, useCollections, wear } from "./read";

type Machine = ReturnType<typeof useMachines>[number];

/** A Cell that stands in on a tile: no chat's, so its look is only what the tile gives it. */
const STAND_IN = "collection";

const NUMBERS = { fontVariant: ["tabular-nums" as const] };

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const machines = useMachines();
  const collections = useCollections();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const [picked, setPicked] = useState<string | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read each machine's collection as the screen opens, and again once a route hands the phone its token.
  useEffect(() => {
    for (const saved of Object.values(savedConnectionsById))
      void readCollectionOf(saved.environmentId, needsConnectionOf(saved), Date.now(), fetch, true);
  }, [savedConnectionsById]);

  const having = machines.filter(
    (machine) => machine.connection === "connected" && collections.has(machine.environmentId),
  );
  const shown = having.find((machine) => machine.environmentId === picked) ?? having[0];
  const collection = shown === undefined ? undefined : collections.get(shown.environmentId);
  const saved = Object.values(savedConnectionsById).find(
    (each) => each.environmentId === shown?.environmentId,
  );
  const connection = saved === undefined ? null : needsConnectionOf(saved);
  return (
    <SettingsScreen title={COLLECTION.title}>
      <ScreenScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentInset={{ bottom: Math.max(insets.bottom, 18) }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pt-4 pb-[18px]"
      >
        {shown === undefined || collection === undefined ? (
          <AppText className="px-2 text-sm text-foreground-muted">{COLLECTION.reading}</AppText>
        ) : (
          <>
            {having.length > 1 ? (
              <MachinePicker machines={having} shown={shown.environmentId} onPick={setPicked} />
            ) : null}
            <TodayStrip environmentId={shown.environmentId} today={collection.today} />
            <DressingRoom
              key={`room:${shown.environmentId}`}
              environmentId={shown.environmentId}
              connection={connection}
              collection={collection}
            />
            <Feats
              key={`feats:${shown.environmentId}`}
              environmentId={shown.environmentId}
              connection={connection}
              collection={collection}
            />
          </>
        )}
      </ScreenScrollView>
    </SettingsScreen>
  );
}

function Section(props: {
  readonly title: string;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3 px-2">
        <AppText
          textRole="footnote"
          accessibilityRole="header"
          className="shrink font-t3-medium text-foreground-muted"
        >
          {props.title}
        </AppText>
        {props.trailing}
      </View>
      {props.children}
    </View>
  );
}

/** One of a row to pick from: a machine, or a Cell to dress. */
function Chip(props: {
  readonly on: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.on }}
      accessibilityLabel={props.label}
      onPress={props.onPress}
      className={`min-h-11 flex-row items-center gap-2 rounded-full border px-3.5 active:opacity-70 ${
        props.on ? "border-transparent bg-subtle-strong" : "border-border"
      }`}
    >
      {props.children}
      <AppText
        className={`text-sm ${props.on ? "font-t3-medium text-foreground" : "text-foreground-muted"}`}
        numberOfLines={1}
      >
        {props.label}
      </AppText>
    </Pressable>
  );
}

/** The collection is one machine's: with several, which one the screen shows. */
function MachinePicker(props: {
  readonly machines: ReadonlyArray<Machine>;
  readonly shown: string;
  readonly onPick: (environmentId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-5 grow-0"
      contentContainerClassName="gap-2 px-5"
    >
      {props.machines.map((machine) => {
        const on = machine.environmentId === props.shown;
        return (
          <Chip
            key={machine.environmentId}
            on={on}
            label={machine.label}
            onPress={() => props.onPick(machine.environmentId)}
          >
            <SymbolView
              name={machine.icon}
              size={16}
              tintColorClassName={on ? "accent-icon" : "accent-icon-muted"}
              type="monochrome"
            />
          </Chip>
        );
      })}
    </ScrollView>
  );
}

/** The day so far: what landed, merged and was born, and the Cells that landed, lined up. */
function TodayStrip(props: { readonly environmentId: string; readonly today: Today }) {
  const { today } = props;
  return (
    <Section title={COLLECTION.today}>
      <View className="flex-row flex-wrap items-end gap-x-7 gap-y-3 px-2">
        {todayCounts(today).map((count) => (
          <View key={count.of} accessible accessibilityLabel={`${count.n} ${count.of}`}>
            <AppText className="text-2xl font-t3-bold text-foreground" style={NUMBERS}>
              {count.n}
            </AppText>
            <AppText className="text-xs text-foreground-muted">{count.of}</AppText>
          </View>
        ))}
      </View>
      {today.landed.length > 0 ? (
        <View
          accessible
          accessibilityLabel={`${COLLECTION.landedToday}: ${today.landed.map(cellNameOf).join(", ")}`}
          className="flex-row flex-wrap items-end gap-x-2 gap-y-3 px-2 pt-2"
        >
          {today.landed.map((threadId) => (
            <CellMini
              key={threadId}
              environmentId={props.environmentId}
              threadId={threadId}
              points={2}
            />
          ))}
        </View>
      ) : null}
    </Section>
  );
}

const stageName = (threadId: string | null): string => `stage:${threadId ?? STAND_IN}`;

/** The Cell on the stage: alive, in what it wears now, under a name of its own so an act shown here plays here alone. */
function Stage(props: {
  readonly name: string;
  readonly look: readonly string[];
  readonly driver: string | null;
}) {
  const ground = useThemeAppearance() === "light" ? "light" : "black";
  return (
    <View
      className="items-center justify-end rounded-2xl bg-screen"
      style={{ minHeight: 132, paddingTop: 24, paddingBottom: 14 }}
    >
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-2xl bg-linear-to-t from-adaptive-sky-600-400/10 to-transparent"
      />
      <CellFigure
        name={props.name}
        mood="awake"
        provider={props.driver}
        look={props.look}
        ground={ground}
        points={6}
        plays
      />
    </View>
  );
}

/** Where the person dresses a Cell in what the feats unlocked, and has it show an act. */
function DressingRoom(props: {
  readonly environmentId: string;
  readonly connection: NeedsConnection | null;
  readonly collection: Collection;
}) {
  const { environmentId, connection, collection } = props;
  const crew = useThreadShellsSelected((threads) =>
    cellsToDress(threads, environmentId)
      .map((thread) => String(thread.id))
      .join(","),
  );
  const cells = crew === "" ? [] : crew.split(",");
  const [picked, setPicked] = useState<string | null>(null);
  const threadId = cells.find((each) => each === picked) ?? cells[0] ?? null;
  const reduced = useReducedMotion();
  // With no Cell to dress the stage holds a stand-in, dressed here alone and never kept.
  const [tried, setTried] = useState<readonly string[]>([]);
  const own = useLookOf(threadId ?? STAND_IN);
  const worn = threadId === null ? tried : (collection.worn[threadId] ?? []);
  const look = threadId === null ? tried : own;
  const driver = useCellDriver(environmentId, threadId);
  const stage = stageName(threadId);

  const unlocked = unlockedPieces(collection.feats);
  const earned = standings(collection).filter(({ state }) => state.earned !== null);
  const pieces = earned.flatMap(({ feat }) => {
    const id = wornIdOf(feat.reward);
    return id !== undefined && unlocked.has(id) ? [{ feat, id }] : [];
  });
  const acts = actsToShow(collection.feats);

  const put = (id: string) => {
    const next = toggled(worn, id);
    const on = next.includes(id);
    void Haptics.selectionAsync();
    if (threadId === null) setTried(next);
    else {
      if (connection !== null) void wear(environmentId, connection, threadId, next);
      if (!reduced && on) moment(threadId, "dressed", clockSeconds());
    }
    if (!reduced && on) play(stage, "act/nod", clockSeconds());
  };
  const reset = () => {
    if (threadId === null) setTried([]);
    else if (connection !== null) void wear(environmentId, connection, threadId, []);
  };

  return (
    <Section title={COLLECTION.dressingRoom}>
      <View className="gap-4 rounded-2xl bg-grouped-card p-4">
        <View className="gap-2">
          <Stage name={stage} look={look} driver={driver} />
          <View className="min-h-11 flex-row items-center justify-between gap-2">
            <AppText className="shrink text-base font-t3-medium text-foreground" numberOfLines={1}>
              {threadId === null ? COLLECTION.noCell : cellNameOf(threadId)}
            </AppText>
            {worn.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={reset}
                className="min-h-11 justify-center pl-3 active:opacity-70"
              >
                <AppText className="text-sm text-primary-text">{COLLECTION.ownLook}</AppText>
              </Pressable>
            ) : null}
          </View>
          {cells.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityLabel={COLLECTION.cellsToDress}
              className="-mx-4 grow-0"
              contentContainerClassName="gap-2 px-4"
            >
              {cells.map((each) => (
                <Chip
                  key={each}
                  on={each === threadId}
                  label={cellNameOf(each)}
                  onPress={() => setPicked(each)}
                >
                  <CellMini environmentId={environmentId} threadId={each} />
                </Chip>
              ))}
            </ScrollView>
          ) : null}
          {threadId === null ? (
            <AppText className="text-xs text-foreground-muted">{COLLECTION.tryOn}</AppText>
          ) : null}
        </View>
        <View className="gap-2">
          <AppText className="text-xs font-t3-medium text-foreground-muted">
            {COLLECTION.toWear}
          </AppText>
          {pieces.length === 0 ? (
            <AppText className="text-sm text-foreground-muted">{COLLECTION.nothingYet}</AppText>
          ) : (
            <View className="flex-row flex-wrap gap-1">
              {pieces.map(({ feat, id }) => {
                const on = worn.includes(id);
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={rewardShort(feat)}
                    onPress={() => put(id)}
                    className={`rounded-2xl border-2 p-0.5 active:opacity-70 ${
                      on ? "border-adaptive-sky-600-400" : "border-transparent"
                    }`}
                  >
                    <View className="w-24 items-center gap-1 rounded-xl border border-border bg-screen px-2 pb-2 pt-3">
                      <CellStill name={STAND_IN} look={[id]} provider={driver} points={3} />
                      <AppText className="text-2xs text-foreground" numberOfLines={1}>
                        {rewardShort(feat)}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
        <View className="gap-2">
          <AppText className="text-xs font-t3-medium text-foreground-muted">
            {COLLECTION.acts(acts.length)}
          </AppText>
          <View className="flex-row flex-wrap gap-x-2 gap-y-2.5">
            {acts.map((each) => (
              <Pressable
                key={each.name}
                accessibilityRole="button"
                accessibilityLabel={actWords(each.name)}
                accessibilityHint={each.about}
                hitSlop={{ top: 5, bottom: 5 }}
                onPress={() => play(stage, `act/${each.name}`, clockSeconds())}
                className={`justify-center rounded-full px-3.5 active:opacity-70 ${
                  FEAT_ACTS.has(each.name) ? "border border-border" : "bg-subtle"
                }`}
                style={{ minHeight: 34 }}
              >
                <AppText
                  className={`text-xs ${
                    FEAT_ACTS.has(each.name) ? "text-foreground" : "text-foreground-muted"
                  }`}
                >
                  {actWords(each.name)}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Section>
  );
}

/** One feat: what it unlocks on a Cell, its name, what it takes, and how far along or when and who. */
function FeatTile(props: { readonly standing: Standing; readonly fresh: boolean }) {
  const { feat, state } = props.standing;
  const earned = state.earned;
  const hidden = feat.rarity === "secret" && earned === null;
  const wornId = wornIdOf(feat.reward);
  const progress = featProgress(feat, state);
  const hue = HUES[feat.rarity];
  const name = hidden ? SECRET.name : featName(feat);
  const takes = hidden ? SECRET.takes : featTakes(feat);
  const when =
    earned === null
      ? null
      : `${dateOf(earned.at)}${earned.threadId === null ? "" : ` · ${cellNameOf(earned.threadId)}`}`;
  return (
    <View
      accessible
      accessibilityLabel={[
        COLLECTION.rarityFeat(RARITY_NAMES[feat.rarity]),
        props.fresh ? COLLECTION.isNew : null,
        name,
        takes,
        when ?? progress,
        hidden ? null : rewardLine(feat),
      ]
        .filter((part) => part !== null)
        .join(". ")}
      className="flex-1 overflow-hidden rounded-2xl bg-grouped-card"
    >
      <View className={`items-center justify-end border-b-2 pb-1.5 pt-3 ${hue.floor}`}>
        {hidden ? (
          <View className="justify-center" style={{ minHeight: 42 }}>
            <AppText className="text-lg font-t3-bold text-foreground-muted">?</AppText>
          </View>
        ) : (
          <CellStill
            name={STAND_IN}
            look={wornId === undefined ? [] : [wornId]}
            points={3}
            scene={feat.reward.kind === "act" ? `act/${feat.reward.id}` : undefined}
            flat={earned === null}
          />
        )}
      </View>
      <View className="flex-1 gap-1 p-2.5">
        <View className="flex-row items-center justify-between gap-2">
          <AppText className={`text-3xs font-t3-bold uppercase tracking-wider ${hue.ink}`}>
            {RARITY_NAMES[feat.rarity]}
          </AppText>
          {props.fresh ? <View className={`size-1.5 rounded-full ${NEW_DOT}`} /> : null}
        </View>
        <AppText className="text-sm font-t3-medium text-foreground">{name}</AppText>
        <AppText className="text-xs text-foreground-muted">{takes}</AppText>
        <View className="mt-auto gap-1 pt-1.5">
          {when !== null ? (
            <AppText className="text-xs text-foreground-muted">{when}</AppText>
          ) : progress !== null ? (
            <>
              <View className={`h-[3px] overflow-hidden rounded-full ${hue.track}`}>
                <View
                  className={`h-full ${hue.fill}`}
                  style={{ width: `${Math.round((state.have / state.of) * 100)}%` }}
                />
              </View>
              <AppText className="text-xs text-foreground-muted" style={NUMBERS}>
                {progress}
              </AppText>
            </>
          ) : null}
          {hidden ? null : (
            <AppText className="text-xs text-foreground-secondary">{rewardLine(feat)}</AppText>
          )}
        </View>
      </View>
    </View>
  );
}

function Feats(props: {
  readonly environmentId: string;
  readonly connection: NeedsConnection | null;
  readonly collection: Collection;
}) {
  const { environmentId, connection, collection } = props;
  const all = standings(collection);
  const earned = all.filter(({ state }) => state.earned !== null);
  // What is new while the screen is open stays marked, a read that lands after it opened too,
  // and is noted seen as it closes.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const unseen = earned
    .map(({ feat }) => feat.id)
    .filter((id) => !collection.seen.includes(id) && !fresh.has(id));
  if (unseen.length > 0) setFresh(new Set([...fresh, ...unseen]));
  const leave = useEffectEvent(() => {
    if (connection !== null) markSeen(environmentId, connection, [...fresh]);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Note the feats shown here as seen on the machine when the screen closes.
  useEffect(() => () => leave(), []);
  return (
    <Section
      title={COLLECTION.feats(earned.length, all.length)}
      trailing={
        collection.backfilled ? null : (
          <AppText className="text-xs text-foreground-muted">{COLLECTION.backfilling}</AppText>
        )
      }
    >
      <View className="-m-1 flex-row flex-wrap">
        {all.map((standing) => (
          <View key={standing.feat.id} className="w-1/2 p-1">
            <FeatTile standing={standing} fresh={fresh.has(standing.feat.id)} />
          </View>
        ))}
      </View>
    </Section>
  );
}
