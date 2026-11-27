import { useNavigation } from "@react-navigation/native";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ERROR, NEEDS_YOU } from "../tokens";
import { AppText } from "../upstream/cells";
import { formatDuration, openSettings, useNowMinuteMs } from "../upstream/limits";
import {
  boardOrder,
  headlineOf,
  path,
  type PlanReading,
  type PlanRow,
  SIZE,
  type WindowReading,
} from "./kit";
import { useInkOf } from "./PlanRing";
import { hidePlans, usePlansShown } from "./sheet";
import { usePlans } from "./usePlans";
import { clockOf } from "./work";

const DAY = 24 * 60 * 60_000;
const CELL = path("awake");
const GLYPH = 12;
const NUMBERS = { fontVariant: ["tabular-nums" as const] };

interface Clocks {
  readonly now: number;
  readonly clock: (at: number) => string;
}

/** When it resets ("2h 10m" under a day, else "Tue 20.00"), or when the pace runs it out first. */
function whenOf(window: WindowReading, clocks: Clocks): string {
  if (window.resetsAt === null) return "";
  if (window.runsOutAt !== null) return `out ${clocks.clock(window.runsOutAt)}`;
  return window.resetsAt - clocks.now < DAY
    ? formatDuration(window.resetsAt - clocks.now)
    : clocks.clock(window.resetsAt);
}

function Row(props: { readonly row: PlanRow; readonly ink: string; readonly clocks: Clocks }) {
  const { reading } = props.row;
  const used = 100 - reading.left;
  const even = reading.evenLeft === null ? null : 100 - reading.evenLeft;
  return (
    <View className="flex-row items-center gap-2 py-1">
      <AppText className="w-20 text-xs text-foreground-muted" numberOfLines={1}>
        {props.row.label}
      </AppText>
      <View className="h-[5px] flex-1 rounded-full bg-foreground/24">
        <View
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${used}%`, backgroundColor: props.ink }}
        />
        {even !== null ? (
          // Where an even pace would have the bar by now.
          <View
            className="absolute -inset-y-0.5 w-[1.5px] bg-foreground opacity-55"
            style={{ left: `${even}%` }}
          />
        ) : null}
      </View>
      <AppText
        className="w-11 text-right text-xs font-t3-bold"
        style={[NUMBERS, reading.tone === "out" ? { color: ERROR } : null]}
      >
        {used}%
      </AppText>
      <AppText
        className="w-24 text-right text-xs text-foreground-muted"
        style={[NUMBERS, reading.tone === "short" ? { color: NEEDS_YOU } : null]}
        numberOfLines={1}
      >
        {whenOf(reading, props.clocks)}
      </AppText>
    </View>
  );
}

function Chip(props: { readonly words: string }) {
  return (
    <View className="rounded-full border border-border px-1.5">
      <AppText className="text-3xs text-foreground-muted">{props.words}</AppText>
    </View>
  );
}

function Plan(props: {
  readonly plan: PlanReading;
  readonly first: boolean;
  readonly clocks: Clocks;
}) {
  const { plan } = props;
  const inkOf = useInkOf();
  const driver = String(plan.account.driver);
  const credits = plan.account.limits.resetCredits?.availableCount ?? 0;
  return (
    <View className={props.first ? "pb-2" : "border-t border-border pt-3 pb-2"}>
      <View className="mb-1.5 flex-row items-center gap-2">
        <Svg
          width={GLYPH}
          height={(GLYPH * SIZE.height) / SIZE.width}
          viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        >
          <Path d={CELL} fill={inkOf(driver, "fine")} />
        </Svg>
        <AppText
          className={`shrink text-sm ${plan.named ? "font-t3-bold" : "font-t3-medium"}`}
          numberOfLines={1}
        >
          {plan.name}
        </AppText>
        {plan.account.plan && plan.account.plan !== plan.name ? (
          <AppText className="shrink text-xs text-foreground-muted" numberOfLines={1}>
            {plan.account.plan}
          </AppText>
        ) : null}
        <View className="ml-auto flex-row gap-1">
          {plan.working > 0 ? (
            <Chip words={plan.working === 1 ? "1 Cell" : `${plan.working} Cells`} />
          ) : null}
          {credits > 0 ? <Chip words={credits === 1 ? "1 reset" : `${credits} resets`} /> : null}
        </View>
      </View>
      {plan.rows.map((row) => (
        <Row
          key={row.label}
          row={row}
          ink={inkOf(driver, row.reading.tone)}
          clocks={props.clocks}
        />
      ))}
    </View>
  );
}

/**
 * The ring's card, as the Mac's (`apps/web/src/stemcells/limits/PlanBoard.tsx`): when the ring's
 * plan stops you, if it will before its reset, then every plan, the ring's first, and a way to
 * the Usage page.
 */
function PlanCard(props: { readonly onUsage: () => void }) {
  const now = useNowMinuteMs();
  const { plans, ring } = usePlans(now);
  const clocks = { now, clock: clockOf(now) };
  const headline = ring === null ? null : headlineOf(ring, now, clocks.clock, formatDuration);
  return (
    <ScrollView contentContainerClassName="gap-3 px-5 pt-5 pb-10">
      <View className="flex-row items-baseline justify-between">
        <AppText className="text-lg font-t3-bold">Limits</AppText>
        <Pressable onPress={props.onUsage} accessibilityRole="link" hitSlop={8}>
          <AppText className="text-sm text-foreground-muted">Usage →</AppText>
        </Pressable>
      </View>
      {headline !== null && ring !== null ? (
        <AppText
          className="text-sm leading-5"
          style={{ color: ring.tone === "out" ? ERROR : NEEDS_YOU }}
        >
          {headline}
        </AppText>
      ) : null}
      <View>
        {boardOrder(plans, ring).map((plan, index) => (
          <Plan key={plan.account.key} plan={plan} first={index === 0} clocks={clocks} />
        ))}
      </View>
      {plans.length > 1 && plans.some((plan) => !plan.named) ? (
        <AppText className="text-xs text-foreground-muted">
          Name your plans in Settings › Providers.
        </AppText>
      ) : null}
    </ScrollView>
  );
}

/**
 * Every plan, in a sheet the rings open (`sheet.ts`): iOS's page sheet, which a swipe down
 * closes; Android's full-screen modal, which Back closes.
 */
export function PlanSheet() {
  const shown = usePlansShown();
  const navigation = useNavigation();
  return (
    <Modal
      visible={shown}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={hidePlans}
    >
      <View className="flex-1 bg-sheet-solid">
        <PlanCard
          onUsage={() => {
            hidePlans();
            openSettings(navigation, "SettingsUsage");
          }}
        />
      </View>
    </Modal>
  );
}
