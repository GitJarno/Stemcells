import { describe, expect, it } from "vite-plus/test";

import {
  BACK_SAID_FOR,
  IDLE_AFTER,
  idleSecondsOf,
  NOT_WATCHED,
  onConsoleOf,
  presenceOf,
  said,
  type Watch,
  watched,
  WATCH_EVERY,
} from "./presence.ts";

const session = (uid: number, onConsole: boolean) => `
    <dict>
      <key>kCGSSessionOnConsoleKey</key>
      <${onConsole}/>
      <key>kCGSSessionUserIDKey</key>
      <integer>${uid}</integer>
      <key>kCGSSessionUserNameKey</key>
      <string>example</string>
    </dict>`;
const root = (...sessions: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>IOConsoleUsers</key>
  <array>${sessions.join("")}
  </array>
  <key>IOKitBuildVersion</key>
  <string>Darwin Kernel Version</string>
</dict>
</plist>`;

describe("whether somebody is at the Mac, for Aski's eyes", () => {
  it("nobody is once 5 minutes pass without input, or while the session is switched out", () => {
    expect(presenceOf({ idleSeconds: IDLE_AFTER - 1, onConsole: true })).toEqual({
      present: true,
    });
    expect(presenceOf({ idleSeconds: IDLE_AFTER, onConsole: true })).toEqual({
      present: false,
      away: "idle",
    });
    expect(presenceOf({ idleSeconds: 3, onConsole: false })).toEqual({
      present: false,
      away: "switchedOut",
    });
  });

  it("nothing read never says nobody is there", () => {
    expect(presenceOf({ idleSeconds: null, onConsole: null })).toEqual({ present: true });
  });

  it("reads the idle time ioreg prints in nanoseconds", () => {
    expect(idleSecondsOf('    |   "HIDIdleTime" = 854829204500\n')).toBeCloseTo(854.83, 2);
    expect(idleSecondsOf("")).toBeNull();
  });

  it("reads this user's session on the console from the registry's root", () => {
    expect(onConsoleOf(root(session(501, true)), 501)).toBe(true);
    expect(onConsoleOf(root(session(502, true), session(501, false)), 501)).toBe(false);
    expect(onConsoleOf(root(session(502, true)), 501)).toBe(false);
    expect(onConsoleOf("<plist></plist>", 501)).toBeNull();
  });
});

describe("how long the person was away, for Aski to say what happened meanwhile", () => {
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  /** Readings every watch, from `start`, each with the idle seconds `idleAt` gives. */
  const readEvery = (watch: Watch, start: number, end: number, idleAt: (at: number) => number) => {
    let w = watch;
    for (let at = start; at <= end; at += WATCH_EVERY)
      w = watched(w, { idleSeconds: idleAt(at), onConsole: true }, at);
    return w;
  };

  it("a stretch runs from the last input before it to the first input after", () => {
    const left = 10 * MINUTE;
    const back = left + 2 * HOUR;
    let w = readEvery(NOT_WATCHED, 0, back - MINUTE, (at) => (at < left ? 1 : (at - left) / 1000));
    expect(w.awaySince).toBe(left);
    w = watched(w, { idleSeconds: 3, onConsole: true }, back + 3000);
    expect(w.back).toEqual({ from: left, to: back });
    expect(w.awaySince).toBeNull();
    expect(said(w, { idleSeconds: 3, onConsole: true }, back + 3000).back).toEqual(w.back);
  });

  it("a Mac asleep reads nothing: a long gap in the readings is a stretch away", () => {
    const slept = 5 * MINUTE;
    let w = readEvery(NOT_WATCHED, 0, slept, () => 2);
    const woke = slept + 3 * HOUR;
    w = watched(w, { idleSeconds: 4, onConsole: true }, woke);
    expect(w.back).toEqual({ from: slept, to: woke - 4000 });
  });

  it("somebody at the Mac all along has no stretch, however long the watch", () => {
    const w = readEvery(NOT_WATCHED, 0, 8 * HOUR, () => 20);
    expect(w.back).toBeNull();
    expect(said(w, { idleSeconds: 20, onConsole: true }, 8 * HOUR).back).toBeUndefined();
  });

  it("the stretch is said only for a while after the return, and never while nobody is there", () => {
    const w: Watch = { awaySince: null, lastAt: HOUR, back: { from: 0, to: HOUR } };
    const here = { idleSeconds: 1, onConsole: true };
    expect(said(w, here, HOUR + BACK_SAID_FOR - 1).back).toEqual(w.back);
    expect(said(w, here, HOUR + BACK_SAID_FOR).back).toBeUndefined();
    expect(said(w, { idleSeconds: IDLE_AFTER, onConsole: true }, HOUR + 1).back).toBeUndefined();
  });

  it("a session switched out is away from the switch, at the latest", () => {
    const w = watched(NOT_WATCHED, { idleSeconds: 30, onConsole: false }, HOUR);
    expect(w.awaySince).toBe(HOUR - 30_000);
  });
});
