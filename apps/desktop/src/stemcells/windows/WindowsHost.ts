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
import { readPlaced, WindowBook, type DisplayInfo, type Rect, type Transaction } from "./book.ts";
import {
  WINDOWS_CHANNEL,
  type FlightCommand,
  type FlightRect,
  type WindowBoot,
} from "./channels.ts";
import { FlightLayer } from "./flightLayer.ts";
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
    const flight = new FlightLayer();
    /** The page carrying something, whose flight ends if it goes, crashes or loads afresh. */
    let flying: Electron.WebContents | null = null;
    /** Stops hearing the flying page. */
    let unwatch = () => {};
    /**
     * The window a carry's drop in open space would open, started hidden at
     * the tear (stemcells/tasks/windows.md, The warm window). It stays out of
     * the book and the other windows' news until the move opens it, and goes
     * with the flight otherwise.
     */
    let warm: {
      readonly id: string;
      readonly boot: WindowBoot;
      window: Electron.BrowserWindow | null;
      /** Its page has booted, hidden, into the windows as the move leaves them. */
      booted: boolean;
      /** The move opened it before its window was made: where it goes then, and whose tabs it holds. */
      kept: {
        readonly frame: Rect;
        readonly fullScreen: boolean;
        readonly home: string | null;
      } | null;
    } | null = null;

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

    /**
     * The warm window, which a move just opened: it joins the book's windows
     * where the move put it, takes the move as made (it started from the move
     * as planned at the tear), hears the others now, and shows. One gone by
     * then couldn't open, and gives `home` its tabs back.
     */
    const keep = (
      window: Electron.BrowserWindow,
      id: string,
      frame: Rect,
      fullScreen: boolean,
      home: string | null,
      booted: boolean,
    ) => {
      if (window.isDestroyed()) {
        failed(id, home);
        return;
      }
      bind(id, window);
      window.setBounds(frame);
      const page = window.webContents;
      // Its page loaded hidden at the tear: now it can lead, and come to the front as it shows.
      if (booted && book.booted(id)) promote(id);
      const record = book.get(id);
      if (record) {
        book.sending(id);
        page.send(WINDOWS_CHANNEL.adopt, record.workspace);
      }
      for (const [other] of live) {
        const workspace = book.get(other)?.workspace;
        if (other !== id && workspace !== undefined) {
          page.send(WINDOWS_CHANNEL.elsewhere, { id: other, workspace });
        }
      }
      if (fullScreen) window.setFullScreen(true);
      void runPromise(electronWindow.reveal(window)).then(() => {
        if (window.isDestroyed()) return;
        // Cheap again once hidden or minimized, as upstream has a window after it first shows.
        page.setBackgroundThrottling(true);
        page.send(WINDOWS_CHANNEL.shown);
      });
    };

    const open = (id: string, frame: Rect, fullScreen: boolean, home: string | null) => {
      if (warm?.id === id) {
        const kept = warm;
        warm = null;
        if (kept.window) keep(kept.window, id, frame, fullScreen, home, kept.booted);
        else kept.kept = { frame, fullScreen, home };
        return;
      }
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

    const coolWarm = () => {
      const window = warm?.window;
      warm = null;
      if (window && !window.isDestroyed()) window.destroy();
    };

    /**
     * Starts the window `raw` (a move opening one window, as planned at a
     * tear) would open: hidden, drawing, and booting into the windows as the
     * move leaves them, so none of its chats is anywhere else.
     */
    const startWarm = (raw: unknown) => {
      coolWarm();
      const create = desktopWindow.createExtra;
      const record = isTransaction(raw) && raw.open.length === 1 ? readPlaced(raw.open[0]) : null;
      if (!create || !record || book.get(record.id) || live.has(record.id)) return;
      const { change, close } = raw as Transaction;
      const entry: NonNullable<typeof warm> = {
        id: record.id,
        boot: {
          id: record.id,
          lead: false,
          notifies: false,
          workspace: record.workspace,
          others: book
            .snapshot()
            .windows.filter((other) => !close.includes(other.id))
            .map((other) => ({
              id: other.id,
              workspace: (change.find((changed) => changed.id === other.id) ?? other).workspace,
            })),
        },
        window: null,
        booted: false,
        kept: null,
      };
      warm = entry;
      opening.push(entry.id);
      const made = () => {
        const waiting = opening.indexOf(entry.id);
        if (waiting >= 0) opening.splice(waiting, 1);
      };
      void runPromise(create(record.frame, false)).then(
        (window) => {
          made();
          if (entry.kept) {
            const { frame, fullScreen, home } = entry.kept;
            return keep(window, entry.id, frame, fullScreen, home, entry.booted);
          }
          if (warm !== entry) return window.destroy();
          entry.window = window;
          const page = window.webContents;
          pages.set(page.id, entry.id);
          window.once("closed", () => {
            pages.delete(page.id);
            if (warm === entry) warm = null;
          });
          // Upstream throttles a page once it's ready to show; this one draws
          // hidden until it shows.
          const unthrottled = () => {
            if (warm === entry && !page.isDestroyed()) page.setBackgroundThrottling(false);
          };
          unthrottled();
          window.once("ready-to-show", unthrottled);
        },
        () => {
          made();
          if (entry.kept) open(entry.id, entry.kept.frame, entry.kept.fullScreen, entry.kept.home);
          else if (warm === entry) warm = null;
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
      // A page booting mid-carry has loaded afresh: what it was carrying is gone.
      if (flying === sender) endFlight();
      const window = Electron.BrowserWindow.fromWebContents(sender);
      if (!window || window.webContents !== sender) return null;
      let id = pages.get(sender.id);
      if (!id && warm !== null && opening[0] === warm.id) {
        id = opening.shift()!;
        pages.set(sender.id, id);
      }
      if (warm !== null && id === warm.id) {
        warm.booted = true;
        return warm.boot;
      }
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

    /**
     * The flight is over: the layer goes, its page is no longer heard, and
     * the window warmed for a drop that didn't come goes.
     */
    const endFlight = () => {
      flying = null;
      unwatch();
      unwatch = () => {};
      flight.end();
      coolWarm();
    };

    /** The app quits: a flight in the air ends, and the windows are saved as they are. */
    const beforeQuit = () => {
      endFlight();
      saveNow();
    };

    /**
     * The page carrying something now. If it goes, its renderer dies, or it
     * loads afresh (upstream reloads a crashed page in place) mid-carry, the
     * flight ends: nothing is left drawn over the screen for a carry no page
     * is making any more.
     */
    const fly = (page: Electron.WebContents) => {
      if (flying === page) return;
      unwatch();
      flying = page;
      const lost = () => {
        if (flying === page) endFlight();
      };
      const navigating = (details: { isMainFrame: boolean; isSameDocument: boolean }) => {
        if (details.isMainFrame && !details.isSameDocument) lost();
      };
      page.on("destroyed", lost);
      page.on("render-process-gone", lost);
      page.on("did-start-navigation", navigating);
      unwatch = () => {
        page.removeListener("destroyed", lost);
        page.removeListener("render-process-gone", lost);
        page.removeListener("did-start-navigation", navigating);
      };
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
        ipc.on(WINDOWS_CHANNEL.flight, (event, commands: unknown) => {
          if (!Array.isArray(commands)) return;
          fly(event.sender);
          flight.run(commands as FlightCommand[]);
        });
        ipc.on(WINDOWS_CHANNEL.warm, (event, raw: unknown) => {
          fly(event.sender);
          startWarm(raw);
        });
        ipc.handle(WINDOWS_CHANNEL.flightStill, (event, rect: FlightRect) => {
          const window = Electron.BrowserWindow.fromWebContents(event.sender);
          return window ? flight.still(window, rect) : null;
        });
        ipc.handle(WINDOWS_CHANNEL.flightPainted, () => flight.painted());
        ipc.on(WINDOWS_CHANNEL.drawn, (event) => {
          const id = pages.get(event.sender.id);
          // A warm window draws hidden: it has landed once it shows and draws.
          if (!id || !live.has(id) || !flying || flying.isDestroyed()) return;
          flying.send(WINDOWS_CHANNEL.landed, id);
        });
        ipc.on(WINDOWS_CHANNEL.flightEnd, endFlight);
        Electron.app.on("before-quit", beforeQuit);
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
            WINDOWS_CHANNEL.flight,
            WINDOWS_CHANNEL.flightEnd,
            WINDOWS_CHANNEL.drawn,
            WINDOWS_CHANNEL.warm,
          ]) {
            Electron.ipcMain.removeAllListeners(channel);
          }
          Electron.ipcMain.removeHandler(WINDOWS_CHANNEL.snapshot);
          Electron.ipcMain.removeHandler(WINDOWS_CHANNEL.commit);
          Electron.app.removeListener("before-quit", beforeQuit);
          clearInterval(quitCheck);
          Electron.app.removeListener("browser-window-focus", tellNotifier);
          Electron.app.removeListener("browser-window-blur", blurred);
          Electron.ipcMain.removeHandler(WINDOWS_CHANNEL.flightStill);
          Electron.ipcMain.removeHandler(WINDOWS_CHANNEL.flightPainted);
          endFlight();
          if (saveTimer !== undefined) saveNow();
        }),
    );
  }),
);
