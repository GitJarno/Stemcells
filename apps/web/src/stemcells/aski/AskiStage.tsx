/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheets (aski.css, cell.css), outside upstream's Tailwind entry. */
// Aski's stage: Aski on its ground line, and every awake Cell around it
// where `stage/stage.ts` puts it. Cells at work go round the orbit,
// starting and landed ones stand on the ground line, one that needs you
// steps out to the front, toward the cards; a Cell comes out of Aski as it
// starts and hops back in when it is closed.
//
// Everything moves on transform and opacity alone, played by the
// compositor at the display's refresh. The page's own code runs only when
// a Cell changes place or the stage changes size: nothing here asks for a
// frame, and the orbit holds still while the stage is out of sight, so a
// stage where nothing moves costs nothing. A scene that is due plays over
// the stage, drawn by its own worker (`stage/stage-scene.ts`).

import { type CSSProperties, useEffect, useLayoutEffect, useRef } from "react";
import { BOX, POINTS_PER_PIXEL } from "../cell/look.ts";
import { reducedMotion, spring, timed } from "../tokens/motion.ts";
import { settledDuration } from "../tokens/spring.ts";
import { AskiFigure } from "./AskiFigure.tsx";
import { Actor } from "./stage/actor.ts";
import type { ScenePart } from "./stage/scene.ts";
import {
  angleAt,
  askiMiddle,
  behind,
  type Cast,
  cast,
  joinAngle,
  type Metrics,
  type Orbit,
  offsetOf,
  orbitOf,
  orbitPose,
  type Pose,
  type StageCell,
  spotPoint,
} from "./stage/stage.ts";
import { StageScene } from "./stage/stage-scene.ts";
import "../tokens/stemcells.css";
import "../cell/cell.css";
import "./aski.css";

/** What the stage reads of a Cell. */
export interface StageRow {
  readonly key: string;
  /** Its stage as core sent it; a word the stage does not know places it as Working. */
  readonly stage: string;
  readonly bornAt: number;
  /** While it needs you: when the need began. */
  readonly needSince?: number | undefined;
  /** In its close's grace: off the stage, inside Aski, until Undo or the end of the grace. */
  readonly closing?: boolean | undefined;
  /** The face its character wears; a word the look does not know draws as `awake`. */
  readonly mood: string;
  /** Its provider's driver (`claudeAgent`, `codex`, …), whose colours it wears; absent, the coral Cell's. */
  readonly provider?: string | undefined;
  /** What it wears over its character (`theme/piece` ids); absent, nothing. */
  readonly look?: readonly string[] | undefined;
}

export interface AskiStageProps {
  readonly cells: readonly StageRow[];
  /** Whether nothing covers the page: no chat, Settings or pushed page over it. */
  readonly shown: boolean;
  /** The scene due on the stage or the last one played; absent when there is none. */
  readonly scene?: ScenePart | undefined;
  /** The screen's clock, in milliseconds. */
  readonly now: () => number;
  /** A due scene is shown to someone: play it. */
  readonly onPlay: (scene: string) => void;
  /** The line the stage says over a scene, in place of Aski's; undefined when none. */
  readonly onSay: (line: string | undefined) => void;
  /** The orbit swept out across the stage and drawn, a dotted ellipse behind Aski (the main window's Aski's page). */
  readonly wide?: boolean | undefined;
}

/** A Cell as small as it is when it comes out of Aski. */
const BUD = 0.4;

const CELL = {
  width: BOX.width * POINTS_PER_PIXEL,
  height: BOX.height * POINTS_PER_PIXEL,
} as const;

const stageCell = (c: StageRow): StageCell => ({
  key: c.key,
  stage: c.stage,
  bornAt: c.bornAt,
  closing: c.closing === true,
  ...(c.needSince === undefined ? {} : { needSince: c.needSince }),
});

/** Only what the stage shows of a Cell places them again: a work line's clock or a tool count does not. */
const standingOf = (cells: readonly StageRow[]): string =>
  cells
    .map((c) => `${c.key} ${c.stage} ${c.closing !== true} ${c.needSince} ${c.mood} ${c.provider}`)
    .join("\n");

const same = (a: Pose, b: Pose): boolean =>
  Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.scale - b.scale) < 0.01;

