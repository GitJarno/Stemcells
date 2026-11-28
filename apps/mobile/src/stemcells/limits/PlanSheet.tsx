import { useNavigation } from "@react-navigation/native";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ERROR, NEEDS_YOU } from "../tokens";
import { AppText } from "../upstream/cells";
import { SymbolView } from "../upstream/home";
import { formatDuration, openSettings, useNowMinuteMs } from "../upstream/limits";
import {
  bindingOf,
  boardOrder,
  path,
  type PlanReading,
  type PlanRow,
  type PlanTone,
  ringFigure,
  SIZE,
  standingOf,
  windowWhen,
} from "./kit";
import { Dial, useInkOf } from "./PlanRing";
import { hidePlans, usePlansShown } from "./sheet";
import { usePlans } from "./usePlans";
import { clockOf } from "./work";

const CELL = path("awake");
const NUMBERS = { fontVariant: ["tabular-nums" as const] };
/** On a wide sheet (a tablet, the unfolded Duo) the card keeps a reading width. */
const MOST_WIDE = 520;

interface Clocks {
  readonly now: number;
  readonly clock: (at: number) => string;
}

/** Amber when short, red when out, else nothing: the ink's say. */
const toneInk = (tone: PlanTone) =>
  tone === "out" ? { color: ERROR } : tone === "short" ? { color: NEEDS_YOU } : null;

