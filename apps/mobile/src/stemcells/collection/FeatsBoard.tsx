// The feats on a screen as wide as the Duo's, from `FeatsView`'s read and parts: beside, where
// the crew stands (summary, ranks, next up); across, every ladder as a track with its rungs as
// stops, so how far each has come and what the next takes read in one look, then the secrets
// (`stemcells/tasks/duo-collection.md`).

import { useState } from "react";
import { Pressable, View } from "react-native";

import type { MachineConnection } from "../upstream/machines";
import { AppText, SymbolView } from "../upstream/disk";
import { NextCard, RewardCell, Rung, SecretTile, Summary, useFreshFeats } from "./FeatsView";
import { BAR, HUES, NEW_DOT } from "./hues";
import {
  COLLECTION,
  type Collection,
  type Ladder,
  ladderName,
  ladderProgress,
  laddersOf,
  nextUp,
  RANK_NAMES,
  RANKS,
  rankOf,
  rungMark,
  secretsOf,
  SEGMENT_ABOUT,
  SEGMENT_NAMES,
  SEGMENTS,
  type Standing,
  tallyOf,
  trackOf,
} from "./kit";
import { NUMBERS, Section } from "./parts";

/** The side column's width: the summary's ring and words, and a next-up card, at ease. */
const SIDE = 320;
/** A ladder's name and count, before its track. */
const LABEL = 148;
/** A stop's mark under the track, centred on its node. */
const MARK = 44;

const percent = (part: number) =>
  `${Math.round(Math.min(1, Math.max(0, part)) * 1000) / 10}%` as const;

export function FeatsBoard(props: {
  readonly environmentId: string;
  readonly connection: MachineConnection | null;
  readonly collection: Collection;
}) {
  const { environmentId, collection } = props;
  const ladders = laddersOf(collection.feats);
  const secrets = secretsOf(collection.feats);
  const fresh = useFreshFeats(props);
  const tally = tallyOf(collection.feats);
  const near = nextUp(ladders);
  return (
    <View className="flex-row items-start gap-6">
      <View className="gap-6" style={{ width: SIDE }}>
        <Summary
          environmentId={environmentId}
          tally={tally}
          today={collection.today}
          backfilled={collection.backfilled}
        />
        <Ranks earned={tally.all.earned} />
        <Section title={COLLECTION.nextUp}>
          {near.length === 0 ? (
            <AppText className="px-2 text-sm text-foreground-muted">
              {COLLECTION.nextUpNone}
            </AppText>
          ) : (
            <View className="gap-2">
              {near.map((ladder) => (
                <NextCard key={ladder.measure} ladder={ladder} fill />
              ))}
            </View>
          )}
        </Section>
      </View>
      <View className="min-w-0 flex-1 gap-6">
        {SEGMENTS.map((segment) => {
          const count = tally.segments.find((each) => each.segment === segment);
          return (
            <Section
              key={segment}
              title={SEGMENT_NAMES[segment]}
              trailing={
                <AppText className="shrink text-xs text-foreground-muted" numberOfLines={1}>
                  {SEGMENT_ABOUT[segment]}
                  {count === undefined ? "" : `  ·  ${COLLECTION.count(count.earned, count.of)}`}
                </AppText>
              }
            >
              <View className="overflow-hidden rounded-2xl bg-grouped-card">
                {ladders
                  .filter((ladder) => ladder.segment === segment)
                  .map((ladder, n) => (
                    <TrackRow key={ladder.measure} ladder={ladder} fresh={fresh} first={n === 0} />
                  ))}
              </View>
            </Section>
          );
        })}
        <Section title={COLLECTION.secrets}>
          <View className="-m-1 flex-row flex-wrap">
            {secrets.map((standing) => (
              <View key={standing.feat.id} className="w-1/2 p-1">
                <SecretTile standing={standing} fresh={fresh.has(standing.feat.id)} />
              </View>
            ))}
          </View>
        </Section>
      </View>
    </View>
  );
}

/** A stop on a track: earned (in its hue), the one being climbed (ringed), or ahead (an outline). */
interface Stop {
  readonly key: string;
  /** Where it stands along the track, 0 to 1. */
  readonly at: number;
  readonly mark: string;
  readonly state: "earned" | "next" | "ahead";
  /** An earned stop's fill. */
  readonly fill: string;
}

