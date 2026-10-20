import * as NodeAssert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vite-plus/test";
import { AGAIN, EVERY, watchPresence } from "./presence.ts";

let hidden = false;
const page = { hidden: () => hidden, document: new EventTarget(), window: new EventTarget() };

beforeEach(() => {
  hidden = false;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

/** A watch over a Mac nobody is at, counting how often it reads the server. */
function awayMac() {
  let reads = 0;
  let present = false;
  const told: boolean[] = [];
  const stop = watchPresence(
    async () => {
      reads++;
      return present;
    },
    (said) => told.push(said),
    page,
  );
  return { reads: () => reads, told, back: () => (present = true), stop };
}

test("nobody at the Mac: the page reads presence seldom, not every few seconds", async () => {
  const mac = awayMac();
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  NodeAssert.equal(mac.reads(), 1 + Math.floor((5 * 60_000) / EVERY.away));
  NodeAssert.deepEqual(new Set(mac.told), new Set([false]));
  mac.stop();
});

test("the person stirring at the page reads again at once, so the eyes open without waiting", async () => {
  const mac = awayMac();
  await vi.advanceTimersByTimeAsync(AGAIN);
  mac.back();
  page.window.dispatchEvent(new Event("pointermove"));
  await vi.advanceTimersByTimeAsync(0);
  NodeAssert.equal(mac.reads(), 2);
  NodeAssert.equal(mac.told.at(-1), true);
  // A burst of movement asks once.
  page.window.dispatchEvent(new Event("pointermove"));
  page.window.dispatchEvent(new Event("keydown"));
  await vi.advanceTimersByTimeAsync(0);
  NodeAssert.equal(mac.reads(), 2);
  mac.stop();
});

test("a hidden page reads nothing until it is shown again", async () => {
  const mac = awayMac();
  await vi.advanceTimersByTimeAsync(0);
  hidden = true;
  await vi.advanceTimersByTimeAsync(10 * EVERY.away);
  NodeAssert.equal(mac.reads(), 1);
  hidden = false;
  page.document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  NodeAssert.equal(mac.reads(), 2);
  mac.stop();
});