/** What the page's effects tell the stage once it is up. */
interface Stage {
  /** What the stage shows of the Cells changed: place them again. */
  readonly restand: (standing: string) => void;
  /** Whether nothing covers the page changed. */
  readonly show: (shown: boolean) => void;
  readonly part: (part: ScenePart | undefined) => void;
}

export function AskiStage(props: AskiStageProps) {
  const theaterRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const stageRef = useRef<Stage | null>(null);

  const standing = standingOf(props.cells);

  useLayoutEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const theater = theaterRef.current;
    const farLayer = farRef.current;
    const nearLayer = nearRef.current;
    if (theater === null || farLayer === null || nearLayer === null) return;
    // The scene's canvas is made here, one per mount: its control goes to the worker once, for good.
    const sceneCanvas = document.createElement("canvas");
    sceneCanvas.className = "stage-scene";
    theater.append(sceneCanvas);
    const scene = new StageScene(sceneCanvas, theater, {
      now: () => latest.current.now(),
      play: (id) => latest.current.onPlay(id),
      say: (line) => latest.current.onSay(line),
    });
    const now = (): number => Number(document.timeline.currentTime ?? performance.now());
    const actors = new Map<string, Actor>();
    /** The angle at time 0 of each Cell in the orbit, or on its way there: what spaces them. */
    const orbits = new Map<string, number>();
    let before: Cast | undefined;
    let metrics: Metrics | undefined;
    let seen = false;
    let running = true;
    let stood = standingOf(latest.current.cells);
    let shown = latest.current.shown;

    const measure = (): Metrics | undefined => {
      const figure = theater.querySelector(".aski-figure");
      const width = theater.clientWidth;
      const aski = figure instanceof HTMLElement ? figure.offsetHeight : 0;
      if (width === 0 || aski === 0) return undefined;
      const gap =
        Number.parseFloat(getComputedStyle(theater).getPropertyValue("--sc-space-sm")) || 0;
      return { width, aski, cell: CELL, gap };
    };

    /** Where every other Cell in the orbit, or on its way there, will be at `time`. */
    const taken = (o: Orbit, time: number, except: string): number[] =>
      [...orbits]
        .filter(([key]) => key !== except)
        .map(([, offset]) => angleAt(offset, time, o.period));

    /** Starts a Cell round the orbit; under Reduce Motion it stands where it joined. */
    const startOrbit = (key: string, actor: Actor, o: Orbit, m: Metrics, offset: number): void => {
      orbits.set(key, offset);
      if (reducedMotion()) {
        const angle = angleAt(offset, now(), o.period);
        actor.stand(orbitPose(o, m, angle), behind(angle));
        return;
      }
      actor.orbit(o, m, offset);
      if (!running) actor.hold(true);
    };

    /** Puts every Cell where the stage says; `resized` stands each at once in the stage's new size. */
    const place = (resized: boolean): void => {
      const m = metrics;
      if (m === undefined) return;
      const { cells, wide } = latest.current;
      const rows = new Map(cells.map((c) => [c.key, c]));
      const casting = cast(before, cells.map(stageCell));
      before = casting.cast;
      const still = reducedMotion();
      const o = orbitOf(m, wide === true);
      theater.style.setProperty("--orbit-rx", `${o.rx}px`);
      theater.style.setProperty("--orbit-ry", `${o.ry}px`);
      theater.style.setProperty("--orbit-cy", `${o.cy}px`);
      const t = now();
      // Read once: each read of a token is a read of computed style, which the moves below dirty.
      const travel = spring("travel");
      const settle = spring("settle");
      const fade = timed("fade");

      for (const [key, { spot, entry }] of casting.spots) {
        const row = rows.get(key);
        let actor = actors.get(key);
        if (actor === undefined) {
          actor = new Actor({ far: farLayer, near: nearLayer }, now);
          actors.set(key, actor);
        }
        if (row !== undefined) actor.dress(row.mood, row.provider, row.look);

        if (spot.place === "orbit") {
          const offset = orbits.get(key);
          if (offset !== undefined && entry === "stays") {
            if (resized) startOrbit(key, actor, o, m, offset);
            continue;
          }
          if (entry === "appears" || resized) {
            const angle = joinAngle(o, m, orbitPose(o, m, Math.PI / 2), taken(o, t, key), true);
            startOrbit(key, actor, o, m, offsetOf(angle, t, o.period));
            continue;
          }
          const from = entry === "arrives" ? askiMiddle(m) : actor.pose();
          if (still) {
            startOrbit(
              key,
              actor,
              o,
              m,
              offsetOf(joinAngle(o, m, from, taken(o, t, key)), t, o.period),
            );
            actor.fadeIn(fade);
            continue;
          }
          // Into the orbit, in front of Aski, where it will be clear of the others when it gets there.
          // Its spot there is over Aski, so one coming out of Aski grows toward the person, over it.
          const landing = t + settledDuration(travel) * 1000;
          const angle = joinAngle(o, m, from, taken(o, landing, key));
          orbits.set(key, offsetOf(angle, landing, o.period));
          if (entry === "arrives") actor.stand({ ...from, scale: BUD, opacity: 0 });
          const landed = actor;
          actor.travel(orbitPose(o, m, angle), travel, {
            land: () => startOrbit(key, landed, o, m, offsetOf(angle, now(), o.period)),
          });
          continue;
        }

        orbits.delete(key);
        const to: Pose = { ...spotPoint(spot, m), scale: 1, opacity: 1 };
        if (entry === "appears" || resized) {
          actor.stand(to);
        } else if (still) {
          if (actor.target === undefined || !same(actor.target, to)) {
            actor.stand(to);
            actor.fadeIn(fade);
          }
        } else if (entry === "arrives") {
          actor.stand({ ...askiMiddle(m), scale: BUD, opacity: 0 }, true);
          actor.travel(to, travel, { far: true });
        } else if (entry === "moves") {
          actor.travel(to, travel);
        } else if (actor.target === undefined || !same(actor.target, to)) {
          // The same place, a gap closing up.
          actor.travel(to, settle);
        }
      }

      for (const key of casting.left) {
        const actor = actors.get(key);
        actors.delete(key);
        orbits.delete(key);
        if (actor === undefined) continue;
        if (still || resized) void actor.fadeOut(fade);
        else void actor.hop({ ...askiMiddle(m), scale: 1, opacity: 0 }, m.aski);
      }
    };

    /** The orbit goes round only while someone can see it. */
    const run = (): void => {
      const visible = seen && latest.current.shown && document.visibilityState === "visible";
      scene.run(visible);
      if (visible === running) return;
      running = visible;
      for (const actor of actors.values()) actor.hold(!running);
    };

    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The size places the Cells by transform, never through React state.
    const sized = new ResizeObserver(() => {
      const m = measure();
      if (m === undefined) return;
      const resized =
        metrics !== undefined && (m.width !== metrics.width || m.aski !== metrics.aski);
      const first = metrics === undefined;
      metrics = m;
      if (first || resized) {
        place(!first);
        scene.size(m);
      }
    });
    sized.observe(theater);
    const sighted = new IntersectionObserver((entries) => {
      seen = entries.some((e) => e.isIntersecting);
      run();
    });
    sighted.observe(theater);
    document.addEventListener("visibilitychange", run);

    stageRef.current = {
      restand: (next) => {
        if (next === stood) return;
        stood = next;
        place(false);
      },
      show: (next) => {
        if (next === shown) return;
        shown = next;
        run();
      },
      part: (part) => scene.part(part),
    };

    return () => {
      stageRef.current = null;
      sized.disconnect();
      sighted.disconnect();
      document.removeEventListener("visibilitychange", run);
      for (const actor of actors.values()) actor.remove();
      actors.clear();
      scene.close();
      sceneCanvas.remove();
    };
  }, []);

  useEffect(() => {
    stageRef.current?.restand(standing);
  }, [standing]);

  useEffect(() => {
    stageRef.current?.show(props.shown);
  }, [props.shown]);

  useEffect(() => {
    stageRef.current?.part(props.scene);
  }, [props.scene]);

  const style = {
    "--stage-cell-width": `${CELL.width}px`,
    "--stage-cell-height": `${CELL.height}px`,
  } as CSSProperties;
  return (
    <div
      className="aski-theater"
      ref={theaterRef}
      data-wide={props.wide === true ? "" : undefined}
      style={style}
    >
      {props.wide === true ? <div className="stage-orbit" /> : null}
      <div className="stage-far" ref={farRef} />
      <AskiFigure />
      <div className="stage-ground" />
      <div className="stage-near" ref={nearRef} />
    </div>
  );
}
