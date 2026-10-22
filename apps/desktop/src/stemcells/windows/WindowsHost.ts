// @effect-diagnostics nodeBuiltinImport:off -- The windows' file is written once more, synchronously, as the app quits.
// @effect-diagnostics globalTimers:off -- Saving waits for a quiet moment, outside any Effect fiber.
/**
 * Stemcells: more than one app window (stemcells/tasks/windows.md). Keeps
 * the book of windows (book.ts), answers each page's boot, publishes and
 * moves (windowsPreload.ts), opens and closes windows through upstream's
 * own window maker, passes the lead on when the lead window closes, and
 * keeps the book in the desktop state folder between launches.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import * as Electron from "electron";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopState from "../../app/DesktopState.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as PreviewManager from "../../preview/Manager.ts";
import * as DesktopWindow from "../../window/DesktopWindow.ts";
import { WindowBook, type DisplayInfo, type Rect, type Transaction } from "./book.ts";
import { WINDOWS_CHANNEL, type WindowBoot } from "./channels.ts";
import { fromWindowPage } from "./senders.ts";
import { readStoredFile } from "./storedFile.ts";

const FILE_NAME = "stemcells-windows.json";
/** How long the book rests before it's written: windows move and resize in bursts. */
const SAVE_AFTER_MS = 500;
/** Focus moving between windows blurs one before it focuses the next. */
const FOCUS_SETTLE_MS = 50;
/**
 * How often, while the app is quitting, the host looks whether it still is:
 * an update that can't install lowers the flag with nothing to tell of it.
 */
const QUIT_CHECK_MS = 250;

/** One key per monitor at one size and scale, stable across launches. */
export function displayKey(display: Electron.Display): string {
  return `${display.id}:${display.size.width}x${display.size.height}@${display.scaleFactor}`;
}

function displayInfo(display: Electron.Display): DisplayInfo {
  return { key: displayKey(display), bounds: display.bounds, workArea: display.workArea };
}

