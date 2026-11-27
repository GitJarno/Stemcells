import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { DestroyAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { HOLD_PRESS } from "../../../../../../stemcells/words/plans.ts";

type Children = { children?: ReactNode };
type Press = {
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  accessibilityLabel?: string;
};

// A press as the phone delivers one: a finger down, a finger up, and a tap for a handler that
// asks for taps.
vi.mock("react-native", () => ({
  View: ({ children }: Children) => <div>{children}</div>,
  Pressable: ({ children, ...press }: Children & Press) => (
    <button
      type="button"
      aria-label={press.accessibilityLabel}
      onPointerDown={press.onPressIn}
      onPointerUp={press.onPressOut}
      onClick={() => {
        press.onPress?.();
        press.onLongPress?.();
      }}
    >
      {children}
    </button>
  ),
}));
vi.mock("react-native-reanimated", () => ({
  default: { View: ({ children }: Children) => <div>{children}</div> },
  cancelAnimation: () => {},
  Easing: { linear: 0 },
  ReduceMotion: { Never: "never" },
  useAnimatedStyle: () => ({}),
  useReducedMotion: () => false,
  useSharedValue: (value: number) => ({ get: () => value, set: () => {} }),
  withTiming: (value: number) => value,
}));
vi.mock("expo-haptics", () => ({
  notificationAsync: async () => {},
  NotificationFeedbackType: { Warning: "warning" },
}));
vi.mock("../../upstream/plans", () => ({
  AppText: ({ children }: Children) => <span>{children}</span>,
}));
vi.mock("../../line/Ask", () => ({
  Pill: (props: { title: string; onPress: () => void }) => (
    <button type="button" onClick={props.onPress}>
      {props.title}
    </button>
  ),
}));

const { HoldCard } = await import("./HoldCard");
const { HOLD_MS } = await import("./view");

const deletion: DestroyAct = {
  kind: "destroy",
  i: 0,
  pieces: [1],
  tier: "hold",
  why: [],
  target: "project",
  place: { id: "mac:p-atlas", name: "Atlas", heard: "Atlas", how: "exact" },
  cells: [],
  words: "delete the Atlas project",
};

function shown(act: DestroyAct = deletion) {
  const held = vi.fn();
  const dropped = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act_(() =>
    root.render(
      <HoldCard act={act} status="waiting" refused={null} onHeld={held} onDrop={dropped} />,
    ),
  );
  const target = host.querySelector<HTMLButtonElement>(`button[aria-label^="${HOLD_PRESS}"]`);
  const pointer = (type: "pointerdown" | "pointerup") =>
    act_(() => void target?.dispatchEvent(new MouseEvent(type, { bubbles: true })));
  return { held, dropped, host, root, target, pointer };
}

const act_ = (run: () => void) => act(run);

describe("a deletion's card", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("names what goes, what was heard and what stays", () => {
    const { host } = shown();
    expect(host.textContent).toContain("Delete the project Atlas");
    expect(host.textContent).toContain("You said “delete the Atlas project”.");
    expect(host.textContent).toContain("Its folder stays on disk.");
  });

  it("does nothing on a tap, however often", () => {
    const { held, target, pointer } = shown();
    for (let n = 0; n < 5; n++) {
      pointer("pointerdown");
      act_(() => vi.advanceTimersByTime(120));
      pointer("pointerup");
      act_(() => target?.click());
    }
    act_(() => vi.advanceTimersByTime(HOLD_MS * 3));
    expect(held).not.toHaveBeenCalled();
  });

  it("runs once the hand has stayed on the named thing to the end", () => {
    const { held, pointer } = shown();
    pointer("pointerdown");
    act_(() => vi.advanceTimersByTime(HOLD_MS - 50));
    expect(held).not.toHaveBeenCalled();
    act_(() => vi.advanceTimersByTime(50));
    expect(held).toHaveBeenCalledTimes(1);
  });

  it("doesn't run for a hand lifted early, or a card taken away mid-hold", () => {
    const lifted = shown();
    lifted.pointer("pointerdown");
    act_(() => vi.advanceTimersByTime(HOLD_MS - 100));
    lifted.pointer("pointerup");
    act_(() => vi.advanceTimersByTime(HOLD_MS));
    expect(lifted.held).not.toHaveBeenCalled();

    const gone = shown();
    gone.pointer("pointerdown");
    act_(() => vi.advanceTimersByTime(HOLD_MS / 2));
    act_(() => gone.root.unmount());
    act_(() => vi.advanceTimersByTime(HOLD_MS));
    expect(gone.held).not.toHaveBeenCalled();
  });

  it("offers no hold for a deletion Aski couldn't pin down, only Drop", () => {
    const { host, target, dropped } = shown({ ...deletion, place: null });
    expect(target).toBeNull();
    expect(host.textContent).toContain("Nothing is deleted.");
    act_(() => host.querySelector("button")?.click());
    expect(dropped).toHaveBeenCalledTimes(1);
  });
});