/** A line filled as far as `part`, its stops on it, each one's mark under it. */
function Track(props: { readonly part: number; readonly stops: ReadonlyArray<Stop> }) {
  return (
    <View style={{ height: 34, marginHorizontal: MARK / 2 - 6 }}>
      <View className={`absolute inset-x-0 h-[3px] rounded-full ${BAR.track}`} style={{ top: 6 }} />
      <View
        className={`absolute left-0 h-[3px] rounded-full ${BAR.fill}`}
        style={{ top: 6, width: percent(props.part) }}
      />
      {props.stops.map((stop) => (
        <View
          key={stop.key}
          className="absolute items-center gap-1"
          style={{ left: percent(stop.at), top: 0, width: MARK, marginLeft: -MARK / 2 }}
        >
          <View className="size-[15px] items-center justify-center">
            {stop.state === "earned" ? (
              <View className={`size-[11px] rounded-full ${stop.fill}`} />
            ) : stop.state === "next" ? (
              <View className="size-[13px] rounded-full border-2 border-foreground bg-grouped-card" />
            ) : (
              <View className="size-[9px] rounded-full border border-foreground-muted/60 bg-grouped-card" />
            )}
          </View>
          <AppText
            className={`text-3xs ${
              stop.state === "next" ? "font-t3-bold text-foreground" : "text-foreground-muted"
            }`}
            style={NUMBERS}
            numberOfLines={1}
          >
            {stop.mark}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** A ladder's rungs as stops, evenly apart, the last at the track's end. */
function stopsOf(ladder: Ladder): Stop[] {
  return ladder.rungs.map(({ feat, state }, n) => ({
    key: feat.id,
    at: (n + 1) / ladder.rungs.length,
    mark: rungMark(ladder, feat.of),
    state: state.earned !== null ? "earned" : ladder.next?.feat.id === feat.id ? "next" : "ahead",
    fill: HUES[feat.rarity].fill,
  }));
}

/** One ladder across the board: what it last unlocked, its name and count, its track; it opens on its rungs. */
function TrackRow(props: {
  readonly ladder: Ladder;
  readonly fresh: ReadonlySet<string>;
  readonly first: boolean;
}) {
  const { ladder } = props;
  const [open, setOpen] = useState(false);
  let held: Standing | undefined;
  for (const rung of ladder.rungs) if (rung.state.earned !== null) held = rung;
  const shown = held ?? ladder.rungs[0]!;
  const isNew = ladder.rungs.some(({ feat }) => props.fresh.has(feat.id));
  return (
    <View className={props.first ? "" : "border-t border-border"}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${ladderName(ladder)}. ${COLLECTION.rung(ladder.earned, ladder.rungs.length)}. ${ladderProgress(ladder)}`}
        onPress={() => setOpen(!open)}
        className="min-h-16 flex-row items-center gap-3 px-4 py-3 active:opacity-70"
      >
        <View className="w-10 items-center">
          <RewardCell feat={shown.feat} earned={held !== undefined} points={2} />
        </View>
        <View className="gap-0.5" style={{ width: LABEL }}>
          <View className="flex-row items-center gap-2">
            <AppText className="shrink text-sm font-t3-medium text-foreground" numberOfLines={1}>
              {ladderName(ladder)}
            </AppText>
            {isNew ? <View className={`size-1.5 rounded-full ${NEW_DOT}`} /> : null}
          </View>
          <AppText className="text-xs text-foreground-muted" style={NUMBERS} numberOfLines={1}>
            {ladderProgress(ladder)}
          </AppText>
        </View>
        <View className="min-w-0 flex-1 pt-3">
          <Track part={trackOf(ladder)} stops={stopsOf(ladder)} />
        </View>
        <SymbolView
          name={open ? "chevron.up" : "chevron.down"}
          size={12}
          tintColorClassName="accent-icon-muted"
          type="monochrome"
        />
      </Pressable>
      {open ? (
        <View className="flex-row flex-wrap px-3 pb-3">
          {ladder.rungs.map((standing) => (
            <View key={standing.feat.id} className="w-1/2 p-1">
              <Rung standing={standing} fresh={props.fresh.has(standing.feat.id)} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The climb through the ranks, the first at no feats: where the crew stands on the whole of it, the next rank ringed as a ladder's next rung is. */
function Ranks(props: { readonly earned: number }) {
  const { rank } = rankOf(props.earned);
  const last = RANKS.length - 1;
  const from = RANKS[rank]!;
  const to = RANKS[rank + 1];
  const part = to === undefined ? 1 : (rank + (props.earned - from) / (to - from)) / last;
  return (
    <View
      accessible
      accessibilityLabel={`${RANK_NAMES[rank]}, ${rank + 1} of ${RANKS.length}`}
      className="gap-2 rounded-2xl bg-grouped-card px-4 pt-4 pb-3"
    >
      <View className="flex-row items-baseline justify-between">
        <AppText className="text-xs font-t3-medium text-foreground">{RANK_NAMES[0]}</AppText>
        <AppText className="text-xs font-t3-medium text-foreground-muted">
          {RANK_NAMES[last]}
        </AppText>
      </View>
      <Track
        part={part}
        stops={RANKS.map((at, n) => ({
          key: String(at),
          at: n / last,
          mark: String(at),
          state: n <= rank ? "earned" : n === rank + 1 ? "next" : "ahead",
          fill: BAR.fill,
        }))}
      />
    </View>
  );
}
