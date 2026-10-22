/**
 * Several windows sharing upstream's real stores (drafts, the right panel,
 * the terminal drawer) through one localStorage: each "window" is its own
 * copy of the store modules, and hears the others' writes as a page would,
 * in order, a little later. A window passing on what it heard must never
 * undo typing it hadn't heard yet, and the windows must settle.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

type SharedStore = import("./sharedStores").SharedStore;
type SharingModule = typeof import("../windows/sharedStorage");
type DraftsModule = typeof import("../../composerDraftStore");
type PanelModule = typeof import("../../rightPanelStore");
type TerminalModule = typeof import("../../terminalUiStateStore");

const ENVIRONMENT = EnvironmentId.make("environment-local");
const chatOf = (name: string) => scopeThreadRef(ENVIRONMENT, ThreadId.make(`chat-${name}`));

/** One localStorage for every window. */
const disk = new Map<string, string>();
let writes = 0;
/** How a write reaches the other windows: queued for the test to hand over, or after a while. */
let delivery: "held" | "timed" | "off" = "held";
let random = Math.random;
/** Far more writes than a run makes, short of an echo between windows that never ends. */
const WRITES_AT_MOST = 2_000;

interface Page {
  readonly name: string;
  /** The window's own events: `storage`, and `beforeunload` (which writes the drafts now). */
  readonly window: EventTarget;
  readonly storage: Storage;
  /** Writes heard but not handed over yet (`held`). */
  readonly inbox: Event[];
  /** When the last write sent to this window arrives (`timed`), so they arrive in order. */
  arrives: number;
  readonly stores: ReadonlyArray<SharedStore>;
  readonly sharing: SharingModule;
  readonly drafts: DraftsModule["useComposerDraftStore"];
  readonly panel: PanelModule["useRightPanelStore"];
  readonly terminal: TerminalModule["useTerminalUiStateStore"];
  stop: (() => void) | null;
}

const pages: Page[] = [];

function storageFor(page: () => Page | null): Storage {
  return {
    get length() {
      return disk.size;
    },
    key: (index) => [...disk.keys()][index] ?? null,
    clear: () => disk.clear(),
    getItem: (key) => disk.get(key) ?? null,
    removeItem: (key) => void disk.delete(key),
    setItem: (key, newValue) => {
      const oldValue = disk.get(key) ?? null;
      disk.set(key, newValue);
      writes += 1;
      if (writes > WRITES_AT_MOST) throw new Error("the windows kept writing");
      if (delivery === "off") return;
      for (const other of pages) {
        if (other === page()) continue;
        const event = Object.assign(new Event("storage"), { key, oldValue, newValue });
        if (delivery === "held") {
          other.inbox.push(event);
          continue;
        }
        // Timed delivery runs on fake timers: this reads their clock.
        const now = vi.getMockedSystemTime()?.getTime() ?? 0;
        other.arrives = Math.max(other.arrives, now + Math.floor(random() * 300));
        setTimeout(() => other.window.dispatchEvent(event), other.arrives - now);
      }
    },
  };
}

/** A window: its own copy of upstream's stores, writing to the one disk. */
async function openPage(name: string): Promise<Page> {
  let page: Page | null = null;
  const window = new EventTarget();
  const storage = storageFor(() => page);
  vi.resetModules();
  vi.stubGlobal("window", Object.assign(window, { localStorage: storage }));
  vi.stubGlobal("localStorage", storage);
  const stores = (await import("./sharedStores")).sharedStores();
  const sharing = await import("../windows/sharedStorage");
  const drafts = (await import("../../composerDraftStore")).useComposerDraftStore;
  const panel = (await import("../../rightPanelStore")).useRightPanelStore;
  const terminal = (await import("../../terminalUiStateStore")).useTerminalUiStateStore;
  vi.unstubAllGlobals();
  page = {
    name,
    window,
    storage,
    inbox: [],
    arrives: 0,
    stores,
    sharing,
    drafts,
    panel,
    terminal,
    stop: null,
  };
  return page;
}

function share(page: Page) {
  page.stop = page.sharing.shareAcrossWindows(page.stores, page.window, page.storage, page.name);
}

/** Has the window write its drafts now, as upstream does before a page unloads. */
const flush = (page: Page) => page.window.dispatchEvent(new Event("beforeunload"));

/** Hands the window the next `count` writes it heard (all, by default). */
function hear(page: Page, count = page.inbox.length) {
  for (const event of page.inbox.splice(0, count)) page.window.dispatchEvent(event);
}

