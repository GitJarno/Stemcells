import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  ARRIVAL_BEAT_MS,
  ARRIVALS,
  createArrivals,
  DECODE_STEPS,
  decodeAt,
  nextArrival,
} from "../../../../../stemcells/aski/arrivals.ts";
import {
  awakeWithPlanned,
  clearPlannedRows,
  confirmPlannedRow,
  dropPlannedRow,
  type PlannedRow,
  plannedRows,
  setPlannedRows,
} from "../../../../../stemcells/aski/planned.ts";
import { LIST_MOTION } from "../motion/listMotion.ts";

const row = (threadId: string, over: Partial<PlannedRow> = {}): PlannedRow => ({
  threadId,
  projectId: "harbor",
  projectName: "Harbor",
  title: `Task of ${threadId}`,
  modelName: "Fable 5.2",
  effort: "high",
  tier: "start",
  born: 0,
  ...over,
});

afterEach(() => {
  for (const planned of plannedRows()) clearPlannedRows(planned.planId);
});

describe("the planned rows", () => {
  it("stand at Awake's top under the pins, the latest on top, and the machine's row takes over in place", () => {
    setPlannedRows("plan", [row("otter"), row("puma")]);
    const arrived = [...plannedRows()];
    const before = awakeWithPlanned(["pin", "old"], (id) => id, 1, arrived);
    expect(before.map((entry) => entry.threadId)).toEqual(["pin", "puma", "otter", "old"]);
    expect(before[2]).toMatchObject({ row: null, birth: { threadId: "otter" } });
    // The machine lists Otter, wherever its own order puts it: the row stays where it formed.
    const after = awakeWithPlanned(["pin", "old", "otter"], (id) => id, 1, arrived);
    expect(after.map((entry) => entry.threadId)).toEqual(["pin", "puma", "otter", "old"]);
    expect(after[2]).toMatchObject({ row: "otter", birth: { threadId: "otter" } });
    // Its birth over, it stands as the machine orders it.
    const later = awakeWithPlanned(["pin", "old", "otter"], (id) => id, 1, []);
    expect(later.map((entry) => entry.threadId)).toEqual(["pin", "old", "otter"]);
  });

  it("a confirmed check fills in and stays started when its plan sends it again; a dropped row leaves", () => {
    setPlannedRows("plan", [row("otter", { tier: "check", unsure: "place" }), row("puma")]);
    confirmPlannedRow("plan", "otter");
    expect(plannedRows()[0]).toMatchObject({ tier: "start", unsure: undefined });
    setPlannedRows("plan", [row("otter", { tier: "check", unsure: "place" }), row("puma")]);
    expect(plannedRows()[0]).toMatchObject({ threadId: "otter", tier: "start" });
    dropPlannedRow("plan", "otter");
    expect(plannedRows().map((planned) => planned.threadId)).toEqual(["puma"]);
    clearPlannedRows("plan");
    expect(plannedRows()).toEqual([]);
  });

  it("belong to the plan that named their thread first", () => {
    setPlannedRows("first", [row("otter", { title: "The first plan's" })]);
    setPlannedRows("second", [row("otter", { title: "The second plan's" }), row("puma")]);
    expect(plannedRows().map((planned) => planned.title)).toEqual([
      "The first plan's",
      "Task of puma",
    ]);
  });
});

describe("when Cells arrive", () => {
  it("come a stagger apart, four forming at most: the fifth waits for the first to stand", () => {
    const arrived: number[] = [];
    for (let cell = 0; cell < 6; cell++) arrived.push(nextArrival(arrived, 0));
    const forming = ARRIVALS.forming * ARRIVAL_BEAT_MS;
    const { stagger } = ARRIVALS;
    expect(arrived).toEqual([0, stagger, 2 * stagger, 3 * stagger, forming, forming + stagger]);
    expect(stagger).toBeGreaterThanOrEqual(90);
    expect(stagger).toBeLessThanOrEqual(150);
    for (const at of arrived)
      expect(arrived.filter((other) => other <= at && at < other + forming).length).toBeLessThan(5);
    // One that comes later comes at once.
    expect(nextArrival(arrived, 5000)).toBe(5000);
  });

  it("the row's leave and fold are the lists' own", () => {
    expect(ARRIVALS.fade).toBe(LIST_MOTION.leave.duration);
    expect(ARRIVALS.fold).toBe(LIST_MOTION.move.duration);
    expect(ARRIVALS.most).toBe(LIST_MOTION.mostAtOnce);
  });
});

