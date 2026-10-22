/**
 * A Cell thrown (stemcells/docs/interaction.md, The toss), in flight over its
 * window. Its chat stayed where it was and its place on the composer's line
 * stands empty; the Cell flies in a layer over the window's content, moved by
 * its transform alone. The flight is `throw.ts`, the Cell draws its facts
 * (`CellToss`), and a real hit says BONK! under it (`BonkWord`). Caught
 * mid-air it hangs from the hand and is thrown again; Esc sends it home.
 * Home, the layer goes and nothing of it runs; so does leaving the page it
 * flies over, which puts it home at once.
 */
import {
  Component,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { BonkWord } from "../cell/BonkWord";
import { CellToss, type TossDraw } from "../cell/CellToss";
import { cellBoxOf } from "../cell/forming";
import { BOX, POINTS_PER_PIXEL } from "../cell/look";
import type { Toss } from "../cell/toss";
import type { CellRef } from "../tabs/layout";
import { useRosterLook } from "../tabs/roster";
import { readWorkspace, useWorkspaceStore } from "../tabs/store";
import { motionTiming, reducedMotion, timing } from "../tokens/motion";
import { useCellGround } from "../upstream/appearance";
import { useCellLanding } from "../upstream/cellWork";
import { layerOpen } from "../upstream/layers";
import { useCellDriver } from "../upstream/providers";
import type { Point } from "./carry";
import {
  advance,
  type Arena,
  centreAt,
  grab,
  hold,
  isFlying,
  isHome,
  letGo,
  type Sample,
  setDown,
  throwCell,
  type Thrown,
  type ThrowTimes,
  tossOf,
  type Word,
} from "./throw";
import "./throw.css";

/** A Cell let go with speed, from a carry. */
export interface Launch {
  readonly cell: CellRef;
  /** Its box's centre as it was let go, in the page's CSS px. */
  readonly centre: Point;
  /** How fast the hand let go, CSS px a second (`handVelocity`). */
  readonly velocity: Point;
  /** Its box's centre less the hand. */
  readonly grip: Point;
  /** When its flight starts, `performance.now()` ms: as the let-go is handled, from where the card is. */
  readonly at: number;
  /** The tab it was thrown in: another on stage sends it home. */
  readonly tabId: string | null;
}

/** The Cells in flight, by thread. */
let flying: ReadonlyMap<string, Launch> = new Map();
const listeners = new Set<() => void>();

function setFlying(next: ReadonlyMap<string, Launch>): void {
  flying = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Throws a carried Cell: it flies from the hand, its place on the composer's line empty. */
export function throwFromCarry(launch: Launch): void {
  setFlying(new Map(flying).set(launch.cell.threadId, launch));
}

/** It's home: its place shows it again. */
function landed(launch: Launch): void {
  if (flying.get(launch.cell.threadId) !== launch) return;
  const next = new Map(flying);
  next.delete(launch.cell.threadId);
  setFlying(next);
}

/** Whether the Cell of `threadId` is away from its place, thrown. */
export function useCellAway(threadId: string | undefined): boolean {
  const read = () => threadId !== undefined && flying.has(threadId);
  return useSyncExternalStore(subscribe, read, read);
}

/** The flights running in this window: one Esc sends those still in the air home. */
const running = new Set<Flight>();

/** A field takes Esc while it has focus: the rename field, the palette's search, a terminal. */
const FIELDS = "input,textarea,select";

/**
 * The composer's text. Its editor marks every Esc handled, wanted or not
 * (ProseMirror's `captureKeyDown`), so that mark is no claim; when the
 * composer does use Esc (its menu open) it stops it there, and it never
 * reaches the window.
 */
const RICH_TEXT = ".ProseMirror";

/** Esc keys someone has claimed: handled by anything but the composer's editor's blanket mark. */
const claimed = new WeakSet<Event>();

/**
 * First of all, as an Esc comes in: whoever marks it handled from here on
 * claims it, unless that is the composer's editor marking every Esc.
 */
function watchEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (event.defaultPrevented) claimed.add(event);
  const prevent = event.preventDefault.bind(event);
  event.preventDefault = () => {
    const by = event.currentTarget;
    if (!(by instanceof Element && by.matches(RICH_TEXT))) claimed.add(event);
    prevent();
  };
}

/**
 * Esc sends every Cell in its flight proper home when it is no one
 * else's: no field has focus, no layer is open (upstream's own rule,
 * `upstream/layers.ts`), and no one claimed it (find closing, say). A
 * carry never lets it get here: it takes Esc first and stops it. Decided
 * once every handler has had it, so one Esc does one thing.
 */
function onEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.isComposing) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(FIELDS) != null || layerOpen()) return;
  setTimeout(() => {
    if (claimed.has(event)) return;
    for (const flight of running) if (flight.flying) flight.sendHome();
  }, 0);
}

function run(flight: Flight): void {
  if (running.size === 0) {
    window.addEventListener("keydown", watchEscape, true);
    window.addEventListener("keydown", onEscape);
  }
  running.add(flight);
}

