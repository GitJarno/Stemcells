// @effect-diagnostics nodeBuiltinImport:off globalDate:off - Two quick reads of macOS's I/O registry through `ioreg`, a command line tool with no Effect counterpart.
import * as NodeChildProcess from "node:child_process";
import * as NodeUtil from "node:util";

// Whether somebody is at this Mac, so Aski's eyes can say when nobody is:
// nobody while the person's session is switched out, or once 5 minutes
// have passed without input of any kind. Read from macOS's I/O registry,
// which needs no permission: the seconds since the last input
// (`HIDIdleTime`) and whether the session is on the console. Elsewhere,
// and when a reading fails, nothing says nobody is there.

/** Seconds without input after which nobody is at the Mac. */
export const IDLE_AFTER = 300;

/** Why nobody is at the Mac. */
export type Away = "switchedOut" | "idle";

export interface Presence {
  readonly present: boolean;
  readonly away?: Away;
}

/** What the registry says: the seconds since the last input, and whether this user's session is on the console. */
export interface Reading {
  readonly idleSeconds: number | null;
  readonly onConsole: boolean | null;
}

/** The first reason nobody is at the Mac, in that order; present when neither holds or nothing could be read. */
export function presenceOf(reading: Reading): Presence {
  if (reading.onConsole === false) return { present: false, away: "switchedOut" };
  if (reading.idleSeconds !== null && reading.idleSeconds >= IDLE_AFTER)
    return { present: false, away: "idle" };
  return { present: true };
}

/** The seconds since the last input, from `ioreg -c IOHIDSystem`'s `HIDIdleTime` (nanoseconds). */
export function idleSecondsOf(ioreg: string): number | null {
  const match = /"HIDIdleTime"\s*=\s*(\d+)/.exec(ioreg);
  return match === null ? null : Number(match[1]) / 1e9;
}

/**
 * Whether the session of user `uid` is on the console, from the registry
 * root's `IOConsoleUsers` as `ioreg -a` prints it: false while another
 * session holds it or none is the user's.
 */
export function onConsoleOf(plist: string, uid: number): boolean | null {
  const users = /<key>IOConsoleUsers<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist);
  if (users === null) return null;
  for (const session of users[1]!.split("</dict>")) {
    const id = /<key>kCGSSessionUserIDKey<\/key>\s*<integer>(\d+)<\/integer>/.exec(session);
    if (id === null || Number(id[1]) !== uid) continue;
    return /<key>kCGSSessionOnConsoleKey<\/key>\s*<true\/>/.test(session);
  }
  return false;
}

const run = NodeUtil.promisify(NodeChildProcess.execFile);
const IOREG = "/usr/sbin/ioreg";
/** How long one reading serves every screen that asks, in milliseconds. */
const FRESH = 2000;

let last: { at: number; presence: Promise<Presence> } | null = null;

async function read(platform: NodeJS.Platform): Promise<Presence> {
  const uid = process.getuid?.();
  if (platform !== "darwin" || uid === undefined) return { present: true };
  const ask = (args: string[]) =>
    run(IOREG, args, { timeout: 2000, maxBuffer: 1 << 20 }).then(
      ({ stdout }) => stdout,
      () => "",
    );
  const [hid, root] = await Promise.all([
    ask(["-c", "IOHIDSystem", "-r", "-d", "1", "-k", "HIDIdleTime"]),
    ask(["-n", "Root", "-d", "1", "-a"]),
  ]);
  return presenceOf({
    idleSeconds: idleSecondsOf(hid),
    onConsole: root === "" ? null : onConsoleOf(root, uid),
  });
}

/** Whether somebody is at this Mac now, on `platform`, read at most once every `FRESH` milliseconds whoever asks. */
export function readPresence(platform: NodeJS.Platform): Promise<Presence> {
  const now = Date.now();
  if (last === null || now - last.at >= FRESH) last = { at: now, presence: read(platform) };
  return last.presence;
}
