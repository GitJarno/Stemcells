// The feats on the phone, as the Mac's (`apps/web/src/stemcells/collection/FeatsView.tsx`): the
// summary first (how many are earned and the rank that makes, each segment's share, the day so
// far), then the rungs nearest earned, then one row a ladder, which opens on its rungs; the
// secrets last and apart. Every Cell here stands still.

import { useEffect, useEffectEvent, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import { cellNameOf } from "../cell/kit";
import type { NeedsConnection } from "../line/read";
import { AppText, SymbolView } from "../upstream/disk";
import { CellMini } from "./CellMini";
import { CellStill } from "./CellStill";
import { BAR, HUES, NEW_DOT } from "./hues";
import {
  COLLECTION,
  type Collection,
  type Feat,
  featName,
  featTakes,
  type Ladder,
  ladderName,
  ladderProgress,
  laddersOf,
  nextUp,
  RANK_NAMES,
  RARITY_NAMES,
  rankLine,
  rankOf,
  reachOf,
  rewardLine,
  SECRET,
  secretsOf,
  SEGMENT_ABOUT,
  SEGMENT_NAMES,
  SEGMENTS,
  type Standing,
  type Tally,
  tallyOf,
  type Today,
  todayCounts,
  wornIdOf,
} from "./kit";
import { dateOf, NUMBERS, Section, STAND_IN } from "./parts";
import { markSeen } from "./read";

const percent = (part: number) => `${Math.round(Math.min(1, Math.max(0, part)) * 100)}%` as const;

/** What a feat unlocks on a Cell held still: in colour once earned, its shape alone until then. */
function RewardCell(props: {
  readonly feat: Feat;
  readonly earned: boolean;
  readonly points: number;
}) {
  const wornId = wornIdOf(props.feat.reward);
  return (
    <CellStill
      name={STAND_IN}
      look={wornId === undefined ? [] : [wornId]}
      points={props.points}
      scene={props.feat.reward.kind === "act" ? `act/${props.feat.reward.id}` : undefined}
      flat={!props.earned}
    />
  );
}

export function FeatsView(props: {
  readonly environmentId: string;
  readonly connection: NeedsConnection | null;
  readonly collection: Collection;
}) {
  const { environmentId, connection, collection } = props;
  const ladders = laddersOf(collection.feats);
  const secrets = secretsOf(collection.feats);
  // What is new while the screen is open stays marked, a read that lands after it opened too,
  // and is noted seen as it closes.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const unseen = collection.feats
    .filter(
      (state) =>
        state.earned !== null && !collection.seen.includes(state.id) && !fresh.has(state.id),
    )
    .map((state) => state.id);
  if (unseen.length > 0) setFresh(new Set([...fresh, ...unseen]));
  const leave = useEffectEvent(() => {
    if (connection !== null) markSeen(environmentId, connection, [...fresh]);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Note the feats shown here as seen on the machine when the screen closes.
  useEffect(() => () => leave(), []);
  const near = nextUp(ladders);
  return (
    <>
      <Summary
        environmentId={environmentId}
        tally={tallyOf(collection.feats)}
        today={collection.today}
        backfilled={collection.backfilled}
      />
      <Section title={COLLECTION.nextUp}>
        {near.length === 0 ? (
          <AppText className="px-2 text-sm text-foreground-muted">{COLLECTION.nextUpNone}</AppText>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-5 grow-0"
            contentContainerClassName="gap-2 px-5"
          >
            {near.map((ladder) => (
              <NextCard key={ladder.measure} ladder={ladder} />
            ))}
          </ScrollView>
        )}
      </Section>
      {SEGMENTS.map((segment) => (
        <Section
          key={segment}
          title={SEGMENT_NAMES[segment]}
          trailing={
            <AppText className="shrink text-xs text-foreground-muted" numberOfLines={1}>
              {SEGMENT_ABOUT[segment]}
            </AppText>
          }
        >
          <View className="overflow-hidden rounded-2xl bg-grouped-card">
            {ladders
              .filter((ladder) => ladder.segment === segment)
              .map((ladder, n) => (
                <LadderRow key={ladder.measure} ladder={ladder} fresh={fresh} first={n === 0} />
              ))}
          </View>
        </Section>
      ))}
      <Section title={COLLECTION.secrets}>
        <View className="-m-1 flex-row flex-wrap">
          {secrets.map((standing) => (
            <View key={standing.feat.id} className="w-1/2 p-1">
              <SecretTile standing={standing} fresh={fresh.has(standing.feat.id)} />
            </View>
          ))}
        </View>
      </Section>
    </>
  );
}

const RING = { size: 88, stroke: 6, radius: 34 };

/** A ring filled as far as `part` of it is done, its number in the middle. */
function Ring(props: { readonly part: number; readonly n: number; readonly of: number }) {
  const hue = useResolveClassNames("text-foreground").color;
  const round = 2 * Math.PI * RING.radius;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={COLLECTION.feats(props.n, props.of)}
      className="items-center justify-center"
      style={{ width: RING.size, height: RING.size }}
    >
      <Svg
        width={RING.size}
        height={RING.size}
        viewBox="0 0 80 80"
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={40}
          cy={40}
          r={RING.radius}
          fill="none"
          stroke={hue}
          strokeOpacity={0.16}
          strokeWidth={RING.stroke}
        />
        <Circle
          cx={40}
          cy={40}
          r={RING.radius}
          fill="none"
          stroke={hue}
          strokeWidth={RING.stroke}
          strokeLinecap="round"
          strokeDasharray={`${round * Math.min(1, props.part)} ${round}`}
        />
      </Svg>
      <AppText className="text-2xl font-t3-bold text-foreground" style={NUMBERS}>
        {props.n}
      </AppText>
      <AppText className="text-2xs text-foreground-muted" style={NUMBERS}>
        of {props.of}
      </AppText>
    </View>
  );
}

/** The whole collection in one look: feats earned, the rank they make, each segment, and today. */
function Summary(props: {
  readonly environmentId: string;
  readonly tally: Tally;
  readonly today: Today;
  readonly backfilled: boolean;
}) {
  const { tally, today } = props;
  const { rank, toNext } = rankOf(tally.all.earned);
  const next = rankLine(rank, toNext);
  return (
    <View className="gap-4 rounded-2xl bg-grouped-card p-4">
      <View className="flex-row items-center gap-4">
        <Ring part={tally.all.earned / tally.all.of} n={tally.all.earned} of={tally.all.of} />
        <View className="min-w-0 flex-1 gap-0.5">
          <AppText className="text-lg font-t3-bold text-foreground">{RANK_NAMES[rank]}</AppText>
          {next === null ? null : (
            <AppText className="text-xs text-foreground-muted">{next}</AppText>
          )}
          {tally.secrets > 0 ? (
            <AppText className={`text-xs ${HUES.secret.ink}`}>
              {COLLECTION.secretsFound(tally.secrets)}
            </AppText>
          ) : null}
          {props.backfilled ? null : (
            <AppText className="text-xs text-foreground-muted">{COLLECTION.backfilling}</AppText>
          )}
        </View>
      </View>
      <View className="gap-2">
        {tally.segments.map((each) => (
          <View
            key={each.segment}
            accessible
            accessibilityLabel={`${SEGMENT_NAMES[each.segment]}: ${COLLECTION.count(each.earned, each.of)}`}
            className="flex-row items-center gap-3"
          >
            <AppText className="w-12 text-xs text-foreground">
              {SEGMENT_NAMES[each.segment]}
            </AppText>
            <View className={`h-[3px] flex-1 overflow-hidden rounded-full ${BAR.track}`}>
              <View
                className={`h-full ${BAR.fill}`}
                style={{ width: percent(each.earned / each.of) }}
              />
            </View>
            <AppText className="w-14 text-right text-xs text-foreground-muted" style={NUMBERS}>
              {COLLECTION.count(each.earned, each.of)}
            </AppText>
          </View>
        ))}
      </View>
      <View className="gap-2 border-t border-border pt-3">
        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
          <AppText className="text-xs font-t3-medium text-foreground-muted">
            {COLLECTION.today}
          </AppText>
          {todayCounts(today).map((count) => (
            <AppText key={count.of} className="text-xs text-foreground-muted" style={NUMBERS}>
              <AppText className="text-xs font-t3-medium text-foreground">{count.n}</AppText>{" "}
              {count.of}
            </AppText>
          ))}
        </View>
        {today.landed.length > 0 ? (
          <View
            accessible
            accessibilityLabel={`${COLLECTION.landedToday}: ${today.landed.map(cellNameOf).join(", ")}`}
            className="flex-row flex-wrap items-end gap-1.5"
          >
            {today.landed.slice(0, 12).map((threadId) => (
              <CellMini key={threadId} environmentId={props.environmentId} threadId={threadId} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A bar filled as far as a ladder is to its next rung. */
function Bar(props: { readonly ladder: Ladder }) {
  return (
    <View className={`h-[3px] overflow-hidden rounded-full ${BAR.track}`}>
      <View className={`h-full ${BAR.fill}`} style={{ width: percent(reachOf(props.ladder)) }} />
    </View>
  );
}

/** A rung nearly earned: what it is, how near, and what it unlocks. */
function NextCard(props: { readonly ladder: Ladder }) {
  const { ladder } = props;
  const next = ladder.next;
  if (next === null) return null;
  return (
    <View
      accessible
      accessibilityLabel={`${featName(next.feat)}. ${ladderProgress(ladder)}. ${rewardLine(next.feat)}`}
      className="w-64 flex-row items-center gap-3 rounded-2xl bg-grouped-card p-3"
    >
      <RewardCell feat={next.feat} earned={false} points={3} />
      <View className="min-w-0 flex-1 gap-1">
        <AppText className="text-sm font-t3-medium text-foreground" numberOfLines={1}>
          {featName(next.feat)}
        </AppText>
        <Bar ladder={ladder} />
        <AppText className="text-xs text-foreground-muted" style={NUMBERS}>
          {ladderProgress(ladder)}
        </AppText>
        <AppText className="text-xs text-foreground-secondary" numberOfLines={1}>
          {rewardLine(next.feat)}
        </AppText>
      </View>
    </View>
  );
}

/** A ladder's rungs as dots: each earned one filled in its rarity's hue. */
function Pips(props: { readonly ladder: Ladder }) {
  return (
    <View className="flex-row items-center gap-1">
      {props.ladder.rungs.map(({ feat, state }) => (
        <View
          key={feat.id}
          className={`size-[7px] rounded-full ${
            state.earned === null ? "border border-foreground-muted/60" : HUES[feat.rarity].fill
          }`}
        />
      ))}
    </View>
  );
}

/** One ladder in a line: the last thing it unlocked, how far up it is, and how near the next rung; it opens on every rung. */
function LadderRow(props: {
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
        className="min-h-14 flex-row items-center gap-3 px-3 py-2.5 active:opacity-70"
      >
        <View className="w-10 items-center">
          <RewardCell feat={shown.feat} earned={held !== undefined} points={2} />
        </View>
        <View className="min-w-0 flex-1 gap-1.5">
          <View className="flex-row items-center gap-2">
            <AppText className="shrink text-sm font-t3-medium text-foreground" numberOfLines={1}>
              {ladderName(ladder)}
            </AppText>
            {isNew ? <View className={`size-1.5 rounded-full ${NEW_DOT}`} /> : null}
          </View>
          <Bar ladder={ladder} />
        </View>
        <View className="items-end gap-1.5">
          <Pips ladder={ladder} />
          <AppText className="text-xs text-foreground-muted" style={NUMBERS}>
            {ladderProgress(ladder)}
          </AppText>
        </View>
        <SymbolView
          name={open ? "chevron.up" : "chevron.down"}
          size={12}
          tintColorClassName="accent-icon-muted"
          type="monochrome"
        />
      </Pressable>
      {open ? (
        <View className="gap-1 px-3 pb-3">
          {ladder.rungs.map((standing) => (
            <Rung
              key={standing.feat.id}
              standing={standing}
              fresh={props.fresh.has(standing.feat.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** One rung: what it unlocks, what it takes, and when and who, or what it will give. */
function Rung(props: { readonly standing: Standing; readonly fresh: boolean }) {
  const { feat, state } = props.standing;
  const earned = state.earned;
  const when =
    earned === null
      ? null
      : `${dateOf(earned.at)}${earned.threadId === null ? "" : ` · ${cellNameOf(earned.threadId)}`}`;
  return (
    <View
      accessible
      accessibilityLabel={[
        featName(feat),
        COLLECTION.rarityFeat(RARITY_NAMES[feat.rarity]),
        props.fresh ? COLLECTION.isNew : null,
        featTakes(feat),
        rewardLine(feat),
        when,
      ]
        .filter((part) => part !== null)
        .join(". ")}
      className="flex-row items-center gap-3 rounded-xl bg-screen px-2.5 py-2"
    >
      <View className="w-10 items-center">
        <RewardCell feat={feat} earned={earned !== null} points={2} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <AppText className="shrink text-sm text-foreground" numberOfLines={1}>
            {featName(feat)}
          </AppText>
          <AppText
            className={`text-3xs font-t3-bold uppercase tracking-wider ${HUES[feat.rarity].ink}`}
          >
            {RARITY_NAMES[feat.rarity]}
          </AppText>
          {props.fresh ? <View className={`size-1.5 rounded-full ${NEW_DOT}`} /> : null}
        </View>
        <AppText className="text-xs text-foreground-muted">{featTakes(feat)}</AppText>
        <AppText className="text-xs text-foreground-secondary">
          {when === null ? rewardLine(feat) : `${rewardLine(feat)} · ${when}`}
        </AppText>
      </View>
    </View>
  );
}

/** A secret: nothing but a question mark until it is found. */
function SecretTile(props: { readonly standing: Standing; readonly fresh: boolean }) {
  const { feat, state } = props.standing;
  const earned = state.earned;
  const name = earned === null ? SECRET.name : featName(feat);
  const line = earned === null ? SECRET.takes : rewardLine(feat);
  return (
    <View
      accessible
      accessibilityLabel={`${name}. ${line}`}
      className="flex-1 flex-row items-center gap-3 rounded-2xl bg-grouped-card p-3"
    >
      <View className="size-10 items-center justify-center">
        {earned === null ? (
          <AppText className="text-xl font-t3-bold text-foreground-muted">?</AppText>
        ) : (
          <RewardCell feat={feat} earned points={2} />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <AppText className="shrink text-sm font-t3-medium text-foreground" numberOfLines={1}>
            {name}
          </AppText>
          {props.fresh ? <View className={`size-1.5 rounded-full ${NEW_DOT}`} /> : null}
        </View>
        <AppText className="text-xs text-foreground-muted">{line}</AppText>
      </View>
    </View>
  );
}
