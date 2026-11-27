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

const { cellsListed, releaseKept, useArrivals, useHeldThreads, useKept } =
  await import("./plannedArrivals");

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