/** Hands over every write and has every window write, until nothing is left. */
function settle() {
  for (let round = 0; round < 50; round += 1) {
    for (const page of pages) flush(page);
    vi.runAllTimers();
    const heard = pages.reduce((count, page) => count + page.inbox.length, 0);
    if (heard === 0) return;
    if (heard > 1_000) break;
    for (const page of pages) hear(page);
  }
  throw new Error("the windows kept writing");
}

const promptIn = (page: Page, chat: string) =>
  page.drafts.getState().getComposerDraft(chatOf(chat))?.prompt ?? null;
const heightIn = (page: Page, chat: string) =>
  page.terminal.getState().terminalUiStateByThreadKey[`${ENVIRONMENT}:chat-${chat}`]
    ?.terminalHeight ?? null;
const panelIn = (page: Page, chat: string) =>
  page.panel.getState().byThreadKey[`${ENVIRONMENT}:chat-${chat}`]?.isOpen ?? false;

/** Every open window holds the same, and so does the disk once written. */
function expectAgreed(open: ReadonlyArray<Page>) {
  const [first] = open as [Page];
  for (const [index, store] of first.stores.entries()) {
    for (const page of open) {
      expect(page.stores[index]!.persisted(), `${page.name}: ${store.key}`).toEqual(
        store.persisted(),
      );
    }
    const onDisk = disk.get(store.key);
    if (onDisk !== undefined)
      expect(store.read(onDisk)?.fields, `the disk: ${store.key}`).toEqual(store.persisted());
  }
}

/** Every window and the disk back to nothing, sharing nothing. */
function reset() {
  delivery = "off";
  for (const page of pages) {
    page.stop?.();
    page.stop = null;
    page.inbox.length = 0;
    page.arrives = 0;
    for (const store of [page.drafts, page.panel, page.terminal]) {
      (store as { setState: (state: unknown, replace: true) => void }).setState(
        store.getInitialState(),
        true,
      );
    }
    flush(page);
  }
  vi.runAllTimers();
  disk.clear();
  writes = 0;
  delivery = "held";
}

