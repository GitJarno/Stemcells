// @effect-diagnostics nodeBuiltinImport:off globalDate:off - Two quick reads of macOS's I/O registry through `ioreg`, a command line tool with no Effect counterpart.
import * as NodeChildProcess from "node:child_process";
import * as NodeUtil from "node:util";

// Whether somebody is at this Mac, so Aski's eyes can say when nobody is:
// nobody while the person's session is switched out, or once 5 minutes
// have passed without input of any kind. Read from macOS's I/O registry,
// which needs no permission: the seconds since the last input
// (`HIDIdleTime`) and whether the session is on the console. Elsewhere,
// and when a reading fails, nothing says nobody is there.
//
// Once asked, the server also reads it itself every minute, so it knows
// how long the person was away even while no page asks (a page out of
// sight asks nothing): when they come back it says the stretch, and Aski
// can tell them what happened meanwhile. A Mac asleep reads nothing, so a
// long gap between readings is a stretch away too.

/** Seconds without input after which nobody is at the Mac. */
export const IDLE_AFTER = 300;

/** Why nobody is at the Mac. */
export type Away = "switchedOut" | "idle";

/** A stretch nobody was at the Mac, in Unix milliseconds: from when they left to their first input back. */
export interface Stretch {
  readonly from: number;
  readonly to: number;
}

export interface Presence {
  readonly present: boolean;
  readonly away?: Away;
  /** Somebody is back: the stretch they were away, said for a while after they return. */
  readonly back?: Stretch;
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

/** What the readings so far say about stretches away. */
export interface Watch {
  /** Since when nobody has been at the Mac, while nobody is. */
  readonly awaySince: number | null;
  /** When the last reading was taken. */
  readonly lastAt: number | null;
  /** The last stretch away that has ended. */
  readonly back: Stretch | null;
}

export const NOT_WATCHED: Watch = { awaySince: null, lastAt: null, back: null };

/** How often the server reads by itself, in milliseconds. */
export const WATCH_EVERY = 60_000;
/** How long after a return its stretch is said, in milliseconds. */
export const BACK_SAID_FOR = 10 * 60_000;

/**
 * The watch after a reading at `at`. Nobody was there from their last input
 * once a reading says so, or from the last reading when the next comes so
 * long after that the Mac must have slept; the stretch ends at the first
 * input back.
 */
export function watched(watch: Watch, reading: Reading, at: number): Watch {
  const lastInput = reading.idleSeconds === null ? at : at - reading.idleSeconds * 1000;
  let since = watch.awaySince;
  if (since === null && watch.lastAt !== null && lastInput - watch.lastAt >= IDLE_AFTER * 1000)
    since = watch.lastAt;
  if (!presenceOf(reading).present)
    return { awaySince: since ?? Math.min(at, lastInput), lastAt: at, back: watch.back };
  return {
    awaySince: null,
    lastAt: at,
    back: since === null ? watch.back : { from: since, to: Math.max(since, lastInput) },
  };
}

/** What the server says after a reading: whether somebody is there, and, back lately, the stretch they were away. */
export function said(watch: Watch, reading: Reading, at: number): Presence {
  const presence = presenceOf(reading);
  const back = watch.back;
  return presence.present && back !== null && at - back.to < BACK_SAID_FOR
    ? { ...presence, back }
    : presence;
}

const run = NodeUtil.promisify(NodeChildProcess.execFile);
const IOREG = "/usr/sbin/ioreg";
/** How long one reading serves every screen that asks, in milliseconds. */
const FRESH = 2000;

let last: { at: number; presence: Promise<Presence> } | null = null;
let watch = NOT_WATCHED;

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
  const reading = {
    idleSeconds: idleSecondsOf(hid),
    onConsole: root === "" ? null : onConsoleOf(root, uid),
  };
  const at = Date.now();
  watch = watched(watch, reading, at);
  return said(watch, reading, at);
}

/** Whether somebody is at this Mac now, on `platform`, read at most once every `FRESH` milliseconds whoever asks. */
export function readPresence(platform: NodeJS.Platform): Promise<Presence> {
  const now = Date.now();
  if (last === null || now - last.at >= FRESH) last = { at: now, presence: read(platform) };
  return last.presence;
}