/** The frame a window goes back to: its normal bounds while full screen or maximized. */
function frameOf(window: Electron.BrowserWindow): Rect {
  return window.isFullScreen() || window.isMaximized()
    ? window.getNormalBounds()
    : window.getBounds();
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== "object" || value === null) return false;
  const { open, change, close, basis } = value as Record<string, unknown>;
  return (
    Array.isArray(open) &&
    Array.isArray(change) &&
    Array.isArray(close) &&
    typeof basis === "object" &&
    basis !== null
  );
}

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    const desktopWindow = yield* DesktopWindow.DesktopWindow;
    const electronWindow = yield* ElectronWindow.ElectronWindow;
    const previewManager = yield* PreviewManager.PreviewManager;
    const desktopState = yield* DesktopState.DesktopState;
    const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());

    const path = NodePath.join(environment.stateDir, FILE_NAME);
    const { stored, unreadable } = readStoredFile(
      path,
      WindowBook.understands,
      yield* Clock.currentTimeMillis,
    );
    if (unreadable) {
      yield* Effect.logWarning(
        unreadable.movedTo
          ? "The windows' file couldn't be read; moved it aside and started afresh"
          : "The windows' file couldn't be read, nor moved aside; starting afresh, saving nothing over it",
        { path, movedTo: unreadable.movedTo },
      );
    }
    /** A file that couldn't be read or moved aside is left as it is: this run saves nothing. */
    const saving = unreadable?.movedTo !== null;
    const book = WindowBook.read(stored);
    /** The open windows by id, and the ids by their pages. */
    const live = new Map<string, Electron.BrowserWindow>();
    const pages = new Map<number, string>();
    /** Windows a move opened whose pages haven't loaded yet, oldest first. */
    const opening: string[] = [];
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let quitCheck: ReturnType<typeof setInterval> | undefined;

    /**
     * Whether the app is quitting, as the app's own flag says: the windows
     * that close while it is open again at the next launch. The flag is up
     * before anything closes a window to quit (`before-quit`, or an update,
     * which closes every window before `before-quit`), and goes down again
     * when an update can't install and the app carries on: then the windows
     * kept meanwhile open again (`quitEnded`).
     */
    const quittingNow = () => {
      const now = Ref.getUnsafe(desktopState.quitting);
      book.quit(now);
      if (now && quitCheck === undefined) {
        quitCheck = setInterval(() => {
          if (!Ref.getUnsafe(desktopState.quitting)) quitEnded();
        }, QUIT_CHECK_MS);
        quitCheck.unref();
      }
      return now;
    };

    const saveNow = () => {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      if (!saving) return;
      try {
        NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
        NodeFS.writeFileSync(`${path}.tmp`, JSON.stringify(book.stored()));
        NodeFS.renameSync(`${path}.tmp`, path);
      } catch {
        // The windows open as they were last saved, nothing worse.
      }
    };
    const save = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, SAVE_AFTER_MS);
    };

    const readDisplays = () => {
      book.setDisplays(Electron.screen.getAllDisplays().map(displayInfo));
    };

    const placeFromWindow = (id: string, window: Electron.BrowserWindow) => {
      if (window.isDestroyed()) return;
      const frame = frameOf(window);
      const display = displayKey(Electron.screen.getDisplayMatching(frame));
      if (book.place(id, frame, display, window.isFullScreen())) save();
    };

    /** Tells every window but `id` what `id` holds now (null: it closed). */
    const tellOthers = (id: string, workspace: unknown) => {
      for (const [other, window] of live) {
        if (other !== id && !window.isDestroyed()) {
          window.webContents.send(WINDOWS_CHANNEL.elsewhere, { id, workspace });
        }
      }
    };

    const tellLeads = () => {
      for (const [id, window] of live) {
        if (!window.isDestroyed()) {
          window.webContents.send(WINDOWS_CHANNEL.lead, book.leadId() === id);
        }
      }
    };

    /** The window that raises the chats' notifications now (book.notifier). */
    const notifierNow = () => {
      const focused = Electron.BrowserWindow.getFocusedWindow();
      return book.notifier([...live].find(([, window]) => window === focused)?.[0] ?? null);
    };
    const tellNotifier = () => {
      const notifier = notifierNow();
      for (const [id, window] of live) {
        if (!window.isDestroyed()) {
          window.webContents.send(WINDOWS_CHANNEL.notifies, notifier === id);
        }
      }
    };
    const blurred = () => setTimeout(tellNotifier, FOCUS_SETTLE_MS);

    /** Upstream's main window follows the lead: its menu, reload and browser previews act there. */
    const promote = (id: string | null) => {
      const window = id === null ? undefined : live.get(id);
      if (window && !window.isDestroyed()) {
        void runPromise(electronWindow.setMain(window));
        void runPromise(previewManager.setMainWindow(window).pipe(Effect.ignore));
      }
      tellLeads();
      tellNotifier();
    };

    const closed = (id: string) => {
      live.delete(id);
      quittingNow();
      const { removed, leadChanged } = book.closed(id);
      if (!removed) return;
      tellOthers(id, null);
      if (leadChanged) promote(book.leadId());
      const lead = live.get(book.leadId() ?? "");
      if (lead && !lead.isDestroyed()) {
        lead.webContents.send(WINDOWS_CHANNEL.closed, removed.workspace);
      }
      save();
    };

    const bind = (id: string, window: Electron.BrowserWindow) => {
      if (live.get(id) === window) return;
      live.set(id, window);
      const page = window.webContents.id;
      pages.set(page, id);
      const place = () => placeFromWindow(id, window);
      window.on("move", place);
      window.on("resize", place);
      window.on("enter-full-screen", place);
      window.on("leave-full-screen", place);
      window.on("focus", () => book.focus(id));
      window.once("closed", () => {
        pages.delete(page);
        closed(id);
      });
    };

    /**
     * A window that couldn't open: its record goes, and its tabs go back to
     * `home`, the window they came from (else the lead), brought forward. One
     * that couldn't open as the app quits stays for the next launch.
     */
    const failed = (id: string, home: string | null) => {
      if (quittingNow()) return;
      const { removed, leadChanged } = book.failed(id);
      if (!removed) return;
      // The move told the other windows this one holds its chats.
      tellOthers(id, null);
      if (leadChanged) promote(book.leadId());
      const window = live.get(home ?? "") ?? live.get(book.leadId() ?? "");
      if (window && !window.isDestroyed()) {
        window.webContents.send(WINDOWS_CHANNEL.returned, removed.workspace);
        window.focus();
      }
      save();
    };

    const open = (id: string, frame: Rect, fullScreen: boolean, home: string | null) => {
      const create = desktopWindow.createExtra;
      if (!create) {
        failed(id, home);
        return;
      }
      opening.push(id);
      void runPromise(create(frame, true)).then(
        (window) => {
          const waiting = opening.indexOf(id);
          if (waiting >= 0) opening.splice(waiting, 1);
          // A move closed it while it was being made: it goes as it arrives.
          if (!book.get(id)) {
            if (!window.isDestroyed()) window.destroy();
            return;
          }
          if (!live.has(id)) bind(id, window);
          if (fullScreen) window.once("ready-to-show", () => window.setFullScreen(true));
        },
        () => {
          const waiting = opening.indexOf(id);
          if (waiting >= 0) opening.splice(waiting, 1);
          if (!live.has(id)) failed(id, home);
        },
      );
    };

    /**
     * The app didn't quit after all (an update that couldn't install): the
     * windows that closed meanwhile open again. With none left open, upstream's
     * main window opens them when it comes back (`boot`).
     */
    const quitEnded = () => {
      clearInterval(quitCheck);
      quitCheck = undefined;
      book.quit(false);
      if (live.size > 0) openTheRest();
    };

    /**
     * Every window kept in the book without one opens, once upstream's main
     * window has loaded: at launch, and when it comes back after the app
     * closed them all to quit and then didn't (an update that couldn't
     * install).
     */
    const openTheRest = () => {
      if (quittingNow()) return;
      for (const record of [...book.snapshot().windows].toReversed()) {
        if (!live.has(record.id) && !opening.includes(record.id)) {
          open(record.id, record.frame, record.fullScreen, book.leadId());
        }
      }
    };

    /**
     * Who a loading page is. A window a move opened is known by its page, or,
     * if its page beat the window maker back, by the order it opened in. Any
     * other is upstream's main window: the lead's record if it's free, else
     * any record without a window, else a new one.
     */
    const boot = (sender: Electron.WebContents): WindowBoot | null => {
      const window = Electron.BrowserWindow.fromWebContents(sender);
      if (!window || window.webContents !== sender) return null;
      let id = pages.get(sender.id);
      if (!id) {
        const waiting = opening.shift();
        // Its window was closed by a move while it was being made: it goes, unbooted.
        if (waiting !== undefined && !book.get(waiting)) {
          setImmediate(() => window.isDestroyed() || window.destroy());
          return null;
        }
        const free = book.ids().filter((candidate) => !live.has(candidate));
        const lead = book.leadId();
        id =
          waiting ??
          (lead !== null && free.includes(lead) ? lead : free[0]) ??
          book.add({
            // @effect-diagnostics-next-line cryptoRandomUUID:off -- A window's id, made in a synchronous IPC answer.
            id: globalThis.crypto.randomUUID(),
            frame: frameOf(window),
            display: displayKey(Electron.screen.getDisplayMatching(frameOf(window))),
            fullScreen: false,
            workspace: null,
          }).id;
        bind(id, window);
        setImmediate(openTheRest);
      }
      // Its page has loaded: now it can lead, and come to the front if it's there.
      const leads = book.booted(id);
      if (window.isFocused()) book.focus(id);
      placeFromWindow(id, window);
      // A window focused before its page loaded may take the notifying over.
      if (leads) promote(id);
      else tellNotifier();
      return {
        id,
        lead: book.leadId() === id,
        workspace: book.get(id)?.workspace ?? null,
        others: book
          .snapshot()
          .windows.filter((other) => other.id !== id)
          .map((other) => ({ id: other.id, workspace: other.workspace })),
        notifies: notifierNow() === id,
      };
    };

    /** A move `home` (the window that made it) asked for. */
    const commit = (raw: unknown, home: string | null): "done" | "stale" => {
      if (!isTransaction(raw)) return "stale";
      const committed = book.commit(raw);
      if (!committed) return "stale";
      for (const record of committed.adopt) {
        live.get(record.id)?.webContents.send(WINDOWS_CHANNEL.adopt, record.workspace);
        tellOthers(record.id, record.workspace);
      }
      for (const record of committed.open) tellOthers(record.id, record.workspace);
      for (const id of committed.close) tellOthers(id, null);
      for (const record of committed.place) {
        const window = live.get(record.id);
        if (!window || window.isDestroyed()) continue;
        if (window.isFullScreen() !== record.fullScreen) window.setFullScreen(record.fullScreen);
        if (!record.fullScreen) window.setBounds(record.frame);
      }
      for (const id of committed.close) {
        const window = live.get(id);
        live.delete(id);
        if (window && !window.isDestroyed()) window.close();
      }
      for (const record of committed.open) {
        open(record.id, record.frame, record.fullScreen, home);
      }
      const front = committed.front === null ? undefined : live.get(committed.front);
      if (front && !front.isDestroyed()) front.focus();
      if (committed.leadChanged) promote(committed.lead);
      save();
      return "done";
    };

    /** A message from one of the windows' pages (senders.ts); its boot is how a page becomes one. */
    const fromPage = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
      fromWindowPage(event) && pages.has(event.sender.id);
    /** The windows' channels, deaf to anyone else: a refused boot learns nothing. */
    const ipc = {
      on: <A extends unknown[]>(
        channel: string,
        listener: (event: Electron.IpcMainEvent, ...args: A) => void,
        from: (event: Electron.IpcMainEvent) => boolean = fromPage,
      ) =>
        Electron.ipcMain.on(channel, (event, ...args) => {
          if (from(event)) listener(event, ...(args as A));
          else event.returnValue = null;
        }),
      handle: <A extends unknown[]>(
        channel: string,
        handler: (event: Electron.IpcMainInvokeEvent, ...args: A) => unknown,
      ) =>
        Electron.ipcMain.handle(channel, (event, ...args) =>
          fromPage(event) ? handler(event, ...(args as A)) : null,
        ),
    };

    yield* Effect.acquireRelease(
      Effect.sync(() => {
        ipc.on(
          WINDOWS_CHANNEL.boot,
          (event) => {
            event.returnValue = boot(event.sender);
          },
          fromWindowPage,
        );
        ipc.on(WINDOWS_CHANNEL.publish, (event, workspace: unknown) => {
          const id = pages.get(event.sender.id);
          if (!id || !book.publish(id, workspace)) return;
          tellOthers(id, workspace);
          save();
        });
        ipc.on(WINDOWS_CHANNEL.adopted, (event) => {
          const id = pages.get(event.sender.id);
          if (id) book.adopted(id);
        });
        ipc.handle(WINDOWS_CHANNEL.snapshot, () => {
          readDisplays();
          return book.snapshot();
        });
        ipc.handle(WINDOWS_CHANNEL.commit, (event, raw: unknown) =>
          commit(raw, pages.get(event.sender.id) ?? null),
        );
        ipc.on(WINDOWS_CHANNEL.reveal, (_event, raw: { window?: unknown; pane?: unknown }) => {
          const window = typeof raw?.window === "string" ? live.get(raw.window) : undefined;
          if (!window || window.isDestroyed() || typeof raw.pane !== "string") return;
          window.webContents.send(WINDOWS_CHANNEL.focusPane, raw.pane);
          void runPromise(electronWindow.reveal(window));
        });
        Electron.app.on("before-quit", saveNow);
        Electron.app.on("browser-window-focus", tellNotifier);
        Electron.app.on("browser-window-blur", blurred);
      }),
      () =>
        Effect.sync(() => {
          for (const channel of [
            WINDOWS_CHANNEL.boot,
            WINDOWS_CHANNEL.publish,
            WINDOWS_CHANNEL.adopted,
            WINDOWS_CHANNEL.reveal,
          ]) {
            Electron.ipcMain.removeAllListeners(channel);
          }
          Electron.ipcMain.removeHandler(WINDOWS_CHANNEL.snapshot);
          Electron.ipcMain.removeHandler(WINDOWS_CHANNEL.commit);
          Electron.app.removeListener("before-quit", saveNow);
          clearInterval(quitCheck);
          Electron.app.removeListener("browser-window-focus", tellNotifier);
          Electron.app.removeListener("browser-window-blur", blurred);
          if (saveTimer !== undefined) saveNow();
        }),
    );
  }),
);