/** A window: its name, when it resets or runs out, and the percent used over its bar. */
function Row(props: { readonly row: PlanRow; readonly ink: string; readonly clocks: Clocks }) {
  const { label, reading } = props.row;
  const { now, clock } = props.clocks;
  const used = 100 - reading.left;
  const even = reading.evenLeft === null ? null : 100 - reading.evenLeft;
  const when = windowWhen(reading, now, clock, formatDuration);
  return (
    <View
      className="gap-2"
      accessible
      accessibilityLabel={`${label}: ${used}% used${when === "" ? "" : `, ${when}`}`}
    >
      <View className="flex-row items-baseline gap-2">
        <AppText className="text-sm text-foreground">{label}</AppText>
        <AppText
          className="min-w-0 flex-1 text-xs text-foreground-muted"
          style={[NUMBERS, reading.runsOutAt === null ? null : { color: NEEDS_YOU }]}
          numberOfLines={1}
        >
          {when}
        </AppText>
        <AppText
          className="text-sm font-t3-bold text-foreground"
          style={[NUMBERS, reading.tone === "out" ? { color: ERROR } : null]}
        >
          {used}%
        </AppText>
      </View>
      <View className="h-1.5 justify-center">
        <View className="absolute inset-0 rounded-full bg-foreground/12" />
        {used > 0 ? (
          <View
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${used}%`, backgroundColor: props.ink }}
          />
        ) : null}
        {even !== null && even > 0 && even < 100 ? (
          // Where an even pace would have the bar by now.
          <View
            className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-full bg-foreground/55"
            style={{ left: `${even}%`, marginLeft: -1 }}
          />
        ) : null}
      </View>
    </View>
  );
}

/** A plan's Cell in its provider's colour, its name, and its tier when that isn't the name. */
function Name(props: { readonly plan: PlanReading; readonly large?: boolean }) {
  const { plan, large = false } = props;
  const inkOf = useInkOf();
  const glyph = large ? 14 : 12;
  return (
    <View className="min-w-0 flex-row items-center gap-2">
      <Svg
        width={glyph}
        height={(glyph * SIZE.height) / SIZE.width}
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
      >
        <Path d={CELL} fill={inkOf(String(plan.account.driver), "fine")} />
      </Svg>
      <AppText
        className={`shrink ${large ? "text-base" : "text-sm"} ${plan.named ? "font-t3-bold" : "font-t3-medium"}`}
        numberOfLines={1}
      >
        {plan.name}
      </AppText>
      {plan.account.plan && plan.account.plan !== plan.name ? (
        <AppText className="shrink text-xs text-foreground-muted" numberOfLines={1}>
          {plan.account.plan}
        </AppText>
      ) : null}
    </View>
  );
}

/** What else stands on a plan: the Cells on it now, and resets it can spend. */
function Aside(props: { readonly plan: PlanReading }) {
  const { plan } = props;
  const credits = plan.account.limits.resetCredits?.availableCount ?? 0;
  const words = [
    plan.working === 0 ? null : plan.working === 1 ? "1 Cell on it" : `${plan.working} Cells on it`,
    credits === 0 ? null : credits === 1 ? "1 reset to spend" : `${credits} resets to spend`,
  ].filter((each) => each !== null);
  if (words.length === 0) return null;
  return <AppText className="text-xs text-foreground-muted">{words.join(" · ")}</AppText>;
}

function Rows(props: { readonly plan: PlanReading; readonly clocks: Clocks }) {
  const inkOf = useInkOf();
  const driver = String(props.plan.account.driver);
  return (
    <View className="gap-4">
      {props.plan.rows.map((row) => (
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

/** The plan you're on: the ring you tapped, grown, where it stands, then its windows. */
function Current(props: { readonly plan: PlanReading; readonly clocks: Clocks }) {
  const { plan, clocks } = props;
  const inkOf = useInkOf();
  const binding = bindingOf(plan);
  const figure = ringFigure(plan, clocks.now);
  const standing = standingOf(plan, clocks.now, clocks.clock, formatDuration);
  const ink = inkOf(String(plan.account.driver), plan.tone);
  const used = plan.tone === "out" ? 100 : binding === null ? 0 : 100 - binding.left;
  return (
    <View className="gap-5 rounded-2xl bg-grouped-card p-5">
      <View className="flex-row items-center gap-4">
        <Dial size={68} used={used} ink={ink}>
          <AppText
            className="text-lg font-t3-bold text-foreground"
            style={[NUMBERS, { letterSpacing: -0.4 }, toneInk(plan.tone)]}
          >
            {figure === null ? "–" : plan.tone === "out" ? figure : `${figure}%`}
          </AppText>
        </Dial>
        <View className="min-w-0 flex-1 gap-1">
          <Name plan={plan} large />
          {standing === null ? null : (
            <View>
              <AppText
                className="text-sm font-t3-medium text-foreground"
                style={[NUMBERS, toneInk(standing.tone)]}
              >
                {standing.lead}
              </AppText>
              {standing.detail === null ? null : (
                <AppText className="text-xs text-foreground-muted" style={NUMBERS}>
                  {standing.detail}
                </AppText>
              )}
            </View>
          )}
        </View>
      </View>
      <Rows plan={plan} clocks={clocks} />
      <Aside plan={plan} />
    </View>
  );
}

function Other(props: { readonly plan: PlanReading; readonly clocks: Clocks }) {
  return (
    <View className="gap-4 rounded-2xl bg-grouped-card p-4">
      <Name plan={props.plan} />
      <Rows plan={props.plan} clocks={props.clocks} />
      <Aside plan={props.plan} />
    </View>
  );
}

/**
 * The ring's card, as the Mac's (`apps/web/src/stemcells/limits/PlanBoard.tsx`): the plan you're
 * on, then every other plan, the most room first, then the way to the Usage page.
 */
function PlanCard(props: { readonly onUsage: () => void }) {
  const now = useNowMinuteMs();
  const { plans, ring } = usePlans(now);
  const clocks = { now, clock: clockOf(now) };
  const [first, ...rest] = boardOrder(plans, ring);
  return (
    <ScrollView contentContainerClassName="items-center px-5 pt-7 pb-12">
      <View className="w-full gap-6" style={{ maxWidth: MOST_WIDE }}>
        <AppText className="px-1 text-2xl font-t3-bold text-foreground">Limits</AppText>
        {first === undefined ? (
          <AppText className="px-1 text-sm text-foreground-muted">
            No plan has said its limits yet.
          </AppText>
        ) : (
          <Current plan={first} clocks={clocks} />
        )}
        {rest.length > 0 ? (
          <View className="gap-2.5">
            <AppText className="px-1 text-xs font-t3-medium text-foreground-muted">
              {rest.length === 1 ? "Your other plan" : "Your other plans"}
            </AppText>
            {rest.map((plan) => (
              <Other key={plan.account.key} plan={plan} clocks={clocks} />
            ))}
          </View>
        ) : null}
        <View className="gap-2.5">
          <Pressable
            onPress={props.onUsage}
            accessibilityRole="link"
            className="flex-row items-center rounded-2xl bg-grouped-card px-4 py-3.5 active:opacity-70"
          >
            <AppText className="text-sm text-foreground">Usage</AppText>
            <View className="ml-auto">
              <SymbolView name="chevron.right" size={12} tintColorClassName="accent-icon-muted" />
            </View>
          </Pressable>
          {plans.length > 1 && plans.some((plan) => !plan.named) ? (
            <AppText className="px-1 text-xs text-foreground-muted">
              Name your plans in Settings › Providers.
            </AppText>
          ) : null}
        </View>
      </View>
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
