/**
 * Stemcells: the main process's record of the app's windows
 * (stemcells/tasks/windows.md, "The model"). Each window's page is the one
 * writer of its own workspace and publishes it here; a move between windows
 * arrives as a transaction made from a snapshot, refused when a window it
 * touches has published since. Workspaces and memories are the page's
 * values, kept as they come: nothing here knows what a tab is.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DisplayInfo {
  readonly key: string;
  readonly bounds: Rect;
  readonly workArea: Rect;
}

/** A window as a page sees it: where it is, and its workspace as the page serialized it. */
export interface Placed {
  readonly id: string;
  readonly frame: Rect;
  readonly display: string;
  readonly fullScreen: boolean;
  readonly workspace: unknown;
}

export interface WindowRecord extends Placed {
  /** Counts the workspaces this window has had: each publish, each transaction. */
  readonly version: number;
}

export interface Snapshot {
  /** Front to back. */
  readonly windows: ReadonlyArray<WindowRecord>;
  readonly lead: string | null;
  readonly memories: unknown;
  readonly displays: ReadonlyArray<DisplayInfo>;
}

export interface Transaction {
  readonly open: ReadonlyArray<Placed>;
  readonly change: ReadonlyArray<Placed>;
  readonly close: ReadonlyArray<string>;
  readonly front: string | null;
  readonly lead: string | null;
  readonly memories: unknown;
  /** The version of every window it changes or closes, as the snapshot it was made from had them. */
  readonly basis: Readonly<Record<string, number>>;
}

/** What the windows must do once a transaction is in the book. */
export interface Committed {
  readonly open: ReadonlyArray<WindowRecord>;
  /** Windows given a new workspace, which their pages adopt. */
  readonly adopt: ReadonlyArray<WindowRecord>;
  /** Windows whose frame or full screen the transaction set. */
  readonly place: ReadonlyArray<WindowRecord>;
  readonly close: ReadonlyArray<string>;
  readonly front: string | null;
  readonly lead: string | null;
  readonly leadChanged: boolean;
}

/** A window's record taken out of the book, and whether the lead passed on with it. */
export interface Removed {
  readonly removed: WindowRecord | null;
  readonly leadChanged: boolean;
}

const STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRect(value: unknown): Rect | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  const numbers = [x, y, width, height];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if ((width as number) <= 0 || (height as number) <= 0) return null;
  return { x: x as number, y: y as number, width: width as number, height: height as number };
}

function readPlaced(value: unknown): Placed | null {
  if (!isRecord(value)) return null;
  const { id, display } = value;
  const frame = readRect(value.frame);
  if (typeof id !== "string" || id === "" || typeof display !== "string" || !frame) return null;
  return { id, frame, display, fullScreen: value.fullScreen === true, workspace: value.workspace };
}

