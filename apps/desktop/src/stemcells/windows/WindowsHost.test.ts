// @effect-diagnostics nodeBuiltinImport:off -- The test reads the windows' file the host writes.
/**
 * The windows' host against a stand-in for Electron: pages boot, publish
 * and move over the windows' channels, windows open, fail and close, and
 * the app quits, as the main process sees them.
 */
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { expect, vi } from "vite-plus/test";

const electron = vi.hoisted(() => {
  type Listener = (...args: any[]) => unknown;
  class Emitter {
    private readonly listeners = new Map<string, Listener[]>();
    on(name: string, listener: Listener) {
      this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
      return this;
    }
    once(name: string, listener: Listener) {
      const once = (...args: unknown[]) => {
        this.removeListener(name, once);
        listener(...args);
      };
      return this.on(name, once);
    }
    removeListener(name: string, listener: Listener) {
      this.listeners.set(
        name,
        (this.listeners.get(name) ?? []).filter((each) => each !== listener),
      );
      return this;
    }
    removeAllListeners(name: string) {
      this.listeners.delete(name);
      return this;
    }
    emit(name: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(name) ?? []) listener(...args);
      return true;
    }
    /** How many listeners `name` has. */
    count(name: string) {
      return this.listeners.get(name)?.length ?? 0;
    }
  }

  let pageIds = 0;
  /** A page: a window's own, or a preview's `<webview>` guest inside one. */
  class Page extends Emitter {
    readonly id = ++pageIds;
    readonly mainFrame = { top: true };
    readonly sent: Array<{ readonly channel: string; readonly value: unknown }> = [];
    private readonly type: "window" | "webview";
    constructor(type: "window" | "webview") {
      super();
      this.type = type;
    }
    getType() {
      return this.type;
    }
    send(channel: string, value?: unknown) {
      this.sent.push({ channel, value });
    }
    /** What this page heard on `channel`, oldest first. */
    heard(channel: string) {
      return this.sent.filter((each) => each.channel === channel).map((each) => each.value);
    }
    isDestroyed() {
      return false;
    }
    setBackgroundThrottling() {}
  }

  const display = {
    id: 1,
    size: { width: 1440, height: 900 },
    scaleFactor: 2,
    bounds: { x: 0, y: 0, width: 1440, height: 900 },
    workArea: { x: 0, y: 25, width: 1440, height: 875 },
  };
  const windows: Window[] = [];
  const app = new Emitter();
  const focusedWindow = () => windows.find((window) => window.focused) ?? null;
  /** No window of the app has focus any more. */
  const blurAll = () => {
    const was = focusedWindow();
    if (!was) return;
    was.focused = false;
    app.emit("browser-window-blur", {}, was);
  };

  class Window extends Emitter {
    readonly webContents = new Page("window");
    readonly guests: Page[] = [];
    destroyed = false;
    focused = false;
    opacity = 1;
    bounds: { x: number; y: number; width: number; height: number };
    constructor(bounds = { x: 100, y: 100, width: 900, height: 700 }) {
      super();
      this.bounds = bounds;
      windows.push(this);
    }
    isDestroyed() {
      return this.destroyed;
    }
    isFullScreen() {
      return false;
    }
    isMaximized() {
      return false;
    }
    getBounds() {
      return this.bounds;
    }
    getNormalBounds() {
      return this.bounds;
    }
    setBounds(bounds: { x: number; y: number; width: number; height: number }) {
      this.bounds = bounds;
    }
    setFullScreen() {}
    setOpacity(opacity: number) {
      this.opacity = opacity;
    }
    isFocused() {
      return this.focused;
    }
    focus() {
      if (this.focused) return;
      blurAll();
      this.focused = true;
      this.emit("focus");
      app.emit("browser-window-focus", {}, this);
    }
    /** Asks the window to close, as the person or an update's quit does: the app may keep it. */
    close() {
      if (this.destroyed) return;
      let kept = false;
      this.emit("close", { preventDefault: () => void (kept = true) });
      if (!kept) this.destroy();
    }
    /** The window goes, whatever the app would say. */
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.focused = false;
      this.emit("closed");
    }
  }

  const handlers = new Map<string, Listener>();
  const ipcMain = Object.assign(new Emitter(), {
    handlers,
    handle: (channel: string, handler: Listener) => void handlers.set(channel, handler),
    removeHandler: (channel: string) => void handlers.delete(channel),
  });

  return {
    Page,
    Window,
    windows,
    app,
    ipcMain,
    autoUpdater: new Emitter(),
    blurAll,
    reset: () => void windows.splice(0),
    module: {
      app,
      ipcMain,
      screen: Object.assign(new Emitter(), {
        getAllDisplays: () => [display],
        getDisplayMatching: () => display,
        getPrimaryDisplay: () => display,
      }),
      BrowserWindow: {
        fromWebContents: (page: Page) =>
          windows.find((window) => window.webContents === page || window.guests.includes(page)) ??
          null,
        getFocusedWindow: focusedWindow,
        getAllWindows: () => windows.filter((window) => !window.destroyed),
      },
    },
  };
});

