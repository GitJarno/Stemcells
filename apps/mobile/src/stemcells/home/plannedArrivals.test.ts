import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import { ARRIVALS } from "../../../../../stemcells/aski/arrivals.ts";
import {
  clearPlannedRows,
  type PlannedRow,
  setPlannedRows,
} from "../../../../../stemcells/aski/planned.ts";

const app = vi.hoisted(() => ({ changed: (_state: string) => undefined as void }));

vi.mock("react-native", () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => false,
    addEventListener: () => undefined,
  },
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      app.changed = listener;
    },
  },
}));
// The stores' hooks, read as they stand: no component draws here.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
}));

const {
  cellsListed,
  handedLanded,
  handOver,
  onHanding,
  releaseKept,
  useArrivals,
  useHanded,
  useHeldThreads,
  useIsHanded,
  useKept,
} = await import("./plannedArrivals");

const row = (threadId: string): PlannedRow => ({
  threadId,
  projectId: "project-harbor",
  projectName: "Harbor",
  title: "Rework the film page",
  modelName: "Fable 5.2",
  tier: "start",
  born: 0,
});

/** Plans `threadId`, lets it land, and lets the machine list it. */
function born(threadId: string) {
  setPlannedRows("plan", [row(threadId)]);
  vi.advanceTimersByTime(200);
  expect(useArrivals().map((arrival) => arrival.row.threadId)).toEqual([threadId]);
  cellsListed([threadId]);
}

describe("the phone's planned rows", () => {
  // One clock for the file: the arrivals remember when the last row landed.
  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    clearPlannedRows("plan");
    releaseKept();
    vi.advanceTimersByTime(ARRIVALS.giveUp);
  });

  it("keeps a born row's place, its Cell out of T3's list, until Awake is out of sight", () => {
    born("thread-otter");
    expect(useHeldThreads().has("thread-otter")).toBe(true);
    // Its birth words' time, their fade and the title's glide.
    vi.advanceTimersByTime(ARRIVALS.linger + ARRIVALS.fade + ARRIVALS.fold + 100);
    expect(useArrivals()).toEqual([]);
    expect(useKept().map((kept) => kept.threadId)).toEqual(["thread-otter"]);
    expect(useHeldThreads().has("thread-otter")).toBe(true);

    releaseKept(["thread-otter"]);
    expect(useKept()).toEqual([]);
    expect(useHeldThreads().has("thread-otter")).toBe(false);
  });

  it("hands a kept row to T3's list in sight: its room is held until the list's row lands, under a copy", () => {
    const still: boolean[] = [];
    onHanding((on) => void still.push(on));
    born("thread-lynx");
    vi.advanceTimersByTime(ARRIVALS.linger + ARRIVALS.fade + ARRIVALS.fold + 100);
    handOver("thread-lynx", { x: 8, y: 120, width: 300, height: 64 }, 72);
    // T3's list has the Cell from here, and it can be swiped; its row stays unseen under the copy.
    expect(useKept()).toEqual([]);
    expect(useHeldThreads().has("thread-lynx")).toBe(false);
    expect(useHanded().map((handed) => [handed.row.threadId, handed.room, handed.landed])).toEqual([
      ["thread-lynx", 72, false],
    ]);
    expect(useIsHanded("thread-lynx")).toBe(true);

    // The list's row is in: the room is given back, and the copy still covers it.
    handedLanded("thread-lynx");
    expect(useHanded().map((handed) => handed.landed)).toEqual([true]);
    expect(useIsHanded("thread-lynx")).toBe(true);

    // The copy goes a few frames on, and the list moves its rows on its own move again.
    vi.advanceTimersByTime(200);
    expect(useHanded()).toEqual([]);
    expect(useIsHanded("thread-lynx")).toBe(false);
    expect(still).toEqual([true, false]);
  });

  it("shows T3's row anyway when the list never draws it under the copy", () => {
    born("thread-ibis");
    vi.advanceTimersByTime(ARRIVALS.linger + ARRIVALS.fade + ARRIVALS.fold + 100);
    handOver("thread-ibis", { x: 8, y: 120, width: 300, height: 64 }, 72);
    vi.advanceTimersByTime(2_000);
    expect(useHanded()).toEqual([]);
    expect(useIsHanded("thread-ibis")).toBe(false);
  });

  it("hands every kept row to T3's list when the app leaves the screen", () => {
    born("thread-puma");
    vi.advanceTimersByTime(ARRIVALS.linger + ARRIVALS.fade + ARRIVALS.fold + 100);
    expect(useKept()).toHaveLength(1);
    app.changed("background");
    expect(useKept()).toEqual([]);
    expect(useHeldThreads().size).toBe(0);
  });

  it("keeps nothing of a row the machine never listed", () => {
    setPlannedRows("plan", [row("thread-wren")]);
    vi.advanceTimersByTime(ARRIVALS.giveUp + ARRIVALS.fold + 500);
    expect(useArrivals()).toEqual([]);
    expect(useKept()).toEqual([]);
    expect(useHeldThreads().size).toBe(0);
  });
});
