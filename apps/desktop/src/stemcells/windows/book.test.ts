import { describe, expect, it } from "vite-plus/test";

import { WindowBook, type Placed, type Transaction } from "./book.ts";

const frame = (x: number) => ({ x, y: 100, width: 900, height: 700 });
const placed = (id: string, workspace: unknown, x = 0): Placed => ({
  id,
  frame: frame(x),
  display: "laptop",
  fullScreen: false,
  workspace,
});

/** Two windows whose pages have loaded: `a` in front, `b` leading. */
function twoWindows(): WindowBook {
  const book = new WindowBook();
  book.add(placed("b", "b-tabs", 1000));
  book.add(placed("a", "a-tabs"));
  book.booted("b");
  book.booted("a");
  return book;
}

function move(book: WindowBook, change: Partial<Transaction> = {}): Transaction {
  const basis = Object.fromEntries(book.snapshot().windows.map((w) => [w.id, w.version]));
  return {
    open: [],
    change: [],
    close: [],
    front: null,
    lead: book.leadId(),
    memories: [],
    basis,
    ...change,
  };
}

describe("WindowBook", () => {
  it("lets the first window lead, and keeps the newest in front", () => {
    const book = twoWindows();
    expect(book.leadId()).toBe("b");
    expect(book.ids()).toEqual(["a", "b"]);
  });

  it("takes a page's workspace and counts it", () => {
    const book = twoWindows();
    expect(book.publish("a", "a-tabs-2")).toBe(true);
    expect(book.get("a")).toMatchObject({ workspace: "a-tabs-2", version: 1 });
    expect(book.publish("nowhere", "x")).toBe(false);
  });

  it("commits a move: the pages it changes adopt, a window opens, one closes", () => {
    const book = twoWindows();
    const committed = book.commit(
      move(book, {
        change: [placed("a", "a-less")],
        open: [placed("c", "c-tabs", 400)],
        close: ["b"],
        front: "c",
        lead: "a",
      }),
    )!;
    expect(committed.adopt.map((w) => w.id)).toEqual(["a"]);
    expect(committed.open.map((w) => w.id)).toEqual(["c"]);
    expect(committed.close).toEqual(["b"]);
    expect(committed.leadChanged).toBe(true);
    expect(book.ids()).toEqual(["a", "c"]);
    expect(book.get("a")).toMatchObject({ workspace: "a-less", version: 1 });
  });

  it("refuses a move made before a window it touches published", () => {
    const book = twoWindows();
    const stale = move(book, { change: [placed("a", "a-less")] });
    book.publish("a", "a-tabs-2");
    expect(book.commit(stale)).toBeNull();
    expect(book.get("a")!.workspace).toBe("a-tabs-2");
  });

  it("keeps each move's undo, latest first, and forgets one once it's taken back", () => {
    const book = twoWindows();
    book.commit(move(book, { change: [placed("a", "a-less")], undo: "first" }));
    book.commit(move(book, { change: [placed("a", "a-lesser")], undo: "second" }));
    expect(book.undos().map((kept) => kept.entry)).toEqual(["second", "first"]);
    const latest = book.undos()[0]!;
    book.commit(move(book, { change: [placed("a", "a-less")], undoes: latest.id }));
    expect(book.undos().map((kept) => kept.entry)).toEqual(["first"]);
    expect(book.commit(move(book, { open: [placed("a", "again")], undo: "refused" }))).toBeNull();
    expect(book.undos().map((kept) => kept.entry)).toEqual(["first"]);
  });

  it("refuses a move that opens a window it already has", () => {
    const book = twoWindows();
    expect(book.commit(move(book, { open: [placed("a", "again")] }))).toBeNull();
  });

  it("ignores what a page publishes before it takes the workspace it was sent", () => {
    const book = twoWindows();
    book.commit(move(book, { change: [placed("a", "a-less")] }));
    expect(book.publish("a", "made-before-the-move")).toBe(false);
    expect(book.get("a")!.workspace).toBe("a-less");
    book.adopted("a");
    expect(book.publish("a", "after")).toBe(true);
  });

  it("ignores what a warm window's page published before it took the move as made", () => {
    const book = twoWindows();
    book.commit(move(book, { open: [placed("c", "c-tab")] }));
    book.sending("c");
    expect(book.publish("c", "as-planned-at-the-tear")).toBe(false);
    expect(book.get("c")!.workspace).toBe("c-tab");
    book.adopted("c");
    expect(book.publish("c", "after")).toBe(true);
  });

  it("lets a page that reloads start from the book", () => {
    const book = twoWindows();
    book.commit(move(book, { change: [placed("a", "a-less")] }));
    book.booted("a");
    expect(book.publish("a", "after-reload")).toBe(true);
  });

  it("moves a window it places, and reports only what changed", () => {
    const book = twoWindows();
    const committed = book.commit(
      move(book, { change: [{ ...placed("a", "a-tabs"), frame: frame(50) }] }),
    )!;
    expect(committed.place.map((w) => w.id)).toEqual(["a"]);
    expect(book.place("b", frame(1000), "laptop", false)).toBe(false);
    expect(book.place("b", frame(1200), "laptop", false)).toBe(true);
  });

  it("drops a closed window and passes the lead on, but keeps the last one for the next", () => {
    const book = twoWindows();
    book.focus("b");
    const result = book.closed("b");
    expect(result.removed?.workspace).toBe("b-tabs");
    expect(result.leadChanged).toBe(true);
    expect(book.leadId()).toBe("a");
    expect(book.closed("a")).toEqual({ removed: null, leadChanged: false });
    expect(book.ids()).toEqual(["a"]);
  });

  it("keeps every window that closes as the app quits, as an update quits it before before-quit", () => {
    const book = twoWindows();
    book.add(placed("c", "c-tabs", 2000));
    book.quit();
    for (const id of ["c", "a", "b"]) expect(book.closed(id).removed).toBeNull();
    const reopened = WindowBook.read(JSON.parse(JSON.stringify(book.stored())));
    expect(reopened.ids()).toEqual(["c", "a", "b"]);
    expect(reopened.leadId()).toBe("b");
  });

  it("drops a closed window again once a quit for an update that couldn't install is over", () => {
    const book = twoWindows();
    book.quit();
    expect(book.closed("a").removed).toBeNull();
    book.quit(false);
    expect(book.closed("a").removed?.workspace).toBe("a-tabs");
  });

  it("forgets a window a move made that couldn't open, and gives its workspace back", () => {
    const book = twoWindows();
    book.commit(move(book, { open: [placed("c", "c-tabs", 2000)], front: "c" }));
    const { removed, leadChanged } = book.failed("c");
    expect(removed?.workspace).toBe("c-tabs");
    expect(leadChanged).toBe(false);
    expect(book.ids()).toEqual(["a", "b"]);
    expect(book.leadId()).toBe("b");
    expect(book.failed("c").removed).toBeNull();
  });

  it("lets a window a move opens lead or come to the front only once its page has loaded", () => {
    const book = twoWindows();
    const committed = book.commit(
      move(book, { open: [placed("c", "c-tabs", 2000)], close: ["b"], front: "c", lead: "c" }),
    )!;
    expect(committed.lead).toBe("a");
    expect(book.ids()).toEqual(["a", "c"]);
    book.focus("c");
    expect(book.ids()).toEqual(["a", "c"]);
    expect(book.closed("a")).toMatchObject({ leadChanged: true });
    expect(book.leadId()).toBeNull();
    expect(book.booted("c")).toBe(true);
    expect(book.leadId()).toBe("c");
    book.focus("c");
    expect(book.ids()).toEqual(["c"]);
  });

  it("has a window a move made the lead take it once its page loads", () => {
    const book = twoWindows();
    book.commit(move(book, { open: [placed("c", "c-tabs", 2000)], front: "c", lead: "c" }));
    expect(book.leadId()).toBe("b");
    // Another move meanwhile, which leaves the lead as it found it.
    book.commit(move(book, { change: [placed("a", "a-less")] }));
    expect(book.booted("c")).toBe(true);
    expect(book.leadId()).toBe("c");

    const again = twoWindows();
    again.commit(move(again, { open: [placed("d", "d-tabs", 2000)], lead: "d" }));
    again.failed("d");
    expect(again.leadId()).toBe("b");
  });

  it("passes the lead on only to a window whose page has loaded", () => {
    const book = WindowBook.read({
      version: 1,
      lead: "y",
      windows: [placed("x", "x-tabs"), placed("y", "y-tabs"), placed("z", "z-tabs")],
    });
    expect(book.booted("y")).toBe(false);
    book.booted("z");
    expect(book.closed("y")).toMatchObject({ leadChanged: true });
    expect(book.leadId()).toBe("z");
    expect(book.booted("x")).toBe(false);
  });

  it("has one window notify: the focused one, not the lead, else the lead in the background", () => {
    const book = twoWindows();
    expect(book.leadId()).toBe("b");
    expect(book.notifier("a")).toBe("a");
    expect(book.notifier(null)).toBe("b");
    expect(book.notifier("a preview's window")).toBe("b");
  });

  it("keeps windows, lead, memories and displays across a launch", () => {
    const book = twoWindows();
    book.commit(move(book, { memories: [{ displays: "laptop" }] }));
    const display = { key: "laptop", bounds: frame(0), workArea: frame(0) };
    book.setDisplays([display]);
    const again = WindowBook.read(JSON.parse(JSON.stringify(book.stored())));
    expect(again.snapshot()).toEqual({
      windows: book.snapshot().windows.map((w) => ({ ...w, version: 0 })),
      lead: "b",
      memories: [{ displays: "laptop" }],
      displays: [display],
    });
  });

  it("reads nothing it can't trust", () => {
    const stored = {
      version: 1,
      lead: "ghost",
      windows: [
        placed("a", 1),
        { id: "a" },
        placed("a", 2),
        { ...placed("b", 3), frame: { x: 0 } },
      ],
      displays: [{ key: "x" }],
    };
    const book = WindowBook.read(stored);
    expect(book.ids()).toEqual(["a"]);
    expect(book.leadId()).toBe("a");
    expect(book.snapshot().displays).toEqual([]);
    expect(WindowBook.read({ version: 2 }).ids()).toEqual([]);
  });
});
