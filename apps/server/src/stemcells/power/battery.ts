import type { BatteryPower, Charge } from "../../../../../stemcells/words/battery.ts";

// A machine's own battery, from what its system prints. Only a battery inside the machine: a UPS
// on a desktop keeps it up, and is no laptop in somebody's bag. Pure.

const INTERNAL = /-InternalBattery-\d+[^\n]*?(\d{1,3})%;\s*([^;\n]+)[^\n]*/;
const REMAINING = /(\d+):(\d{2}) remaining/;

const percentOf = (text: string): number | null => {
  if (!/^\d{1,3}$/.test(text)) return null;
  const percent = Number(text);
  return percent <= 100 ? percent : null;
};

/**
 * From `pmset -g batt`. It says `discharging` on a charger too weak to keep up, and the first line
 * says which source the machine draws from, so either means the charge is falling.
 */
export function batteryFromPmset(output: string): Charge | null {
  const line = INTERNAL.exec(output);
  if (line === null || /present:\s*false/.test(line[0])) return null;
  const percent = percentOf(line[1]!);
  if (percent === null) return null;
  const state = line[2]!.trim();
  const power: BatteryPower =
    state === "discharging" || output.includes("'Battery Power'")
      ? "battery"
      : state === "charging" || state === "finishing charge"
        ? "charging"
        : "plugged";
  const remaining = REMAINING.exec(line[0]);
  const minutesLeft = remaining === null ? 0 : Number(remaining[1]) * 60 + Number(remaining[2]);
  return power !== "plugged" && minutesLeft > 0
    ? { percent, power, minutesLeft }
    : { percent, power };
}

/** From a Linux battery's `capacity` and `status` in `/sys/class/power_supply`. */
export function batteryFromSysfs(capacity: string, status: string): Charge | null {
  const percent = percentOf(capacity.trim());
  if (percent === null) return null;
  const state = status.trim();
  return {
    percent,
    power: state === "Discharging" ? "battery" : state === "Charging" ? "charging" : "plugged",
  };
}
