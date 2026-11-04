/**
 * A machine's battery in words: one copy for the phone's home and the machine's own push, so
 * both say the same at the same figure (`stemcells/tasks/laptop-battery.md`).
 */

/** The share of a charge at or under which a machine on battery, with Cells flying, is said. */
export const LOW_AT = 10;

export type BatteryPower = "battery" | "charging" | "plugged";

export interface Charge {
  readonly percent: number;
  readonly power: BatteryPower;
  /** While on battery, how long it lasts; while charging, how long until full. */
  readonly minutesLeft?: number;
}

const NUMBERS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

/** A count as the persona writes one: in words up to ten. */
export const spelled = (n: number): string => NUMBERS[n] ?? String(n);

const flyingWords = (flying: number): string =>
  flying === 1 ? "One Cell flying" : `${spelled(flying)} Cells flying`;

/** A machine's name is the person's own, so nothing here sentence-cases it. */
export const lowBatteryLine = (name: string, percent: number, flying: number): string =>
  `${name} has ${percent}% left. ${flyingWords(flying)}.`;

export const wentQuietLine = (name: string, percent: number): string =>
  `${name} went quiet at ${percent}%.`;

export const lowBatteryPush = (name: string, percent: number, flying: number) => ({
  title: `${name} has ${percent}% left`,
  body: `${flyingWords(flying)}. Plug it in to keep ${flying === 1 ? "it" : "them"} going.`,
});

/** "45 min", "2 h", "3 h 10 min". */
export function minutesWords(minutes: number): string {
  const whole = Math.max(1, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A machine's menu row: `heardAgo` is how many minutes since it spoke, while it's out of reach. */
export function chargeWords(charge: Charge, heardAgo: number | null): string {
  const percent = `${charge.percent}%`;
  if (heardAgo !== null) return `${percent}, heard ${minutesWords(heardAgo)} ago`;
  if (charge.power === "plugged") return `${percent}, plugged in`;
  if (charge.power === "charging")
    return charge.minutesLeft === undefined
      ? `${percent}, charging`
      : `${percent}, full in ${minutesWords(charge.minutesLeft)}`;
  return charge.minutesLeft === undefined
    ? percent
    : `${percent}, ${minutesWords(charge.minutesLeft)} left`;
}

/** The same for VoiceOver, which reads a mark that shows only a level and a colour. */
export function spokenCharge(name: string, charge: Charge, away: boolean): string {
  if (away) return `${name}, out of reach, last heard at ${charge.percent} percent`;
  const power = { battery: "on battery", charging: "charging", plugged: "plugged in" };
  return `${name}, ${charge.percent} percent, ${power[charge.power]}`;
}