/** The flight layer, as the host drives it: whether it is drawing anything. */
const layer = vi.hoisted(() => ({ drawing: false, runs: 0 }));

vi.mock("./flightLayer.ts", () => ({
  FlightLayer: class {
    run() {
      layer.drawing = true;
      layer.runs += 1;
    }
    still() {
      return Promise.resolve("still-1");
    }
    painted() {
      return Promise.resolve();
    }
    end() {
      layer.drawing = false;
    }
  },
}));

vi.mock("electron", () => ({
  ...electron.module,
  autoUpdater: electron.autoUpdater,
}));

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopState from "../../app/DesktopState.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as PreviewManager from "../../preview/Manager.ts";
import * as DesktopWindow from "../../window/DesktopWindow.ts";
import { WINDOWS_CHANNEL } from "./channels.ts";
import * as WindowsHost from "./WindowsHost.ts";

type Window = InstanceType<typeof electron.Window>;
type Page = InstanceType<typeof electron.Page>;

/** Upstream's window maker, failing. */
class NoWindow extends Data.TaggedError("NoWindow") {}

/** A turn of the event loop: a window the host asked for is made, a launch's rest open. */
// oxlint-disable-next-line t3code/no-real-time-wait-in-tests -- a macrotask boundary, not a wait: the host hands upstream's maker its window through runPromise, whose answer lands after this macrotask, and nothing of the host's marks it.
const tick = Effect.promise(() => new Promise((resolve) => setImmediate(resolve)));

/**
 * The host's own timers (its quit check, focus settling, saves) on a clock
 * the test moves with `vi.advanceTimersByTime`; the event loop's turns stay
 * real, so windows are still made.
 */
const hostTimers = Effect.acquireRelease(
  Effect.sync(() =>
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }),
  ),
  () => Effect.sync(() => vi.useRealTimers()),
);

/**
 * The host, started over a fresh windows' file (or `file`, as the last launch
 * left it), and what it was handed.
 */
