// @effect-diagnostics nodeBuiltinImport:off -- Loads a native addon from beside the main bundle, before any runtime.
// @effect-diagnostics globalTimers:off -- Clock ticks to a page that just loaded, outside any Effect fiber.
/**
 * Stemcells: macOS's own phases for trackpad scrolls, for the tab swipe
 * (apps/web/src/stemcells/tabs/phases.ts). DOM wheel events lack them. The
 * scroll-phases addon (stemcells/native/scroll-phases.m, built by
 * stemcells/scripts/build-scroll-phases) reports each phased scroll event,
 * and this sends it to the page of the window it happened in, where
 * scrollPhasesPreload.ts hands it on. Without the addon (not built, or not
 * a Mac) nothing is sent, and the page reads swipes from wheel events alone.
 */
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
function loadAddon(): ScrollPhasesAddon | null {
  for (const folder of ["../resources", "../prod-resources"]) {
    try {
      return require(
        NodePath.join(__dirname, folder, "build/stemcells-scroll-phases.node"),
      ) as ScrollPhasesAddon;
    } catch {}
  }
  return null;
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

const addon = loadAddon();
if (addon !== null) {
  void Electron.app.whenReady().then(() =>
    addon.start((time, phase, momentum, window, dx, dy, now) => {
      pageOf(window)?.send(CHANNEL, [time * 1000, phase, momentum, dx, dy, now * 1000]);
    }),
  );
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