describe("windows sharing upstream's stores", () => {
  beforeAll(async () => {
    for (const name of ["A", "B", "C", "D"]) pages.push(await openPage(name));
  });
  afterAll(() => {
    for (const page of pages) page.stop?.();
    pages.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    random = Math.random;
  });

  function start(count: number) {
    vi.useFakeTimers({ loopLimit: 5_000 });
    reset();
    const open = pages.slice(0, count);
    for (const page of open) share(page);
    return open;
  }

  it("drafts: a window passing on what it heard doesn't undo typing it hadn't heard", () => {
    const [a, b, c] = start(3) as [Page, Page, Page];
    pages[3]!.inbox.length = 0;

    c.drafts.getState().setPrompt(chatOf("c"), "typed in C");
    b.drafts.getState().setPrompt(chatOf("b"), "typed in B");
    flush(c);
    flush(b);
    // A hears C's write and writes it back, not having heard B's.
    hear(a, 1);
    flush(a);
    // C hears B's write, writes, then hears A's (which has no draft in b), and writes.
    hear(c, 1);
    flush(c);
    hear(c, 1);
    flush(c);
    // B hears everything C and A wrote, in order.
    hear(b);
    flush(b);
    settle();

    for (const page of [a, b, c]) {
      expect(promptIn(page, "b"), page.name).toBe("typed in B");
      expect(promptIn(page, "c"), page.name).toBe("typed in C");
    }
    expectAgreed([a, b, c]);
  });

  it("drafts: a window that starts sharing after a write landed takes it, and never writes back what it had", () => {
    const [a, b] = start(2) as [Page, Page];
    b.drafts.getState().setPrompt(chatOf("x"), "hello");
    flush(b);
    hear(a);
    expect(promptIn(a, "x")).toBe("hello");

    // B loads again: its stores have read "hello", and it isn't sharing yet when A writes.
    b.stop!();
    b.stop = null;
    a.drafts.getState().setPrompt(chatOf("x"), "hello world");
    flush(a);
    hear(b);
    share(b);
    expect(promptIn(b, "x")).toBe("hello world");
    // B's next write is of its own, and puts nothing older back.
    b.drafts.getState().setPrompt(chatOf("b"), "B's own");
    flush(b);
    settle();

    for (const page of [a, b]) {
      expect(promptIn(page, "x"), page.name).toBe("hello world");
      expect(promptIn(page, "b"), page.name).toBe("B's own");
    }
    expectAgreed([a, b]);
  });

  it("the right panel and terminal: what a window takes as it starts sharing, it writes with its versions", () => {
    const [a, b] = start(2) as [Page, Page];
    // B loads again, and isn't sharing yet when A writes.
    b.stop!();
    b.stop = null;
    a.terminal.getState().setTerminalHeight(chatOf("x"), 444);
    hear(b);
    share(b);
    expect(b.terminal.getState().terminalUiStateByThreadKey).toEqual(
      a.terminal.getState().terminalUiStateByThreadKey,
    );
    // The take is written at once; A must be able to tell its versions.
    const taken = a.inbox.map((event) => JSON.parse((event as StorageEvent).newValue ?? "{}"));
    expect(taken.length).toBeGreaterThan(0);
    for (const value of taken) expect(Object.keys(value["stemcells:clocks"] ?? {})).not.toEqual([]);
    settle();
    expectAgreed([a, b]);
  });

  it("the right panel and terminal: the same, where every change is written at once", () => {
    const [a, b, c] = start(3) as [Page, Page, Page];

    c.terminal.getState().setTerminalHeight(chatOf("c"), 333);
    c.panel.getState().show(chatOf("c"));
    b.terminal.getState().setTerminalHeight(chatOf("b"), 222);
    b.panel.getState().show(chatOf("b"));
    // A hears C's writes and writes them back, not having heard B's.
    hear(a, 2);
    // C hears B's writes (writing each back), then A's.
    hear(c);
    // B hears everything, in order.
    hear(b);
    settle();

    for (const page of [a, b, c]) {
      expect(heightIn(page, "b"), page.name).toBe(222);
      expect(heightIn(page, "c"), page.name).toBe(333);
      expect(panelIn(page, "b"), page.name).toBe(true);
      expect(panelIn(page, "c"), page.name).toBe(true);
    }
    expectAgreed([a, b, c]);
  });

  /** What a window does to its own chat, and what that chat then holds. */
  type Act = (page: Page, step: number) => readonly [what: string, holds: unknown];

  const type: Act = (page, step) => {
    const text = `${page.name} typed ${step}`;
    page.drafts.getState().setPrompt(chatOf(page.name), text);
    return ["draft", text];
  };
  const send: Act = (page) => {
    page.drafts.getState().setPrompt(chatOf(page.name), "");
    return ["draft", null];
  };
  const resize: Act = (page, step) => {
    page.terminal.getState().setTerminalHeight(chatOf(page.name), 100 + step);
    return ["terminal", 100 + step];
  };
  const showOrHide: Act = (page) => {
    const show = random() < 0.5;
    if (show) page.panel.getState().show(chatOf(page.name));
    else page.panel.getState().close(chatOf(page.name));
    return ["panel", show];
  };
  const holds = (page: Page, what: string, chat: string): unknown =>
    what === "draft"
      ? promptIn(page, chat)
      : what === "terminal"
        ? heightIn(page, chat)
        : panelIn(page, chat);

  /**
   * Runs of random acts in random windows, each heard by the others in order
   * after a random while (the drafts wait their own moment to write); then
   * every window holds each chat's last change, and nothing more is written.
   */
  function randomRuns(acts: ReadonlyArray<Act>) {
    for (let run = 0; run < 40; run += 1) {
      const seed = 1 + run * 7919;
      let state = seed;
      random = () => {
        state = (state * 48_271) % 2_147_483_647;
        return state / 2_147_483_647;
      };
      const open = start(pages.length);
      delivery = "timed";
      const last = new Map<string, readonly [what: string, chat: string, holds: unknown]>();

      for (let step = 0; step < 30; step += 1) {
        const page = open[Math.floor(random() * open.length)]!;
        const act = acts[Math.floor(random() * acts.length)]!;
        const [what, value] = act(page, step);
        last.set(`${what} ${page.name}`, [what, page.name, value]);
        if (random() < 0.2) flush(page);
        vi.advanceTimersByTime(Math.floor(random() * 400));
      }
      vi.runAllTimers();

      for (const page of open) {
        for (const [what, chat, value] of last.values()) {
          expect(
            holds(page, what, chat),
            `seed ${seed}: ${chat}'s ${what}, in ${page.name}`,
          ).toEqual(value);
        }
      }
      expectAgreed(open);
      // Settled: hearing the last write again, no window takes or writes anything.
      const settledAt = writes;
      for (const page of open) {
        for (const [key, newValue] of disk) {
          page.window.dispatchEvent(Object.assign(new Event("storage"), { key, newValue }));
        }
        flush(page);
      }
      vi.runAllTimers();
      expect(writes, `seed ${seed}`).toBe(settledAt);
    }
  }

  it("drafts: lose no typing and settle, however late each window hears the others", () => {
    randomRuns([type, type, type, send]);
  });

  it("the right panel and terminal: lose no change and settle, however late heard", () => {
    randomRuns([resize, showOrHide]);
  });
});
