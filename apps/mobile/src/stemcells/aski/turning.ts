// A turn while it plays (stemcells/tasks/aski-side.md): one clock for going in and one for
// coming out, on the UI thread, read by the figure heading a chat, the one in Aski's button, a
// chat's title and its feed. Nothing else on the screen changes.

import { useSyncExternalStore } from "react";
import {
  Easing,
  makeMutable,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { arriving, feedArriving, feedLeaving, leaving, PIPE } from "./pipe";
import type { Where } from "./turn";

export interface Turn {
  /** A chat's thread, or `home`. */
  readonly from: string;
  readonly to: string;
  /** Both ends are chats: the screen stays and its chat turns. Else screens slide, and only the button's figure goes through. */
  readonly swap: boolean;
  /** What stood in the button at the tap (null is Aski): it goes in as that, whatever is in front by then. */
  readonly face: Where | null;
  readonly phase: "dive" | "rise";
}

export type Role = "still" | "leaving" | "arriving";

interface Moments {
  /** The figures are in the pipe. */
  readonly dived: () => void;
  /** They burst out of it. */
  readonly out: () => void;
}

/** A chat that never arrives ends the turn: nothing stays unseen. */
const GIVE_UP_MS = 2500;

const dive = makeMutable(0);
const rise = makeMutable(0);
let turn: Turn | null = null;
let dived = false;
let there = false;
let moments: Moments | null = null;
let givingUp: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
function tell(next: Turn | null): void {
  turn = next;
  for (const listener of listeners) listener();
}

export const keyOf = (where: Where): string => (where.kind === "home" ? "home" : where.threadId);

/** A turn is playing: a second tap waits for it. */
export const turning = (): boolean => turn !== null;

export function beginTurn(next: Omit<Turn, "phase">, on: Moments): void {
  dived = false;
  there = false;
  moments = on;
  rise.set(0);
  dive.set(0);
  dive.set(
    withTiming(PIPE.dive, { duration: PIPE.dive, easing: Easing.linear }, (done) => {
      if (done) runOnJS(wentIn)();
    }),
  );
  clearTimeout(givingUp);
  givingUp = setTimeout(endTurn, GIVE_UP_MS);
  tell({ ...next, phase: "dive" });
}

function wentIn(): void {
  if (turn === null) return;
  dived = true;
  moments?.dived();
  comeOut();
}

/** The button stands over `key` now: the turn's other end, once it is. */
export function arrivedAt(key: string): void {
  if (turn === null || key !== turn.to) return;
  there = true;
  comeOut();
}

function comeOut(): void {
  if (turn === null || turn.phase !== "dive" || !dived || !there) return;
  const whole = PIPE.rise + PIPE.stagger;
  // Its end is the rise's from here: giving up mid-rise would drop the figures to rest.
  clearTimeout(givingUp);
  rise.set(
    withDelay(
      PIPE.settle,
      withTiming(whole, { duration: whole, easing: Easing.linear }, (done) => {
        if (done) runOnJS(endTurn)();
      }),
    ),
  );
  const { out } = moments ?? {};
  if (out !== undefined) setTimeout(out, PIPE.settle + PIPE.rise * 0.25);
  tell({ ...turn, phase: "rise" });
}

function endTurn(): void {
  clearTimeout(givingUp);
  if (turn === null) return;
  moments = null;
  dive.set(0);
  tell(null);
}

export function useTurn(): Turn | null {
  return useSyncExternalStore(subscribe, () => turn);
}

const roleIn = (now: Turn | null, chat: string): Role =>
  now === null || !now.swap
    ? "still"
    : chat === now.to
      ? "arriving"
      : chat === now.from
        ? "leaving"
        : "still";

/** What a chat's own parts (its figure, title and feed) do in the turn playing. */
export function useChatRole(chat: string): Role {
  return roleIn(useTurn(), chat);
}

/** A chat mounted as the turn's far end: its feed fades in from nothing. */
export const arrivesNow = (chat: string): boolean => roleIn(turn, chat) === "arriving";

const REST = { opacity: 1, transform: [{ translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }] };

/** A figure on its pipe: `late` ms behind the first one out. */
export function usePipeStyle(role: Role, late = 0) {
  const reduced = useReducedMotion();
  return useAnimatedStyle(() => {
    if (role === "still") return REST;
    const at = role === "leaving" ? leaving(dive.get()) : arriving(rise.get() - late);
    // Reduce Motion: it fades where it stands.
    if (reduced) return { ...REST, opacity: at.opacity };
    return {
      opacity: at.opacity,
      transform: [
        { translateY: at.lift },
        { scaleX: at.scale * (2 - at.squash) },
        { scaleY: at.scale * at.squash },
      ],
    };
  }, [role, reduced, late]);
}

/** A chat's title: out with the chat left, in with the one arrived at. */
export function useTitleStyle(role: Role) {
  return useAnimatedStyle(
    () => ({
      opacity:
        role === "still"
          ? 1
          : role === "leaving"
            ? feedLeaving(dive.get())
            : feedArriving(rise.get()),
    }),
    [role],
  );
}

/** The feed of the chat being left: 1 anywhere else. */
export function useFeedLeaving(role: Role) {
  return useAnimatedStyle(
    () => ({ opacity: role === "leaving" ? feedLeaving(dive.get()) : 1 }),
    [role],
  );
}
