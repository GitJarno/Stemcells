/**
 * Aski's throw to the Awake list (stemcells/tasks/aski-orchestrator.md, decision 12): for each
 * Cell its plan starts, Aski pulses once and a copy of itself flies to the top of Awake, where the
 * Cell's row forms as the copy lands (`rail/arrivals.ts`). `throwTo` only says where Aski stands;
 * the rows' own arrival decides when each copy leaves.
 */
import { reducedMotion, timed } from "../tokens/motion";
import type { Box } from "../words/spawn/plan";
import { askiStill, copyHeight, flyCopyTo } from "./copies";

/** Where Aski stands: its element, or its box in viewport CSS px. */
export type ThrowFrom = Element | Box;

/** How long a throw waits for its row to be planned, in ms: past it, it is forgotten. */
const WAITS = 3000;
/** Aski's pulse as a copy leaves: a squash from its feet, sprung back. */
const PULSE = [
  { transform: "scale(1, 1)" },
  { transform: "scale(1.06, 0.9)", offset: 0.4 },
  { transform: "scale(1, 1)" },
];

const asked = new Map<string, { readonly from: ThrowFrom; readonly until: number }>();

/**
 * Aski, standing at `from`, throws a copy of itself to each of `threadIds`' rows as they arrive in
 * Awake, in the order the rows come, a stagger apart. Safe before the rows are planned (it waits
 * a few seconds, then gives up quietly), safe to call twice, and nothing under Reduce Motion.
 */
export function throwTo(threadIds: ReadonlyArray<string>, from: ThrowFrom): void {
  const now = performance.now();
  for (const [threadId, throwing] of asked) if (throwing.until < now) asked.delete(threadId);
  if (reducedMotion()) return;
  for (const threadId of threadIds) asked.set(threadId, { from, until: now + WAITS });
}

/** Where Aski throws the row of `threadId` from, once: null when no throw waits for it, or Aski is off screen. */
export function takeThrow(threadId: string): ThrowFrom | null {
  const throwing = asked.get(threadId);
  asked.delete(threadId);
  if (throwing === undefined || throwing.until < performance.now()) return null;
  return boxOf(throwing.from) === null ? null : throwing.from;
}

/** `from`'s box while it is on screen, on a page on stage. */
function boxOf(from: ThrowFrom): Box | null {
  const box = from instanceof Element ? from.getBoundingClientRect() : from;
  const shown =
    box.width > 0 &&
    box.x + box.width > 0 &&
    box.y + box.height > 0 &&
    box.x < window.innerWidth &&
    box.y < window.innerHeight &&
    (!(from instanceof Element) || (from.isConnected && from.closest("[inert]") === null));
  return shown ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
}

let layer: HTMLElement | null = null;
let flying = 0;
const stills = new Map<string, Promise<HTMLCanvasElement | null>>();

/** One still of Aski a size and theme, drawn once for every copy of a plan. */
function stillFor(from: ThrowFrom, height: number): Promise<HTMLCanvasElement | null> {
  const on = from instanceof Element ? from : document.body;
  const key = `${Math.round(height)}|${getComputedStyle(on).color}|${document.documentElement.className}`;
  let still = stills.get(key);
  if (still === undefined) {
    if (stills.size > 4) stills.clear();
    still = askiStill(copyHeight(height), on).catch(() => null);
    stills.set(key, still);
  }
  return still;
}

/** Draws Aski's still ahead of the first copy, so the copy leaves on its beat. */
export function readyThrow(from: ThrowFrom): void {
  const box = boxOf(from);
  if (box !== null) void stillFor(from, box.height);
}

/**
 * Aski at `from` pulses and its copy flies to `to`, landing a `travel` later. Resolves as it
 * lands; at once when Aski went off screen meanwhile.
 */
export async function playThrow(from: ThrowFrom, to: Box): Promise<void> {
  const box = boxOf(from);
  if (box === null || reducedMotion()) return;
  const leaves = performance.now();
  const travel = timed("travel");
  const flick = timed("flick");
  if (from instanceof HTMLElement) {
    const origin = from.style.transformOrigin;
    from.style.transformOrigin = "50% 100%";
    void from.animate(PULSE, flick).finished.then(
      () => (from.style.transformOrigin = origin),
      () => (from.style.transformOrigin = origin),
    );
  }
  const still = await stillFor(from, box.height);
  if (still === null) return;
  if (layer === null) {
    layer = document.createElement("div");
    layer.className = "sc-spawn-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }
  flying += 1;
  // What drawing the still took comes off the flight, so the copy lands when its row forms.
  const left = Math.max(travel.duration / 2, travel.duration - (performance.now() - leaves));
  await flyCopyTo(layer, still, box, { box: to, into: "box" }, { ...travel, duration: left });
  flying -= 1;
  if (flying === 0) {
    layer.remove();
    layer = null;
  }
}