function rest(flight: Flight): void {
  if (!running.delete(flight) || running.size > 0) return;
  window.removeEventListener("keydown", watchEscape, true);
  window.removeEventListener("keydown", onEscape);
}

/** The Cell's box, CSS px, as it stands on the composer's line. */
const SIZE = { width: BOX.width * POINTS_PER_PIXEL, height: BOX.height * POINTS_PER_PIXEL };

/** How often the Cell's place is measured again while it is away, ms: a composer that grows moves it. */
const REMEASURE = 250;

/**
 * Where it plays: the window's content (the slate) from its top down to the
 * line the Cell stands on at home, and its place along that line. Null
 * when its place isn't drawn.
 */
function arenaOf(threadId: string): Arena | null {
  const slate = document.querySelector("[data-stemcells-slate]")?.getBoundingClientRect();
  const home = cellBoxOf(threadId);
  if (!slate || !home || home.bottom <= slate.top) return null;
  return {
    bounds: {
      x: slate.left,
      y: slate.top,
      width: slate.width,
      height: Math.min(home.bottom, slate.bottom) - slate.top,
    },
    home: home.left + home.width / 2,
  };
}

const sampleOf = (event: PointerEvent | ReactPointerEvent): Sample => ({
  x: event.clientX,
  y: event.clientY,
  at: event.timeStamp,
});

const STILL: Toss = { held: false, vx: 0, vy: 0, grounded: true };

/** One Cell's flight: its clock, its hand, the box it moves, and the one loop that runs its frames. */
class Flight {
  private thrown: Thrown;
  private arena: Arena;
  private readonly times: ThrowTimes;
  private frame = 0;
  private measured: number;
  private goingHome = false;
  private done = false;
  /** Mounted: its loop may run. Unmounted for good, it is home. */
  private mounted = false;
  /** Its place wasn't drawn when it was thrown: it is home at once. */
  private readonly nowhere: boolean;
  /** The words on screen, as their times: they render again only when these change. */
  private said = "";
  /** What draws the Cell each frame (`CellToss`). */
  private readonly drawers = new Set<TossDraw>();

  constructor(
    private readonly launch: Launch,
    private readonly box: RefObject<HTMLDivElement | null>,
    private readonly showWords: (words: ReadonlyArray<Word>) => void,
  ) {
    this.times = {
      dizzy: timing("dizzy"),
      bearings: timing("bearings"),
      wordLife: timing("beat") + timing("knockStand") + motionTiming("recede").duration,
    };
    const arena = arenaOf(launch.cell.threadId);
    this.arena = arena ?? {
      bounds: { x: launch.centre.x, y: launch.centre.y, width: 0, height: 0 },
      home: launch.centre.x,
    };
    this.nowhere = arena === null;
    this.measured = launch.at;
    this.thrown = throwCell(launch.centre, launch.velocity, SIZE, launch.grip, launch.at);
  }

  /** The box's place now, for the first frame. */
  get transform(): string {
    return this.transformAt(centreAt(this.thrown, this.arena, this.thrown.at));
  }

  /** In its flight proper, not going home already: Esc sends it home. */
  get flying(): boolean {
    return !this.done && !this.goingHome && isFlying(this.thrown);
  }

