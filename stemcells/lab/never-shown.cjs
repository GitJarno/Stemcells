// A desktop lab that never reaches the screen of the person at the Mac, preloaded into
// Electron's main by stemcells/lab/electron: windows are hidden, off every display, and still
// render for capture, and nothing else reaches the person. It fails closed (LAB_EXIT), as does
// a home that isn't a lab's (fakes-only.cjs).
"use strict";

const LAB_EXIT = 86;
/** How far past the leftmost display a window sits. */
const OFF_DISPLAYS = 10_000;
const WATCH_MS = 50;

/** Bounds as Electron gives them: `{ x, y, width, height }`. */
function intersects(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Where a window of `width` sits: left of every display, clear of them all. */
function offDisplays(displays, width) {
  const left = Math.min(0, ...displays.map((display) => display.bounds.x));
  return { x: left - OFF_DISPLAYS - Math.max(0, width), y: 0 };
}

/** The window options a lab gets, whatever the app asked for. */
function labWindowOptions(options, displays) {
  const asked = options ?? {};
  const width = asked.width ?? 800;
  return {
    ...asked,
    ...offDisplays(displays, width),
    show: false,
    // Should a window show anyway, until the guard ends the lab: macOS moves a
    // titled window onto a display as it shows, so it shows there clear and
    // click-through. Pages render and capture the same at any opacity.
    opacity: 0,
    center: false,
    fullscreen: false,
    simpleFullscreen: false,
    kiosk: false,
    paintWhenInitiallyHidden: true,
    enableLargerThanScreen: true,
    webPreferences: { ...asked.webPreferences, backgroundThrottling: false },
  };
}

/** Why `window` breaks the lab, or null: it is visible, or its bounds touch a display. */
function violation(window, displays) {
  if (window.isVisible()) return "a window was shown";
  const bounds = window.getBounds();
  const touched = displays.find((display) => intersects(bounds, display.bounds));
  if (touched) return `a window's bounds ${JSON.stringify(bounds)} touch display ${touched.id}`;
  return null;
}

function install(electron, runtime) {
  const { app, screen } = electron;
  const log = (line) => runtime.log(`[stemcells lab] ${line}`);
  const skipped = (what, result) => () => {
    log(`skipped ${what}`);
    return result;
  };

  // Its own profile, set before the app sets its own, which then can't.
  app.setPath("userData", runtime.profile);
  const setPath = app.setPath.bind(app);
  app.setPath = (name, path) =>
    name === "userData" || name === "sessionData"
      ? log(`kept the lab profile over ${name} ${path}`)
      : setPath(name, path);

  // Out of the Dock, never active.
  const setActivationPolicy = app.setActivationPolicy?.bind(app);
  const accessory = () => setActivationPolicy?.("accessory");
  app.on("will-finish-launching", accessory);
  app.setActivationPolicy = skipped("app.setActivationPolicy");
  app.focus = skipped("app.focus");
  app.show = skipped("app.show");
  if (app.dock) {
    app.dock.show = skipped("app.dock.show", Promise.resolve());
    app.dock.bounce = skipped("app.dock.bounce", 0);
  }

  // Nothing else reaches the person. The dialogs and the shell at once; the
  // rest once the app is ready, as some of Electron's modules read before
  // then keep their own methods (globalShortcut does, so the app gets a
  // stand-in for it below).
  function quiet(ready) {
    const { dialog, shell } = electron;
    for (const name of Object.keys(dialog)) {
      if (typeof dialog[name] !== "function") continue;
      dialog[name] = name.endsWith("Sync")
        ? skipped(`dialog.${name}`, undefined)
        : skipped(
            `dialog.${name}`,
            Promise.resolve({ canceled: true, response: 0, filePaths: [] }),
          );
    }
    shell.openExternal = skipped("shell.openExternal", Promise.resolve());
    shell.openPath = skipped("shell.openPath", Promise.resolve(""));
    shell.showItemInFolder = skipped("shell.showItemInFolder");
    shell.beep = skipped("shell.beep");
    if (!ready) return;
    const { clipboard, Menu, Notification } = electron;
    for (const name of Object.keys(clipboard)) {
      if (/^(write|clear)/.test(name))
        clipboard[name] = skipped(`clipboard.${name}`, Promise.resolve());
    }
    Menu.prototype.popup = skipped("Menu.popup");
    Notification.prototype.show = skipped("Notification.show");
  }
  quiet(false);

  const displays = () => screen.getAllDisplays();

  /** Ends the lab: every window goes, and the app exits non-zero. */
  function stop(reason) {
    log(`STOPPED: ${reason}`);
    for (const window of electron.BaseWindow.getAllWindows()) window.destroy();
    app.exit(LAB_EXIT);
  }

  const guarded = new WeakSet();
  function guard(window) {
    if (guarded.has(window)) return;
    guarded.add(window);
    const keepOff = () => offDisplays(displays(), window.getBounds().width);
    const original = {
      setBounds: window.setBounds.bind(window),
      setContentBounds: window.setContentBounds.bind(window),
      setPosition: window.setPosition.bind(window),
    };
    Object.assign(window, {
      show: skipped("show"),
      showInactive: skipped("showInactive"),
      focus: skipped("focus"),
      moveTop: skipped("moveTop"),
      restore: skipped("restore"),
      maximize: skipped("maximize"),
      minimize: skipped("minimize"),
      center: skipped("center"),
      flashFrame: skipped("flashFrame"),
      setFullScreen: skipped("setFullScreen"),
      setSimpleFullScreen: skipped("setSimpleFullScreen"),
      setKiosk: skipped("setKiosk"),
      setOpacity: skipped("setOpacity"),
      setBounds: (bounds, animate) => original.setBounds({ ...bounds, ...keepOff() }, animate),
      setContentBounds: (bounds, animate) =>
        original.setContentBounds({ ...bounds, ...keepOff() }, animate),
      setPosition: () => {
        const { x, y } = keepOff();
        original.setPosition(x, y);
      },
    });
    window.setIgnoreMouseEvents(true);
    const page = window.webContents;
    if (page) {
      page.setBackgroundThrottling(false);
      Object.assign(page, {
        setBackgroundThrottling: skipped("setBackgroundThrottling"),
        openDevTools: skipped("openDevTools"),
      });
    }
    window.on("show", () => stop("a window was shown"));
    const check = () => {
      if (window.isDestroyed()) return;
      const reason = violation(window, displays());
      if (reason) stop(reason);
    };
    // A window being made reports its default, centred bounds until its
    // constructor has placed it: watch it from when that returns.
    queueMicrotask(() => {
      check();
      window.on("move", check);
      window.on("resize", check);
    });
  }

  // Windows are made through these, so they start hidden and off every display.
  const hiddenFrom = (Window) =>
    new Proxy(Window, {
      construct(target, [options, ...rest]) {
        const window = Reflect.construct(target, [labWindowOptions(options, displays()), ...rest]);
        guard(window);
        return window;
      },
    });
  // A globalShortcut that registers nothing, whenever the app reads it.
  const noShortcuts = {
    register: skipped("globalShortcut.register", false),
    registerAll: skipped("globalShortcut.registerAll"),
  };
  const replaced = {
    BrowserWindow: () => hiddenFrom(electron.BrowserWindow),
    BaseWindow: () => hiddenFrom(electron.BaseWindow),
    globalShortcut: () =>
      new Proxy(electron.globalShortcut, {
        get(target, name) {
          const value = noShortcuts[name] ?? Reflect.get(target, name);
          return typeof value === "function" && !(name in noShortcuts) ? value.bind(target) : value;
        },
      }),
  };
  const made = new Map();
  const lab = Object.create(null);
  for (const key of Object.keys(electron)) {
    const get = replaced[key]
      ? () => made.get(key) ?? made.set(key, replaced[key]()).get(key)
      : () => electron[key];
    Object.defineProperty(lab, key, { enumerable: true, get });
  }
  // Windows made without them (a page's window.open) get the same options and guard.
  app.on("browser-window-created", (_event, window) => guard(window));
  app.on("web-contents-created", (_event, page) => {
    const setHandler = page.setWindowOpenHandler.bind(page);
    const hidden = (result) =>
      result?.action === "allow"
        ? {
            ...result,
            overrideBrowserWindowOptions: labWindowOptions(
              result.overrideBrowserWindowOptions,
              displays(),
            ),
          }
        : result;
    page.setWindowOpenHandler = (handler) => setHandler((details) => hidden(handler(details)));
    setHandler(() => hidden({ action: "allow" }));
  });

  // The backstop: whatever showed a window or put it on a display, the lab ends.
  void app.whenReady().then(() => {
    quiet(true);
    accessory();
    app.dock?.hide();
    const watch = () => {
      for (const window of electron.BaseWindow.getAllWindows()) {
        const reason = violation(window, displays());
        if (reason) return stop(reason);
      }
    };
    runtime.setInterval(watch, WATCH_MS);
    screen.on("display-added", watch);
    screen.on("display-metrics-changed", watch);
    // An app that imported electron as an ES module got the real windows.
    if (!runtime.served()) return stop("the app read electron without require()");
    log(`never shown; profile ${runtime.profile}`);
  });
  return lab;
}

module.exports = { LAB_EXIT, install, intersects, labWindowOptions, offDisplays, violation };

// Electron's main process only. Preloaded through NODE_OPTIONS it runs
// before Electron can resolve "electron", so it starts on the app's first
// require of it, or on the first turn of the event loop, whichever is first.
if (process.versions.electron && process.type === "browser") {
  const NodeFS = require("node:fs");
  const NodeModule = require("node:module");
  const NodeOS = require("node:os");
  const NodePath = require("node:path");
  // A fresh profile per run, so labs never share a single-instance lock.
  // Chromium writes into it as the app ends, so a run clears those a day old.
  const temp = NodeOS.tmpdir();
  // Another lab may be clearing the same folders: one gone already is fine.
  for (const name of NodeFS.readdirSync(temp)) {
    const old = NodePath.join(temp, name);
    const made = name.startsWith("stemcells-lab-")
      ? NodeFS.statSync(old, { throwIfNoEntry: false })
      : undefined;
    if (made !== undefined && Date.now() - made.mtimeMs > 86_400_000) {
      NodeFS.rmSync(old, { recursive: true, force: true });
    }
  }
  const profile =
    process.env.STEMCELLS_LAB_PROFILE ?? NodeFS.mkdtempSync(NodePath.join(temp, "stemcells-lab-"));
  NodeFS.mkdirSync(profile, { recursive: true });
  // stemcells/lab/electron looks for this file to know the helper guards this main.
  NodeFS.writeFileSync(NodePath.join(profile, `.never-shown-${process.pid}`), "");
  // A lab script checks this before it does anything: no helper, no lab.
  globalThis[Symbol.for("stemcells.lab")] = { profile, exitCode: LAB_EXIT };
  const log = (line) => process.stderr.write(`${line}\n`);
  // The home the app was given, which its server runs on, before the app's
  // code runs: every provider in it is a fake (fakes-only.cjs), and it is
  // the home stemcells/lab/electron checked, which it is told of here.
  const fakes = require("./fakes-only.cjs");
  const refused = fakes.homeRefusal(process.env);
  if (refused !== null) {
    NodeFS.writeFileSync(NodePath.join(profile, `.refused-${process.pid}`), refused);
    log(`[stemcells lab] STOPPED: ${refused}`);
    process.exit(LAB_EXIT);
  }
  fakes.fakesFirst(process.env);
  fakes.guardSpawns(log);
  const load = NodeModule._load;
  let lab = null;
  let served = false;
  const start = () =>
    (lab ??= install(load.call(NodeModule, "electron", module, false), {
      profile,
      setInterval,
      served: () => served,
      log,
    }));
  NodeModule._load = function (request, ...rest) {
    if (request !== "electron" && request !== "electron/main")
      return load.call(this, request, ...rest);
    served = true;
    return start();
  };
  setImmediate(start);
  // An error the app doesn't catch would put up Electron's error dialog.
  process.on("uncaughtException", (error) => {
    log(`[stemcells lab] uncaught: ${error?.stack ?? error}`);
    process.exit(1);
  });
}

// Electron run as Node (ELECTRON_RUN_AS_NODE, as the desktop app's server and workers are)
// inherits NODE_OPTIONS too. It can't make a window, so it gets the mark stemcells/lab/electron
// looks for; it and plain Node in a lab start no provider CLI that isn't a fake (fakes-only.cjs).
if (process.type === undefined && process.env.STEMCELLS_LAB_PROFILE) {
  if (process.versions.electron) {
    require("node:fs").writeFileSync(
      require("node:path").join(process.env.STEMCELLS_LAB_PROFILE, `.never-shown-${process.pid}`),
      "",
    );
  }
  const fakes = require("./fakes-only.cjs");
  fakes.fakesFirst(process.env);
  fakes.guardSpawns((line) => process.stderr.write(`${line}\n`));
}