describe("a line settling out of glyphs", () => {
  const parts = ["Otter", "Fable 5.2", " · high", "Rework the film page"];

  it("steps the same way every time, from nothing to its own words", () => {
    const steps = Array.from({ length: DECODE_STEPS + 1 }, (_, step) =>
      decodeAt(parts, step).map((part) => part.text),
    );
    expect(steps).toEqual([
      [":+.:+", ".:..: .::", "", ""],
      ["+#:+#", ":+::+ :++", " . ..+:", ".::+:. "],
      ["#@+#@", "+#++# +##", " : ::#+", ":++#+: .+: ::.. .+++"],
      ["Otter", "Fable 5.2", " + ++@#", "+##@#+ :#+ ++:: :###"],
      ["Otter", "Fable 5.2", " · high", "Rework +@# ##++ +@@@"],
      ["Otter", "Fable 5.2", " · high", "Rework the film page"],
    ]);
  });

  it("settles left to right as a prefix, so no settled letter moves, and spaces stay spaces", () => {
    const whole = parts.join("");
    let settledBefore = 0;
    for (let step = 0; step <= DECODE_STEPS; step++) {
      const shown = decodeAt(parts, step);
      const settled = shown.reduce((sum, part) => sum + part.settled, 0);
      expect(settled).toBeGreaterThanOrEqual(settledBefore);
      settledBefore = settled;
      const text = shown.map((part) => part.text).join("");
      expect(text.slice(0, settled)).toBe(whole.slice(0, settled));
      [...text].forEach((char, at) => {
        if (whole[at] === " ") expect(char).toBe(" ");
      });
      // A part shows nothing until the one before it has started.
      shown.forEach((part, at) => {
        if (part.started && at > 0) expect(shown[at - 1]!.started).toBe(true);
      });
    }
    expect(settledBefore).toBe(whole.length);
  });
});

describe("the arrivals", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  const stage = (reduced: boolean, aski = true) => {
    const played = { forms: [] as string[], fills: [] as string[], throws: [] as string[] };
    const arrivals = createArrivals<string, string>(plannedRows, {
      now: () => vi.getMockedSystemTime()?.getTime() ?? 0,
      reduced: () => reduced,
      travel: () => 480,
      takeThrow: () => (aski ? "aski" : null),
      slot: () => "top",
      ready: () => undefined,
      playThrow: (from, to) => void played.throws.push(`${from}>${to}`),
      forms: (threadId) => void played.forms.push(threadId),
      fills: (threadId) => void played.fills.push(threadId),
    });
    return { arrivals, played, here: () => arrivals.read().map((each) => each.row.threadId) };
  };

  it("under Reduce Motion land at once and play nothing: no throw, no forming, no stagger", () => {
    const { arrivals, played, here } = stage(true);
    setPlannedRows(
      "plan",
      ["a", "b", "c", "d", "e", "f"].map((id) => row(id)),
    );
    arrivals.sync();
    expect(here()).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(arrivals.read().every((arrival) => !arrival.forms)).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(played).toEqual({ forms: [], fills: [], throws: [] });
  });

  it("land as Aski's copy does, a stagger apart, the copy leaving a flight ahead", () => {
    const { arrivals, played, here } = stage(false);
    setPlannedRows("plan", [row("a"), row("b")]);
    arrivals.sync();
    vi.advanceTimersByTime(ARRIVAL_BEAT_MS + 1);
    expect(played.throws).toEqual(["aski>top"]);
    expect(here()).toEqual([]);
    vi.advanceTimersByTime(480);
    expect(here()).toEqual(["a"]);
    expect(played.forms).toEqual(["a"]);
    vi.advanceTimersByTime(ARRIVALS.stagger);
    expect(here()).toEqual(["a", "b"]);
    expect(played.throws).toHaveLength(2);
  });

  it("without Aski in sight land with no flight; a check waits as an outline and fills in when confirmed", () => {
    const { arrivals, played, here } = stage(false, false);
    setPlannedRows("plan", [row("a", { tier: "check", unsure: "model" })]);
    arrivals.sync();
    vi.advanceTimersByTime(ARRIVAL_BEAT_MS + 1);
    expect(here()).toEqual(["a"]);
    expect(played.throws).toEqual([]);
    vi.advanceTimersByTime(ARRIVALS.giveUp * 2);
    expect(arrivals.read()[0]).toMatchObject({ state: "here", row: { tier: "check" } });
    confirmPlannedRow("plan", "a");
    arrivals.sync();
    expect(played.fills).toEqual(["a"]);
    expect(arrivals.read()[0]).toMatchObject({ row: { tier: "start" } });
  });

  it("keep a listed row's birth words a while, then they fade; a dropped row folds away", () => {
    const { arrivals, here } = stage(false, false);
    setPlannedRows("plan", [row("a"), row("b")]);
    arrivals.sync();
    vi.advanceTimersByTime(1000);
    expect(here()).toEqual(["a", "b"]);
    arrivals.listed(["a"]);
    dropPlannedRow("plan", "b");
    arrivals.sync();
    expect(arrivals.read().map((each) => each.state)).toEqual(["here", "gone"]);
    vi.advanceTimersByTime(ARRIVALS.fold);
    expect(here()).toEqual(["a"]);
    // Ten seconds from its landing, a beat after the plan named it.
    vi.advanceTimersByTime(ARRIVALS.linger - 1000 - ARRIVALS.fold + ARRIVAL_BEAT_MS + 1);
    expect(arrivals.read().map((each) => each.state)).toEqual(["fading"]);
    vi.advanceTimersByTime(ARRIVALS.fade);
    expect(here()).toEqual([]);
    // Its plan still names it: it doesn't arrive a second time.
    arrivals.sync();
    vi.advanceTimersByTime(1000);
    expect(here()).toEqual([]);
  });
});