const startHost = Effect.fn("startHost")(function* (
  options: {
    readonly opens?: boolean;
    readonly file?: string;
    /** Something is already where an unreadable file would be moved aside to. */
    readonly asideTaken?: boolean;
  } = {},
) {
  electron.reset();
  const stateDir = yield* Effect.acquireRelease(
    Effect.sync(() => NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "windows-host-"))),
    (dir) => Effect.sync(() => NodeFS.rmSync(dir, { recursive: true, force: true })),
  );
  const path = NodePath.join(stateDir, "stemcells-windows.json");
  if (options.file !== undefined) NodeFS.writeFileSync(path, options.file);
  if (options.asideTaken) {
    const aside = `${path}.corrupt-${yield* Clock.currentTimeMillis}`;
    NodeFS.mkdirSync(aside);
    NodeFS.writeFileSync(NodePath.join(aside, "taken"), "");
  }
  const quitting = yield* Ref.make(false);
  const setMain = vi.fn((_window: Window) => Effect.void);
  const createExtra = (bounds: Window["bounds"]) =>
    options.opens === false
      ? Effect.fail(new NoWindow())
      : Effect.sync(() => new electron.Window(bounds));
  const services = Layer.mergeAll(
    Layer.succeed(DesktopEnvironment.DesktopEnvironment, { stateDir } as never),
    Layer.succeed(DesktopWindow.DesktopWindow, { createExtra } as never),
    Layer.succeed(ElectronWindow.ElectronWindow, {
      setMain,
      reveal: () => Effect.void,
    } as never),
    Layer.succeed(PreviewManager.PreviewManager, {
      setMainWindow: () => Effect.void,
    } as never),
    Layer.succeed(DesktopState.DesktopState, {
      backendReady: yield* Ref.make(true),
      quitting,
      primaryBackendStartup: yield* SubscriptionRef.make<DesktopState.PrimaryBackendStartup>({
        _tag: "Ready",
      }),
    }),
  );
  yield* Layer.build(WindowsHost.layer.pipe(Layer.provide(services)));
  return {
    setMain,
    /** The folder the host keeps its file in, removed when the test ends. */
    stateDir,
    /** The app's own quitting flag, as an update sets it. */
    setQuitting: (value: boolean) => Ref.set(quitting, value),
    /** The windows' file as the host last wrote it. */
    stored: (): { windows: Array<{ id: string }> } => JSON.parse(NodeFS.readFileSync(path, "utf8")),
    /** The windows' file, as it is. */
    file: () => NodeFS.readFileSync(path, "utf8"),
    /** The other files in the state folder, and what each holds. */
    beside: () =>
      NodeFS.readdirSync(stateDir)
        .filter((name) => name !== "stemcells-windows.json")
        .map((name) => [name, NodeFS.readFileSync(NodePath.join(stateDir, name), "utf8")]),
  };
});

/** A page's synchronous boot, as the preload sends it. */
function boot(page: Page, frame: unknown = page.mainFrame) {
  const event = { sender: page, senderFrame: frame, returnValue: undefined as unknown };
  electron.ipcMain.emit(WINDOWS_CHANNEL.boot, event);
  return event.returnValue as { id: string; lead: boolean; workspace: unknown } | null;
}

function send(page: Page, channel: string, value?: unknown, frame: unknown = page.mainFrame) {
  electron.ipcMain.emit(channel, { sender: page, senderFrame: frame }, value);
}

function invoke(page: Page, channel: string, value?: unknown) {
  const handler = electron.ipcMain.handlers.get(channel)!;
  return handler({ sender: page, senderFrame: page.mainFrame }, value);
}

interface Snapshot {
  readonly windows: ReadonlyArray<{ id: string; version: number; workspace: unknown }>;
  readonly lead: string | null;
}

const snapshot = (page: Page) => invoke(page, WINDOWS_CHANNEL.snapshot) as Snapshot | null;
const idsOf = (page: Page) => snapshot(page)!.windows.map((window) => window.id);

/** Upstream's main window, its page booted and its workspace published. */
const mainWindow = Effect.fn("mainWindow")(function* () {
  const window = new electron.Window();
  const id = boot(window.webContents)!.id;
  send(window.webContents, WINDOWS_CHANNEL.publish, "a-tabs");
  yield* tick;
  return { window, id };
});

