import { describe, expect, it } from "vite-plus/test";

import { IDLE_AFTER, idleSecondsOf, onConsoleOf, presenceOf } from "./presence.ts";

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
