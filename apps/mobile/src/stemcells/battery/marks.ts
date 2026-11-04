// The phone's glance at the machines Cells run on (`stemcells/tasks/laptop-battery.md`): which
// show, whether they're in reach, what Aski says of them and the colour of a charge. Pure.

import {
  type Charge,
  LOW_AT,
  lowBatteryLine,
  wentQuietLine,
} from "../../../../../stemcells/words/battery.ts";
import { DONE, NEEDS_YOU } from "../tokens";

/** A machine's charge as last heard. */
export type Heard = Charge & {
  /** When the phone first had this reading, by its own clock: machines' clocks differ from it. */
  readonly heardAt: number;
  readonly sampledAt: number;
};

export type MachineBattery = Heard & {
  readonly environmentId: string;
  readonly label: string;
  /** Not answering: the lid shuts over what it last said. */
  readonly away: boolean;
};

/** Each machine's last charge, kept for the app's run: what it said stands while it says nothing. */
export function keptCharges() {
  const last = new Map<string, Heard | null>();
  return (
    environmentId: string,
    snapshot:
      | { readonly sampledAt: number; readonly battery?: Charge | undefined }
      | null
      | undefined,
    now: number,
  ): Heard | null => {
    const before = last.get(environmentId) ?? null;
    if (snapshot == null) return before;
    if (snapshot.battery === undefined) {
      last.set(environmentId, null);
      return null;
    }
    // The same answer read again, as a header drawn again does, is no news of the machine.
    if (before !== null && before.sampledAt === snapshot.sampledAt) return before;
    const heard = { ...snapshot.battery, sampledAt: snapshot.sampledAt, heardAt: now };
    last.set(environmentId, heard);
    return heard;
  };
}

/** Long enough for a route to come back after a blip, or after the app returns to the front. */
export const AWAY_AFTER_MS = 20_000;
/** A connected machine answers every 30 s, on a clock a minute coarse: past this, it isn't. */
const SILENT_AFTER_MS = 2 * 60_000;

/**
 * `settled`: `AWAY_AFTER_MS` has passed since the app came to the front. A socket can stay
 * "connected" a while after its machine slept, so connected or not, old news shuts the lid.
 */
export const isAway = (connected: boolean, settled: boolean, heardAt: number, now: number) =>
  settled && now - heardAt > (connected ? SILENT_AFTER_MS : AWAY_AFTER_MS);

/**
 * The line only while something is at stake: Cells flying on a machine at its low, live before
 * gone, the lowest first; else one that went quiet there with Cells flying.
 */
export function batterySays(
  batteries: ReadonlyArray<MachineBattery>,
  flyingOn: (environmentId: string) => number,
): string | null {
  const staked = batteries
    .filter(
      (battery) =>
        battery.power === "battery" &&
        battery.percent <= LOW_AT &&
        flyingOn(battery.environmentId) > 0,
    )
    .sort((a, b) => Number(a.away) - Number(b.away) || a.percent - b.percent);
  const first = staked[0];
  if (first === undefined) return null;
  return first.away
    ? wentQuietLine(first.label, first.percent)
    : lowBatteryLine(first.label, first.percent, flyingOn(first.environmentId));
}

/** A laptop and its number at their widest ("100%"), and the gap before each. */
const WITH_NUMBER = 61;
const GAP = 8;

/** Whether the numbers stand beside the laptops in `room` points; else the laptops stand alone. */
export const numbersFit = (count: number, room: number | null): boolean =>
  room !== null && count * (WITH_NUMBER + GAP) <= room;

type Appearance = "light" | "dark";

/** The level's colour by share: red, amber at its token, yellow, then green at its token. */
const STOPS: Readonly<Record<Appearance, ReadonlyArray<readonly [number, string]>>> = {
  dark: [
    [LOW_AT, "#ff6765"],
    [20, NEEDS_YOU],
    [32, "#ead33f"],
    [55, "#70dd84"],
    [100, DONE],
  ],
  light: [
    [LOW_AT, "#ba1d2a"],
    [20, "#bd7e00"],
    [32, "#aa9200"],
    [55, "#279c47"],
    [100, "#00965e"],
  ],
};

const channels = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));

export function levelColour(percent: number, appearance: Appearance): string {
  const stops = STOPS[appearance];
  const above = stops.findIndex(([at]) => percent <= at);
  if (above === 0) return stops[0]![1];
  const [fromAt, from] = stops[above - 1]!;
  const [toAt, to] = stops[above]!;
  const share = (percent - fromAt) / (toAt - fromAt);
  const start = channels(from);
  const end = channels(to);
  return `rgb(${start.map((value, index) => Math.round(value + (end[index]! - value) * share)).join(", ")})`;
}

/** A charge's fill: green while charging, the level's colour on battery, none when plugged in. */
export function fillColour(charge: Charge, appearance: Appearance): string | null {
  if (charge.power === "plugged") return null;
  return levelColour(charge.power === "charging" ? 100 : charge.percent, appearance);
}

/** Where the level colours the number too: off the charger, once it isn't plenty. */
const NUMBER_COLOURED_AT = 32;

export function numberColour(battery: MachineBattery, appearance: Appearance): string | null {
  if (battery.power !== "battery") return null;
  if (battery.away)
    return battery.percent <= LOW_AT ? levelColour(battery.percent, appearance) : null;
  return battery.percent <= NUMBER_COLOURED_AT ? levelColour(battery.percent, appearance) : null;
}

/** What the fill pulses on crossing into: plugging in, and running low. */
export function zoneOf(charge: Charge): "charging" | "last" | "low" | "fine" {
  if (charge.power === "charging") return "charging";
  if (charge.power === "plugged") return "fine";
  if (charge.percent <= LOW_AT) return "last";
  return charge.percent <= 20 ? "low" : "fine";
}