/** A move from `from` that opens window `id` holding `workspace`. */
function openWindow(from: Page, id: string, workspace: unknown) {
  const book = snapshot(from)!;
  return invoke(from, WINDOWS_CHANNEL.commit, {
    open: [
      {
        id,
        frame: { x: 200, y: 200, width: 900, height: 700 },
        display: "1:1440x900@2",
        fullScreen: false,
        workspace,
      },
    ],
    change: [],
    close: [],
    front: id,
    lead: book.lead,
    memories: [],
    basis: Object.fromEntries(book.windows.map((window) => [window.id, window.version])),
  });
}

/** The window a move opened and upstream's maker made, its page booted. */
const opened = Effect.fn("opened")(function* (from: Page, id: string) {
  expect(openWindow(from, id, `${id}-tabs`)).toBe("done");
  yield* tick;
  const window = electron.windows.at(-1)!;
  boot(window.webContents);
  return window;
});

describe("the windows' host", () => {
  it.effect(
    "keeps every window through an update's quit, which closes them before before-quit",
    () =>
      Effect.gen(function* () {
        const host = yield* startHost();
        const a = yield* mainWindow();
        const c = yield* opened(a.window.webContents, "c");

        // The updater raises the app's flag, then closes every window.
        yield* host.setQuitting(true);
        electron.autoUpdater.emit("before-quit-for-update");
        c.close();
        a.window.close();
        electron.app.emit("before-quit");

        // Nothing holds a window back from the update's quit, and the book keeps them all.
        expect([c.isDestroyed(), a.window.isDestroyed()]).toEqual([true, true]);
        expect(host.stored().windows.map((window) => window.id)).toEqual(
          expect.arrayContaining([a.id, "c"]),
        );
      }).pipe(Effect.scoped),
  );

  it.effect("keeps them too when only the app's own quitting flag says so", () =>
    Effect.gen(function* () {
      const host = yield* startHost();
      const a = yield* mainWindow();
      const c = yield* opened(a.window.webContents, "c");

      yield* host.setQuitting(true);
      c.close();
      a.window.close();
      electron.app.emit("before-quit");

      expect([c.isDestroyed(), a.window.isDestroyed()]).toEqual([true, true]);
      expect(host.stored().windows).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.effect(
    "brings every window back when an update that couldn't install lets the app carry on",
    () =>
      Effect.gen(function* () {
        const host = yield* startHost();
        const a = yield* mainWindow();
        yield* opened(a.window.webContents, "c");
        yield* opened(a.window.webContents, "d");

        yield* host.setQuitting(true);
        electron.autoUpdater.emit("before-quit-for-update");
        for (const window of electron.windows) window.close();
        // The install failed: the app's flag goes down, and the app carries on, windowless.
        yield* host.setQuitting(false);

        // A dock click (or the backend coming back) makes upstream's main window again.
        const back = new electron.Window();
        expect(boot(back.webContents)?.id).toBe(a.id);
        yield* tick;
        const reopened = electron.windows.filter((window) => !window.isDestroyed());
        expect(reopened).toHaveLength(3);
        const ids = reopened.map((window) => boot(window.webContents)?.id);
        expect(ids).toEqual(expect.arrayContaining([a.id, "c", "d"]));
        expect(idsOf(back.webContents)).toEqual(expect.arrayContaining([a.id, "c", "d"]));

        // And a window the person closes now goes, as the app isn't quitting any more.
        const d = reopened[ids.indexOf("d")]!;
        d.close();
        expect(d.webContents.heard(WINDOWS_CHANNEL.closeRequest)).toHaveLength(1);
        d.destroy();
        expect(idsOf(back.webContents)).not.toContain("d");
      }).pipe(Effect.scoped),
  );

  it.effect(
    "brings back a window closed while an update stopped the backends, once the install fails early",
    () =>
      Effect.gen(function* () {
        yield* hostTimers;
        const host = yield* startHost();
        const a = yield* mainWindow();
        const c = yield* opened(a.window.webContents, "c");

        // The update raises the flag and stops the backends; the person closes a window meanwhile.
        yield* host.setQuitting(true);
        c.close();
        expect(idsOf(a.window.webContents)).toContain("c");
        // The install fails before it closes anything: the flag goes down, and the app carries on.
        yield* host.setQuitting(false);
        // The host's quit check sees it, and the window is made.
        vi.advanceTimersByTime(250);
        yield* tick;
        yield* tick;

        const reopened = electron.windows.filter(
          (window) => !window.isDestroyed() && window !== a.window,
        );
        expect(reopened).toHaveLength(1);
        expect(boot(reopened[0]!.webContents)?.id).toBe("c");
        // And a window the person closes now goes, as the app isn't quitting any more.
        const c2 = reopened[0]!;
        c2.close();
        expect(c2.webContents.heard(WINDOWS_CHANNEL.closeRequest)).toHaveLength(1);
        c2.destroy();
        expect(idsOf(a.window.webContents)).not.toContain("c");
      }).pipe(Effect.scoped),
  );

  it.effect(
    "moves an unreadable windows' file aside, where the next save can't write over it",
    () =>
      Effect.gen(function* () {
        const host = yield* startHost({ file: '{"version":1,"windows":[' });
        const a = yield* mainWindow();
        electron.app.emit("before-quit");

        expect(host.stored().windows.map((window) => window.id)).toEqual([a.id]);
        expect(host.beside()).toEqual([
          [
            expect.stringMatching(/^stemcells-windows\.json\.corrupt-\d+$/),
            '{"version":1,"windows":[',
          ],
        ]);
      }).pipe(Effect.scoped),
  );

  it.effect("saves nothing over a windows' file it could neither read nor move aside", () =>
    Effect.gen(function* () {
      const host = yield* startHost({ file: '{"version":1,"windows":[', asideTaken: true });
      const a = yield* mainWindow();
      send(a.window.webContents, WINDOWS_CHANNEL.publish, "a-tabs, later");
      electron.app.emit("before-quit");

      expect(host.file()).toBe('{"version":1,"windows":[');
    }).pipe(Effect.scoped),
  );

  it.effect(
    "hears only the app's own pages: a preview's guest or an inner frame learns and changes nothing",
    () =>
      Effect.gen(function* () {
        yield* startHost();
        const a = yield* mainWindow();
        const page = a.window.webContents;
        const guest = new electron.Page("webview");
        a.window.guests.push(guest);
        const before = JSON.stringify(snapshot(page));

        expect(boot(guest)).toBeNull();
        expect(snapshot(guest)).toBeNull();
        const closeA = {
          open: [],
          change: [],
          close: [a.id],
          front: null,
          lead: null,
          memories: [],
          basis: { [a.id]: snapshot(page)!.windows[0]!.version },
        };
        expect(invoke(guest, WINDOWS_CHANNEL.commit, closeA)).toBeNull();
        send(guest, WINDOWS_CHANNEL.publish, "the guest's");
        send(page, WINDOWS_CHANNEL.publish, "an inner frame's", { inner: true });
        expect(boot(page, { inner: true })).toBeNull();

        expect(JSON.stringify(snapshot(page))).toBe(before);
        expect(a.window.isDestroyed()).toBe(false);
        send(page, WINDOWS_CHANNEL.publish, "its own");
        expect(snapshot(page)!.windows[0]!.workspace).toBe("its own");
      }).pipe(Effect.scoped),
  );

  it.effect("gives a window's tabs back when the window a move opened couldn't open", () =>
    Effect.gen(function* () {
      yield* startHost({ opens: false });
      const a = yield* mainWindow();
      expect(openWindow(a.window.webContents, "c", "c-tabs")).toBe("done");
      yield* tick;

      expect(a.window.webContents.heard(WINDOWS_CHANNEL.returned)).toEqual(["c-tabs"]);
      expect(idsOf(a.window.webContents)).toEqual([a.id]);
      expect(snapshot(a.window.webContents)!.lead).toBe(a.id);
    }).pipe(Effect.scoped),
  );

  it.effect("closes a window a move closed while it was still being made, as it arrives", () =>
    Effect.gen(function* () {
      yield* startHost();
      const a = yield* mainWindow();
      const page = a.window.webContents;
      expect(openWindow(page, "c", "c-tabs")).toBe("done");
      // Taken back before upstream's maker has handed the window over.
      const book = snapshot(page)!;
      expect(
        invoke(page, WINDOWS_CHANNEL.commit, {
          open: [],
          change: [],
          close: ["c"],
          front: a.id,
          lead: book.lead,
          memories: [],
          basis: Object.fromEntries(book.windows.map((window) => [window.id, window.version])),
        }),
      ).toBe("done");
      // Made, then handed over.
      yield* tick;
      yield* tick;

      expect(electron.windows.filter((window) => !window.isDestroyed())).toEqual([a.window]);
      expect(idsOf(page)).toEqual([a.id]);
    }).pipe(Effect.scoped),
  );

  it.effect(
    "lets only a window whose page has loaded lead, and promotes the next page to load when none has",
    () =>
      Effect.gen(function* () {
        const host = yield* startHost();
        const a = yield* mainWindow();
        const b = yield* opened(a.window.webContents, "b");
        expect(openWindow(b.webContents, "c", "c-tabs")).toBe("done");
        yield* tick;
        const c = electron.windows.at(-1)!;
        c.focus();

        a.window.destroy();
        expect(host.setMain).toHaveBeenLastCalledWith(b);
        expect(b.webContents.heard(WINDOWS_CHANNEL.lead).at(-1)).toBe(true);
        b.destroy();
        expect(boot(c.webContents)!.lead).toBe(true);
        expect(host.setMain).toHaveBeenLastCalledWith(c);
      }).pipe(Effect.scoped),
  );

  it.effect(
    "withdraws a window that couldn't open from the others, which heard it hold its tabs",
    () =>
      Effect.gen(function* () {
        yield* startHost({ opens: false });
        const a = yield* mainWindow();
        const b = new electron.Window();
        boot(b.webContents);
        expect(openWindow(a.window.webContents, "c", "c-tabs")).toBe("done");
        yield* tick;

        const news = b.webContents.heard(WINDOWS_CHANNEL.elsewhere) as Array<{ id: string }>;
        expect(news.filter((window) => window.id === "c")).toEqual([
          { id: "c", workspace: "c-tabs" },
          { id: "c", workspace: null },
        ]);
      }).pipe(Effect.scoped),
  );

  it.effect(
    "has the focused window notify, not the lead, and the lead while no window has focus",
    () =>
      Effect.gen(function* () {
        yield* hostTimers;
        yield* startHost();
        const a = yield* mainWindow();
        const b = yield* opened(a.window.webContents, "b");
        const notifies = (window: Window) =>
          window.webContents.heard(WINDOWS_CHANNEL.notifies).at(-1);

        b.focus();
        expect([notifies(a.window), notifies(b)]).toEqual([false, true]);
        // Focus moving between windows blurs one first: the app waits a moment.
        electron.blurAll();
        vi.advanceTimersByTime(100);
        expect([notifies(a.window), notifies(b)]).toEqual([true, false]);
        a.window.focus();
        expect([notifies(a.window), notifies(b)]).toEqual([true, false]);
        const late = new electron.Window();
        late.focus();
        expect((boot(late.webContents) as { notifies?: boolean }).notifies).toBe(true);
        expect([notifies(a.window), notifies(b)]).toEqual([false, false]);
      }).pipe(Effect.scoped),
  );

  it.effect("stops saving once it stops, so a later quit writes nothing where its file was", () =>
    Effect.gen(function* () {
      const stateDir = yield* Effect.gen(function* () {
        const host = yield* startHost();
        const a = yield* mainWindow();
        yield* opened(a.window.webContents, "c");
        return host.stateDir;
      }).pipe(Effect.scoped);

      electron.app.emit("before-quit");
      expect(NodeFS.existsSync(stateDir)).toBe(false);
    }),
  );
});

describe("a flight", () => {
  /** What the host hears from a page while it flies. */
  const watched = ["destroyed", "render-process-gone", "did-start-navigation"];
  const fly = (page: Page) => send(page, WINDOWS_CHANNEL.flight, [{ op: "end", id: "chip" }]);

  it.effect("ends when the page flying it crashes, loads afresh, boots again or goes", () =>
    Effect.gen(function* () {
      yield* startHost();
      const a = yield* mainWindow();
      const page = a.window.webContents;
      const losses = {
        crashed: () => page.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 }),
        reloaded: () =>
          page.emit("did-start-navigation", { isMainFrame: true, isSameDocument: false }),
        booted: () => boot(page),
        destroyed: () => page.emit("destroyed"),
      };
      for (const [how, lose] of Object.entries(losses)) {
        fly(page);
        // A route change in the page, or a frame inside it loading, is no reload.
        page.emit("did-start-navigation", { isMainFrame: true, isSameDocument: true });
        page.emit("did-start-navigation", { isMainFrame: false, isSameDocument: false });
        expect(layer.drawing, how).toBe(true);
        lose();
        expect(layer.drawing, how).toBe(false);
      }
    }).pipe(Effect.scoped),
  );

  /** A move from `page` that opens window `id`, or closes it. */
  const move = (page: Page, change: { open?: string; close?: string }) => {
    const book = snapshot(page)!;
    return {
      open: change.open
        ? [
            {
              id: change.open,
              frame: { x: 200, y: 200, width: 900, height: 700 },
              display: "1:1440x900@2",
              fullScreen: false,
              workspace: `${change.open}-tabs`,
            },
          ]
        : [],
      change: [],
      close: change.close ? [change.close] : [],
      front: change.open ?? null,
      lead: book.lead,
      memories: [],
      basis: Object.fromEntries(book.windows.map((window) => [window.id, window.version])),
    };
  };

  it.effect("ends with the window warmed for its drop gone, when its page crashes", () =>
    Effect.gen(function* () {
      yield* startHost();
      const a = yield* mainWindow();
      const page = a.window.webContents;
      send(page, WINDOWS_CHANNEL.warm, move(page, { open: "w" }));
      yield* tick;
      yield* tick;
      const warm = electron.windows.at(-1)!;
      expect(warm).not.toBe(a.window);

      page.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
      expect(warm.isDestroyed()).toBe(true);
      expect(idsOf(page)).toEqual([a.id]);
    }).pipe(Effect.scoped),
  );

  it.effect("shows the window hidden under it again, when its page crashes", () =>
    Effect.gen(function* () {
      yield* startHost();
      const a = yield* mainWindow();
      const page = a.window.webContents;
      // Its only tab carried, the window hides under its still on the layer.
      send(page, WINDOWS_CHANNEL.windowShown, false);
      expect(a.window.opacity).toBe(0);

      page.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
      expect(a.window.opacity).toBe(1);
    }).pipe(Effect.scoped),
  );

  it.effect(
    "stays the page's whose drop waits to land: another window's only tab carried takes none of it",
    () =>
      Effect.gen(function* () {
        yield* startHost();
        const a = yield* mainWindow();
        const page = a.window.webContents;
        const b = yield* opened(page, "b");
        send(page, WINDOWS_CHANNEL.warm, move(page, { open: "w" }));
        yield* tick;
        yield* tick;
        const warm = electron.windows.at(-1)!;

        // b's only tab carried while a's drop waits to land: b doesn't hide.
        send(b.webContents, WINDOWS_CHANNEL.windowShown, false);
        expect(b.opacity).toBe(1);
        // The flight is still a's, heard from a's page.
        page.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
        expect(warm.isDestroyed()).toBe(true);
        // Once it's over, b's carry hides b.
        send(b.webContents, WINDOWS_CHANNEL.windowShown, false);
        expect(b.opacity).toBe(0);
      }).pipe(Effect.scoped),
  );

  it.effect("has the strip it was making room in close up, when its page crashes", () =>
    Effect.gen(function* () {
      yield* startHost();
      const a = yield* mainWindow();
      const page = a.window.webContents;
      const b = yield* opened(page, "b");
      fly(page);
      send(page, WINDOWS_CHANNEL.room, { window: "b", visit: { tabId: "t", width: 160, slot: 1 } });

      page.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
      expect(b.webContents.heard(WINDOWS_CHANNEL.room)).toEqual([
        { tabId: "t", width: 160, slot: 1 },
        null,
      ]);
    }).pipe(Effect.scoped),
  );

  it.effect("closes the window a move gave away under it, when its page crashes", () =>
    Effect.gen(function* () {
      yield* startHost();
      const a = yield* mainWindow();
      const page = a.window.webContents;
      const b = yield* opened(page, "b");
      // Its only tab carried into b's strip: the window goes once its still has landed there.
      fly(page);
      send(page, WINDOWS_CHANNEL.windowShown, false);
      expect(invoke(page, WINDOWS_CHANNEL.commit, move(page, { close: a.id }))).toBe("done");
      expect(a.window.isDestroyed()).toBe(false);

      page.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
      expect(a.window.isDestroyed()).toBe(true);
      expect(idsOf(b.webContents)).toEqual(["b"]);
    }).pipe(Effect.scoped),
  );

  it.effect("closes a warmed window a move opened and another closed before it was made", () =>
    Effect.gen(function* () {
      yield* startHost();
      const a = yield* mainWindow();
      const page = a.window.webContents;
      send(page, WINDOWS_CHANNEL.warm, move(page, { open: "w" }));
      expect(invoke(page, WINDOWS_CHANNEL.commit, move(page, { open: "w" }))).toBe("done");
      expect(invoke(page, WINDOWS_CHANNEL.commit, move(page, { close: "w" }))).toBe("done");
      yield* tick;
      yield* tick;

      expect(electron.windows.filter((window) => !window.isDestroyed())).toEqual([a.window]);
      expect(idsOf(page)).toEqual([a.id]);
    }).pipe(Effect.scoped),
  );

  it.effect("hears its page once however often it draws, and not at all once it ends", () =>
    Effect.gen(function* () {
      yield* startHost();
      const a = yield* mainWindow();
      const page = a.window.webContents;
      const hearing = () => watched.map((name) => page.count(name));
      for (let flight = 0; flight < 3; flight++) {
        fly(page);
        fly(page);
        expect(hearing()).toEqual([1, 1, 1]);
        send(page, WINDOWS_CHANNEL.flightEnd);
        expect(hearing()).toEqual([0, 0, 0]);
      }
    }).pipe(Effect.scoped),
  );

  it.effect(
    "is one page's while it lasts: another's draws nothing, takes no still, ends nothing",
    () =>
      Effect.gen(function* () {
        yield* startHost();
        const a = yield* mainWindow();
        const b = yield* opened(a.window.webContents, "b");
        fly(a.window.webContents);
        const drawn = layer.runs;

        // b's Gather pressed while a's flies.
        fly(b.webContents);
        expect(layer.runs).toBe(drawn);
        expect(
          yield* Effect.promise(async () => invoke(b.webContents, WINDOWS_CHANNEL.flightStill, {})),
        ).toBeNull();
        send(b.webContents, WINDOWS_CHANNEL.flightEnd);
        expect(layer.drawing).toBe(true);

        send(a.window.webContents, WINDOWS_CHANNEL.flightEnd);
        expect(layer.drawing).toBe(false);
        fly(b.webContents);
        expect(layer.drawing).toBe(true);
      }).pipe(Effect.scoped),
  );
});