function readDisplay(value: unknown): DisplayInfo | null {
  if (!isRecord(value) || typeof value.key !== "string") return null;
  const bounds = readRect(value.bounds);
  const workArea = readRect(value.workArea);
  return bounds && workArea ? { key: value.key, bounds, workArea } : null;
}

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export class WindowBook {
  /** Front to back. */
  private windows: WindowRecord[] = [];
  private lead: string | null = null;
  private memories: unknown = [];
  private displays: ReadonlyArray<DisplayInfo> = [];
  /**
   * Windows sent a workspace they haven't taken yet. What they publish before
   * taking it was made without it, so it's ignored.
   */
  private readonly adopting = new Set<string>();
  /**
   * Windows whose page has loaded. Only these lead or come to the front: a
   * window still opening, or one that never will, can't take Aski home or
   * show what the person brought forward.
   */
  private readonly loaded = new Set<string>();
  /** The app is quitting: its windows close to open again at the next launch. */
  private quitting = false;

  /** Whether `stored` is a book this app wrote: anything else starts an empty one. */
  static understands(stored: unknown): stored is Record<string, unknown> {
    return isRecord(stored) && stored.version === STORAGE_VERSION;
  }

  /** The book as the desktop app left it, or an empty one. */
  static read(stored: unknown): WindowBook {
    const book = new WindowBook();
    if (!WindowBook.understands(stored)) return book;
    const windows = Array.isArray(stored.windows) ? stored.windows.map(readPlaced) : [];
    const seen = new Set<string>();
    for (const window of windows) {
      if (!window || seen.has(window.id)) continue;
      seen.add(window.id);
      book.windows.push({ ...window, version: 0 });
    }
    book.lead = book.windows.some((window) => window.id === stored.lead)
      ? (stored.lead as string)
      : (book.windows[0]?.id ?? null);
    book.memories = stored.memories ?? [];
    book.displays = Array.isArray(stored.displays)
      ? stored.displays.flatMap((display) => readDisplay(display) ?? [])
      : [];
    return book;
  }

  /** What the desktop app keeps between launches (the page's `persist.ts` reads it). */
  stored(): unknown {
    return {
      version: STORAGE_VERSION,
      lead: this.lead,
      windows: this.windows.map(({ id, frame, display, fullScreen, workspace }) => ({
        id,
        frame,
        display,
        fullScreen,
        workspace,
      })),
      memories: this.memories,
      displays: this.displays,
    };
  }

  snapshot(): Snapshot {
    return {
      windows: this.windows,
      lead: this.lead,
      memories: this.memories,
      displays: this.displays,
    };
  }

  get(id: string): WindowRecord | null {
    return this.windows.find((window) => window.id === id) ?? null;
  }

  ids(): string[] {
    return this.windows.map((window) => window.id);
  }

  leadId(): string | null {
    return this.lead;
  }

  /** A window the book doesn't know yet; the first one leads. */
  add(window: Placed): WindowRecord {
    const record = { ...window, version: 0 };
    this.windows.unshift(record);
    this.lead ??= record.id;
    return record;
  }

  setLead(id: string): void {
    if (this.canLead(id)) this.lead = id;
  }

  /**
   * A page loaded: it starts from the book's workspace, so nothing is pending
   * for it. True when it takes the lead, which no window with a page held.
   */
  booted(id: string): boolean {
    this.adopting.delete(id);
    if (!this.get(id)) return false;
    this.loaded.add(id);
    if (this.lead !== null && this.loaded.has(this.lead)) return false;
    this.lead = id;
    return true;
  }

  /** The page took the workspace it was sent. */
  adopted(id: string): void {
    this.adopting.delete(id);
  }

  /** A page's own workspace. False when it was made before the one it was sent. */
  publish(id: string, workspace: unknown): boolean {
    const index = this.windows.findIndex((window) => window.id === id);
    if (index < 0 || this.adopting.has(id)) return false;
    const record = this.windows[index]!;
    this.windows[index] = { ...record, workspace, version: record.version + 1 };
    return true;
  }

  /** Where a window is now. True when that changed. */
  place(id: string, frame: Rect, display: string, fullScreen: boolean): boolean {
    const index = this.windows.findIndex((window) => window.id === id);
    const record = this.windows[index];
    if (!record) return false;
    if (
      sameRect(record.frame, frame) &&
      record.display === display &&
      record.fullScreen === fullScreen
    ) {
      return false;
    }
    this.windows[index] = { ...record, frame, display, fullScreen };
    return true;
  }

  /** A window came to the front; one whose page hasn't loaded yet comes once it has. */
  focus(id: string): void {
    const record = this.get(id);
    if (!record || !this.loaded.has(id) || this.windows[0] === record) return;
    this.windows = [record, ...this.windows.filter((window) => window !== record)];
  }

  setDisplays(displays: ReadonlyArray<DisplayInfo>): void {
    this.displays = displays;
  }

  /**
   * The app is quitting: every window that closes from now on stays in the
   * book. False when it isn't any more (an update that couldn't install).
   */
  quit(quitting = true): void {
    this.quitting = quitting;
  }

  /**
   * A window the person closed. Its record goes, unless it was the last (that
   * one stays for the next window the app opens) or the app is quitting. The
   * lead passes to the front window left whose page has loaded.
   */
  closed(id: string): Removed {
    if (this.quitting || this.windows.length < 2) {
      this.adopting.delete(id);
      this.loaded.delete(id);
      return { removed: null, leadChanged: false };
    }
    return this.remove(id);
  }

  /**
   * A window a move made that couldn't open. Its record goes even if it was
   * to lead or be in front; its workspace is the caller's to give back.
   */
  failed(id: string): Removed {
    return this.remove(id);
  }

  private remove(id: string): Removed {
    const record = this.get(id);
    this.adopting.delete(id);
    this.loaded.delete(id);
    if (!record) return { removed: null, leadChanged: false };
    this.windows = this.windows.filter((window) => window !== record);
    const leadChanged = this.lead === id;
    if (leadChanged) this.lead = this.frontLoaded();
    return { removed: record, leadChanged };
  }

  /** The front window whose page has loaded; none leads until one has. */
  private frontLoaded(): string | null {
    return this.windows.find((window) => this.loaded.has(window.id))?.id ?? null;
  }

  /** `id` if it's a window here whose page has loaded. */
  private canLead(id: string | null): id is string {
    return id !== null && this.loaded.has(id) && this.get(id) !== null;
  }

  /** Takes a transaction, or refuses it (null) when it was made from an older state. */
  commit(transaction: Transaction): Committed | null {
    const touched = [...transaction.change.map((window) => window.id), ...transaction.close];
    const current = touched.every((id) => this.get(id)?.version === transaction.basis[id]);
    const fresh = transaction.open.every((window) => !this.get(window.id));
    if (!current || !fresh) return null;

    const closing = new Set(transaction.close);
    for (const id of closing) this.loaded.delete(id);
    const adopt: WindowRecord[] = [];
    const place: WindowRecord[] = [];
    const kept = this.windows
      .filter((window) => !closing.has(window.id))
      .map((window) => {
        const next = transaction.change.find((changed) => changed.id === window.id);
        if (!next) return window;
        const record = { ...next, version: window.version + 1 };
        adopt.push(record);
        if (!sameRect(window.frame, next.frame) || window.fullScreen !== next.fullScreen) {
          place.push(record);
        }
        return record;
      });
    const open = transaction.open.map((window) => ({ ...window, version: 0 }));
    const windows = [...kept, ...open];
    // A window the move opens comes to the front once its page loads.
    const front = windows.find(
      (window) => window.id === transaction.front && this.loaded.has(window.id),
    );
    this.windows = front ? [front, ...windows.filter((window) => window !== front)] : windows;
    for (const record of adopt) this.adopting.add(record.id);
    const lead = [transaction.lead, this.lead].find((id) => this.canLead(id)) ?? this.frontLoaded();
    const leadChanged = lead !== this.lead;
    this.lead = lead;
    this.memories = transaction.memories;
    return {
      open,
      adopt,
      place,
      close: transaction.close,
      front: transaction.front,
      lead: this.lead,
      leadChanged,
    };
  }
}
