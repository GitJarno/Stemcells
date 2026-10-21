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
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
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
  }

  let pageIds = 0;
  /** A page: a window's own, or a preview's `<webview>` guest inside one. */
  class Page {
    readonly id = ++pageIds;
    readonly mainFrame = { top: true };
    readonly sent: Array<{ readonly channel: string; readonly value: unknown }> = [];
    private readonly type: "window" | "webview";
    constructor(type: "window" | "webview") {
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
    close() {
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
 * The host, started over a fresh windows' file (or `file`, as the last launch
 * left it), and what it was handed.
 */
const startHost = Effect.fn("startHost")(function* (
  options: { readonly opens?: boolean; readonly file?: string } = {},
) {
  electron.reset();
  const stateDir = yield* Effect.acquireRelease(
    Effect.sync(() => NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "windows-host-"))),
    (dir) => Effect.sync(() => NodeFS.rmSync(dir, { recursive: true, force: true })),
  );
  const path = NodePath.join(stateDir, "stemcells-windows.json");
  if (options.file !== undefined) NodeFS.writeFileSync(path, options.file);
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
    Layer.succeed(DesktopState.DesktopState, { backendReady: yield* Ref.make(true), quitting }),
  );
  yield* Layer.build(WindowsHost.layer.pipe(Layer.provide(services)));
  return {
    setMain,
    /** The app's own quitting flag, as an update sets it. */
    setQuitting: (value: boolean) => Ref.set(quitting, value),
    /** The windows' file as the host last wrote it. */
    stored: (): { windows: Array<{ id: string }> } => JSON.parse(NodeFS.readFileSync(path, "utf8")),
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

        electron.autoUpdater.emit("before-quit-for-update");
        c.close();
        a.window.close();
        electron.app.emit("before-quit");

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

      expect(host.stored().windows).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.effect(
    "drops a closed window again once an update that couldn't install lets the app carry on",
    () =>
      Effect.gen(function* () {
        const host = yield* startHost();
        const a = yield* mainWindow();
        const c = yield* opened(a.window.webContents, "c");
        const d = yield* opened(a.window.webContents, "d");

        yield* host.setQuitting(true);
        c.close();
        expect(idsOf(a.window.webContents)).toContain("c");
        yield* host.setQuitting(false);
        d.close();
        expect(idsOf(a.window.webContents)).not.toContain("d");
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

        a.window.close();
        expect(host.setMain).toHaveBeenLastCalledWith(b);
        expect(b.webContents.heard(WINDOWS_CHANNEL.lead).at(-1)).toBe(true);
        b.close();
        expect(boot(c.webContents)!.lead).toBe(true);
        expect(host.setMain).toHaveBeenLastCalledWith(c);
      }).pipe(Effect.scoped),
  );
});