  start(): void {
    this.mounted = true;
    if (this.nowhere) return this.finish();
    if (this.done) return;
    run(this);
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.tick);
  }

  /**
   * Unmounted. Mounted again at once (React's checks in development do
   * that), it carries on; otherwise its page went, and it is home.
   */
  leave(): void {
    this.mounted = false;
    cancelAnimationFrame(this.frame);
    queueMicrotask(() => {
      if (!this.mounted) this.finish();
    });
  }

  /** Each frame: the flight stepped (its place measured first), the box moved, then the Cell drawn. */
  private readonly tick = () => {
    if (this.done) return;
    this.frame = requestAnimationFrame(this.tick);
    const now = performance.now();
    this.stepTo(now);
    if (this.done) return;
    this.draw(now);
  };

  /** `draw` each frame, and at once. */
  readonly frames = (draw: TossDraw): (() => void) => {
    this.drawers.add(draw);
    const now = performance.now();
    draw(this.facts(now), now);
    return () => void this.drawers.delete(draw);
  };

  private facts(now: number): Toss {
    return this.goingHome ? STILL : tossOf(this.thrown, this.arena, Math.max(now, this.thrown.at));
  }

  private draw(now: number): void {
    const toss = this.facts(now);
    for (const draw of this.drawers) draw(toss, now);
  }

  private transformAt(centre: Point): string {
    return `translate3d(${centre.x - SIZE.width / 2}px, ${centre.y - SIZE.height / 2}px, 0)`;
  }

  /** The flight on to `now`: its place measured when due, the box moved, its words said, and home once it is. */
  private stepTo(now: number): void {
    if (this.done || this.goingHome || now <= this.thrown.at) return;
    if (now - this.measured >= REMEASURE) this.measure(now);
    if (this.done) return;
    this.thrown = advance(this.thrown, now, this.arena, this.times);
    const box = this.box.current;
    if (box) box.style.transform = this.transformAt(centreAt(this.thrown, this.arena, now));
    const said = this.thrown.words.map((word) => word.at).join();
    if (said !== this.said) {
      this.said = said;
      this.showWords(this.thrown.words);
    }
    if (isHome(this.thrown, this.arena, now)) this.finish();
  }

  /** The window's content and the Cell's place, measured again: gone, it is home. */
  measure(now = performance.now()): void {
    this.measured = now;
    const arena = arenaOf(this.launch.cell.threadId);
    if (arena === null) this.finish();
    else this.arena = arena;
  }

  /** Pressed: caught wherever it is, it hangs from the hand. */
  readonly down = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = this.box.current;
    if (event.button !== 0 || !box || this.done || this.goingHome) return;
    event.preventDefault();
    event.stopPropagation();
    box.setPointerCapture(event.pointerId);
    box.dataset.held = "true";
    this.thrown = grab(this.thrown, sampleOf(event), this.arena);
  };

  readonly move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!this.thrown.motion.held) return;
    this.thrown = hold(this.thrown, sampleOf(event), this.arena);
    const box = this.box.current;
    if (box) box.style.transform = this.transformAt(this.thrown.motion.position);
  };

  /** Let go: thrown again, as fast as the hand went. */
  readonly up = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!this.thrown.motion.held) return;
    this.release();
    this.thrown = letGo(this.thrown, sampleOf(event), this.arena, performance.now());
  };

  /** The press cancelled, or the hand lost: set down where it hangs, not thrown. */
  readonly lost = () => {
    if (!this.thrown.motion.held) return;
    this.release();
    this.thrown = setDown(this.thrown, performance.now());
  };

  private release(): void {
    const box = this.box.current;
    if (box) delete box.dataset.held;
  }

  /** Straight home on `land` (Esc). */
  sendHome(): void {
    this.measure();
    const box = this.box.current;
    if (this.done || !box || reducedMotion()) return this.finish();
    this.goingHome = true;
    const { bounds, home } = this.arena;
    const to = this.transformAt({ x: home, y: bounds.y + bounds.height - SIZE.height / 2 });
    const { duration, easing } = motionTiming("land");
    void box
      .animate([{ transform: box.style.transform }, { transform: to }], {
        duration,
        easing,
        fill: "forwards",
      })
      .finished.catch(() => undefined)
      .then(() => this.finish());
  }

  /** Home: it goes from the layer, its place shows it, nothing of it runs. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.frame);
    rest(this);
    this.drawers.clear();
    landed(this.launch);
  }
}

/** A thrown Cell in its layer, drawn every frame from its flight's facts. */
function FlyingCell(props: { readonly launch: Launch }) {
  const { launch } = props;
  const box = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState<ReadonlyArray<Word>>([]);
  const [flight] = useState(() => new Flight(launch, box, setWords));
  const look = useRosterLook(launch.cell.threadId);
  const provider = useCellDriver(launch.cell);
  const ground = useCellGround();
  const { strength } = useCellLanding(launch.cell);

  useLayoutEffect(() => {
    flight.start();
    return () => flight.leave();
  }, [flight]);

  useEffect(() => {
    const resized = () => flight.measure();
    // Another tab on stage, or Reduce Motion turned on: it is home at once.
    const unwatch = useWorkspaceStore.subscribe(() => {
      if (readWorkspace().activeTabId !== launch.tabId) flight.finish();
    });
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => {
      if (reduce.matches) flight.finish();
    };
    window.addEventListener("resize", resized);
    reduce.addEventListener("change", still);
    return () => {
      unwatch();
      window.removeEventListener("resize", resized);
      reduce.removeEventListener("change", still);
    };
  }, [flight, launch.tabId]);

  return createPortal(
    <div data-stemcells-throw="" aria-hidden>
      {/* First, so each word is said under the Cell. */}
      {words.map((word) => (
        <BonkWord
          key={word.at}
          tier={word.tier}
          surface={word.surface}
          body={word.body}
          bounds={word.bounds}
          heading={word.heading}
        />
      ))}
      <div
        ref={box}
        data-stemcells-thrown=""
        style={{ transform: flight.transform }}
        onPointerDown={flight.down}
        onPointerMove={flight.move}
        onPointerUp={flight.up}
        onPointerCancel={flight.lost}
        onLostPointerCapture={flight.lost}
      >
        <CellToss
          name={launch.cell.threadId}
          look={look}
          provider={provider}
          ground={ground}
          points={POINTS_PER_PIXEL}
          strength={strength}
          frames={flight.frames}
        />
      </div>
    </div>,
    document.body,
  );
}

/**
 * A thrown Cell that fails to draw is home: its place on the composer's
 * line shows it again rather than standing empty.
 */
class HomeOnError extends Component<{ readonly launch: Launch; readonly children: ReactNode }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    landed(this.props.launch);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Every Cell in flight in this window. Renders with the carry. */
export function CellThrows() {
  const now = useSyncExternalStore(
    subscribe,
    () => flying,
    () => flying,
  );
  return [...now.values()].map((launch) => (
    <HomeOnError key={`${launch.cell.threadId}:${launch.at}`} launch={launch}>
      <FlyingCell launch={launch} />
    </HomeOnError>
  ));
}
