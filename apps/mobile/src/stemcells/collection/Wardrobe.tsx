// The wardrobe on the phone, as the Mac's (`apps/web/src/stemcells/collection/Wardrobe.tsx`): a
// dressing room where the person puts what the feats unlocked on a Cell and watches an act.
// One Cell here is alive, the one on the stage; every other stands still.

import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { CellFigure } from "../cell/CellFigure";
import { cellNameOf, clockSeconds, moment, play } from "../cell/kit";
import type { NeedsConnection } from "../line/read";
import { useThemeAppearance, useThreadShellsSelected } from "../upstream/cells";
import { AppText } from "../upstream/disk";
import { CellMini, useCellDriver, useLookOf } from "./CellMini";
import { CellStill } from "./CellStill";
import { cellsToDress } from "./crew";
import {
  actsToShow,
  actWords,
  COLLECTION,
  type Collection,
  FEAT_ACTS,
  rewardShort,
  standings,
  toggled,
  unlockedPieces,
  wornIdOf,
} from "./kit";
import { Chip, Section, STAND_IN } from "./parts";
import { wear } from "./read";

const stageName = (threadId: string | null): string => `stage:${threadId ?? STAND_IN}`;

/** The Cell on the stage: alive, in what it wears now, under a name of its own so an act shown here plays here alone. */
function Stage(props: {
  readonly name: string;
  readonly look: readonly string[];
  readonly driver: string | null;
}) {
  const ground = useThemeAppearance() === "light" ? "light" : "black";
  const inFront = useIsFocused();
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
        held={!inFront}
      />
    </View>
  );
}

/** Where the person dresses a Cell in what the feats unlocked, and has it show an act. */
export function Wardrobe(props: {
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
