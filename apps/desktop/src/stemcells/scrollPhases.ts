// @effect-diagnostics nodeBuiltinImport:off -- Loads a native addon from beside the main bundle, before any runtime.
// @effect-diagnostics globalTimers:off -- Clock ticks to a page that just loaded, outside any Effect fiber.
// @effect-diagnostics globalDate:off -- Stamps the line that says whether phases are live, outside any Effect fiber.
/**
 * Stemcells: macOS's trackpad scroll phases, which DOM wheel events lack, sent to the page of
 * the window they happen in for the tab swipe. Without the addon (`stemcells/native/`, not built
 * or not a Mac) the page reads swipes from wheel events alone. Each start logs which in
 * `stemcells-scroll-phases.log` in user data, so an install can be checked.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as Electron from "electron";

/** The channel to the page; scrollPhasesPreload.ts listens on it. */
const CHANNEL = "stemcells:scroll-phases";
/** When (ms after a page loads) the system's clock is sent to it, for it to line up its own. */
const CLOCK_TICKS = [0, 250, 1000, 3000];

interface ScrollPhasesAddon {
  /** Calls back with every phased scroll event: times in seconds on the system's clock. */
  start(
    callback: (
      time: number,
      phase: number,
      momentum: number,
      window: number,
      dx: number,
      dy: number,
      now: number,
    ) => void,
  ): void;
  /** The system's clock (seconds). */
  now(): number;
}

/** The addon beside the main bundle: resources/ in a checkout, prod-resources/ in the built app. */
function loadAddon(): { readonly addon: ScrollPhasesAddon; readonly path: string } | string {
  const failures: string[] = [];
  for (const folder of ["../resources", "../prod-resources"]) {
    const path = NodePath.join(__dirname, folder, "build/stemcells-scroll-phases.node");
    try {
      return { addon: require(path) as ScrollPhasesAddon, path };
    } catch (error) {
      failures.push(error instanceof Error ? error.message.split("\n")[0]! : String(error));
    }
  }
  return failures.join("; ");
}

/** Says, once a start, whether the swipe reads the phases: on stdout and in the user data folder. */
function report(line: string): void {
  const stamped = `${new Date().toISOString()} ${line}\n`;
  process.stdout.write(`[stemcells] ${stamped}`);
  try {
    const folder = Electron.app.getPath("userData");
    NodeFS.mkdirSync(folder, { recursive: true });
    NodeFS.writeFileSync(NodePath.join(folder, "stemcells-scroll-phases.log"), stamped);
  } catch {
    // A folder that can't be written loses the line, nothing more.
  }
}

/** Pages by the system's number for their window, as scroll events name it. */
const pages = new Map<number, Electron.WebContents>();

function pageOf(windowNumber: number): Electron.WebContents | null {
  const known = pages.get(windowNumber);
  if (known !== undefined && !known.isDestroyed()) return known;
  pages.delete(windowNumber);
  for (const window of Electron.BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    if (Number(window.getMediaSourceId().split(":")[1]) !== windowNumber) continue;
    pages.set(windowNumber, window.webContents);
    return window.webContents;
  }
  return null;
}

const loaded = loadAddon();
if (typeof loaded === "string") {
  void Electron.app
    .whenReady()
    .then(() => report(`scroll phases: off, wheel events alone (no addon: ${loaded})`));
} else {
  const { addon, path } = loaded;
  void Electron.app.whenReady().then(() => {
    try {
      addon.start((time, phase, momentum, window, dx, dy, now) => {
        pageOf(window)?.send(CHANNEL, [time * 1000, phase, momentum, dx, dy, now * 1000]);
      });
      report(`scroll phases: live (${path})`);
    } catch (error) {
      report(`scroll phases: off, wheel events alone (the addon didn't start: ${String(error)})`);
    }
  });
  Electron.app.on("browser-window-created", (_event, window) => {
    const page = window.webContents;
    page.on("did-finish-load", () => {
      for (const after of CLOCK_TICKS) {
        setTimeout(() => {
          if (page.isDestroyed()) return;
          const now = addon.now() * 1000;
          page.send(CHANNEL, [now, 0, 0, 0, 0, now]);
        }, after);
      }
    });
  });
}
