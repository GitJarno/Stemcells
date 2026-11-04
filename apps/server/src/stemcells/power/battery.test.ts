import { describe, expect, it } from "vite-plus/test";

import { batteryFromPmset, batteryFromSysfs } from "./battery.ts";

const batt = (source: string, line: string) =>
  `Now drawing from '${source}'\n${line === "" ? "" : ` -InternalBattery-0 (id=22085731)\t${line}\n`}`;

describe("a battery as pmset prints it", () => {
  it.each([
    [
      "on battery, with an estimate",
      batt("Battery Power", "85%; discharging; 4:12 remaining present: true"),
      { percent: 85, power: "battery", minutesLeft: 252 },
    ],
    [
      "on battery, working one out",
      batt("Battery Power", "60%; discharging; (no estimate) present: true"),
      { percent: 60, power: "battery" },
    ],
    [
      "just unplugged, still saying charged",
      batt("Battery Power", "100%; charged; 0:00 remaining present: true"),
      { percent: 100, power: "battery" },
    ],
    [
      "on a charger too weak to keep up",
      batt("AC Power", "42%; discharging; 2:01 remaining present: true"),
      { percent: 42, power: "battery", minutesLeft: 121 },
    ],
    [
      "charging",
      batt("AC Power", "37%; charging; 1:35 remaining present: true"),
      { percent: 37, power: "charging", minutesLeft: 95 },
    ],
    [
      "finishing its charge",
      batt("AC Power", "99%; finishing charge; 0:05 remaining present: true"),
      { percent: 99, power: "charging", minutesLeft: 5 },
    ],
    [
      "held at a limit by the charge manager",
      batt("AC Power", "80%; AC attached; not charging present: true"),
      { percent: 80, power: "plugged" },
    ],
    [
      "full on the charger",
      batt("AC Power", "100%; charged; 0:00 remaining present: true"),
      { percent: 100, power: "plugged" },
    ],
  ])("%s", (_, output, charge) => {
    expect(batteryFromPmset(output)).toEqual(charge);
  });

  it.each([
    ["a desktop", batt("AC Power", "")],
    [
      "a desktop on a UPS",
      "Now drawing from 'AC Power'\n -Back-UPS 700 (id=1234)\t100%; charged; 0:00 remaining present: true\n",
    ],
    ["a battery taken out", batt("AC Power", "0%; AC attached; not charging present: false")],
    ["nonsense", "pmset: command failed"],
    ["nothing at all", ""],
  ])("%s has none", (_, output) => {
    expect(batteryFromPmset(output)).toBeNull();
  });
});

describe("a battery as Linux keeps it", () => {
  it.each([
    ["Discharging", "battery"],
    ["Charging", "charging"],
    ["Full", "plugged"],
    ["Not charging", "plugged"],
    ["Unknown", "plugged"],
  ])("%s", (status, power) => {
    expect(batteryFromSysfs("64\n", `${status}\n`)).toEqual({ percent: 64, power });
  });

  it("a capacity past what a charge can be is none", () => {
    expect(batteryFromSysfs("140\n", "Discharging\n")).toBeNull();
    expect(batteryFromSysfs("\n", "Discharging\n")).toBeNull();
  });
});
