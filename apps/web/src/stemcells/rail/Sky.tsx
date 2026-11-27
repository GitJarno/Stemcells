import { type CSSProperties, useEffect, useLayoutEffect, useRef } from "react";

import { cssEasing } from "../motion/listMotion";
import { litPath } from "../motion/moon";
import {
  BIRD_PATH,
  BIRDS,
  birdsAt,
  CLOUDS,
  nextVisit,
  type Pose,
  SEED,
  seedAt,
  shootingStarAt,
  SKY,
  SKY_SHAPE,
  SKY_SPANS,
  SKY_TURN,
  SKY_VISITS,
  type SkyPalette,
  type SkyVisit,
  skyStops,
  skyTurn,
  starGroups,
  type Span,
  wingAt,
  withAlpha,
} from "../motion/sky";
import { reducedMotion } from "../tokens/motion";
import { useSkyScheme } from "../upstream/appearance";

/** The head's foot under the titlebar, the search's plate and its room, in px at the default size. */
const FOOT = 52 + 32 + 8;
const HEIGHT = FOOT + SKY_SHAPE.tail;
/** Whole for half the way to the head's foot, as on the phone; the stars reach most of the way. */
const WHOLE = FOOT / 2 / HEIGHT;
const STARS_REACH = (FOOT * 0.92) / HEIGHT;
/** Where the sun and moon stand: the titlebar's right, away from the window's controls. */
const BODY_FROM_RIGHT = "1.75rem";
const BODY_AT = `calc(100% - ${BODY_FROM_RIGHT}) calc(var(--workspace-topbar-height) / 2)`;
const { r: R, sinks: SINKS, rises: RISES, halo: HALO } = SKY_SHAPE.body;
const BOX = 2 * HALO * R;
/** Across the column, as a share, where the moon is reckoned to stand: the stars keep clear of it. */
const BODY_ACROSS = 0.9;

// Each layer is a calc of the one progress the column's sky turns (`--sky-night`, cells.css).
const along = (span: Span) => `clamp(0, (var(--sky-night) - ${span[0]}) / ${span[1] - span[0]}, 1)`;
const eased = (span: Span) => {
  const t = along(span);
  return `(${t} * ${t} * (3 - 2 * ${t}))`;
};
const comes = (span: Span) => `calc(${eased(span)})`;
const goes = (span: Span) => `calc(1 - ${eased(span)})`;

const gradient = (stops: ReturnType<typeof skyStops>) =>
  `linear-gradient(to bottom, ${stops
    .map((stop) => `${withAlpha(stop.colour, stop.opacity)} ${stop.offset * 100}%`)
    .join(", ")})`;

const clouds = (colour: string, alpha: number) =>
  CLOUDS.flatMap((cloud) => {
    const x = cloud.x * 100;
    const y = cloud.y * STARS_REACH * 100;
    const fill = `${withAlpha(colour, alpha)}, transparent`;
    return cloud.lobes.map(
      (lobe) =>
        `radial-gradient(${lobe.rx}px ${lobe.ry}px at calc(${x}% + ${lobe.dx}px) calc(${y}% + ${lobe.dy}px), ${fill})`,
    );
  }).join(", ");

const disc = (colour: string, halo: number) =>
  `radial-gradient(circle closest-side, ${colour} 0 ${100 / HALO - 1}%, transparent ${100 / HALO}%), radial-gradient(circle closest-side, ${withAlpha(colour, halo)}, transparent)`;

const STARS = starGroups(BODY_ACROSS);

/**
 * The column's sky (stemcells/tasks/day-night.md): behind the window's controls, the search and
 * New Cell, at `at`, the sky the column is headed to; the phone's sky, drawn in CSS. A turn sets
 * off from where the sky stands, on the shared timings.
 */
export function ColumnSky(props: { at: number; moonPhase: number }) {
  const palette = SKY[useSkyScheme()];
  const ref = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);
  const to = props.at;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Turns the sky's CSS transition from the value it shows now, which only the browser knows mid-turn.
  useLayoutEffect(() => {
    const sky = ref.current;
    if (sky === null) return;
    const shows = Number.parseFloat(getComputedStyle(sky).getPropertyValue("--sky-night"));
    const turn = drawn.current
      ? skyTurn(Number.isFinite(shows) ? shows : to, to, reducedMotion())
      : null;
    drawn.current = true;
    if (turn !== null && Number.isFinite(shows)) {
      // Hold the sky where it stands first, so a turn mid-turn sets off from rest rather than
      // reversing the running transition, which the browser shortens and starts partway along.
      sky.style.transition = "none";
      sky.style.setProperty("--sky-night", String(shows));
      void sky.offsetWidth;
    }
    sky.style.transition =
      turn === null
        ? "none"
        : `--sky-night ${turn.ms}ms ${turn.eased ? cssEasing(SKY_TURN.easing) : "linear"}`;
    sky.style.setProperty("--sky-night", String(to));
  }, [to]);
  const phase = props.moonPhase;
  const middle = BOX / 2;
  return (
    <div
      ref={ref}
      data-cells-sky=""
      aria-hidden
      style={{ "--sky-tail": `${SKY_SHAPE.tail}px` } as CSSProperties}
    >
      <div
        data-cells-sky-layer=""
        style={{
          background: gradient(skyStops(palette.day, WHOLE)),
          opacity: goes(SKY_SPANS.dayLifts),
        }}
      />
      <div
        data-cells-sky-layer=""
        style={{
          background: gradient(skyStops(palette.night, WHOLE)),
          opacity: comes(SKY_SPANS.nightDeepens),
        }}
      />
      <div
        data-cells-sky-layer=""
        style={{
          background: `radial-gradient(ellipse 90% 140% at ${BODY_AT}, ${withAlpha(palette.haze.colour, palette.haze.alpha)}, transparent 70%)`,
          opacity: goes(SKY_SPANS.sunGoes),
        }}
      />
      <div
        data-cells-sky-layer=""
        style={{
          background: clouds(palette.cloud.colour, palette.cloud.alpha),
          opacity: goes(SKY_SPANS.cloudsGo),
        }}
      />
      <svg data-cells-sky-layer="" width="100%" height="100%">
        {STARS.map((stars, n) => (
          <g key={SKY_SPANS.stars[n]!.join()} style={{ opacity: comes(SKY_SPANS.stars[n]!) }}>
            {stars.map((star) => (
              <circle
                key={`${star.x}:${star.y}`}
                cx={`${star.x * 100}%`}
                cy={`${star.y * STARS_REACH * 100}%`}
                r={star.r}
                fill={palette.star}
                fillOpacity={Math.min(1, star.alpha * palette.starLight)}
              />
            ))}
          </g>
        ))}
      </svg>
      <Visits night={to >= 0.5} palette={palette} />
      <div
        data-cells-sky-body=""
        style={{
          top: `calc(var(--workspace-topbar-height) / 2 - ${middle}px)`,
          right: `calc(${BODY_FROM_RIGHT} - ${middle}px)`,
          width: BOX,
          height: BOX,
          background: disc(palette.sun, palette.halo),
          opacity: goes(SKY_SPANS.sunGoes),
          transform: `translateY(calc(${eased(SKY_SPANS.sunSinks)} * var(--sky-moves) * ${SINKS}px))`,
        }}
      />
      <svg
        data-cells-sky-body=""
        width={BOX}
        height={BOX}
        style={{
          top: `calc(var(--workspace-topbar-height) / 2 - ${middle}px)`,
          right: `calc(${BODY_FROM_RIGHT} - ${middle}px)`,
          opacity: comes(SKY_SPANS.moonComes),
          transform: `translateY(calc((1 - ${eased(SKY_SPANS.moonRises)}) * var(--sky-moves) * ${RISES}px))`,
        }}
      >
        <defs>
          <radialGradient id="cells-moonlight">
            <stop offset={0} stopColor={palette.moon} stopOpacity={palette.halo} />
            <stop offset={1} stopColor={palette.moon} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={middle} cy={middle} r={middle} fill="url(#cells-moonlight)" />
        <circle cx={middle} cy={middle} r={R} fill={palette.moonShadow} />
        <path
          d={litPath(phase, R)}
          fill={palette.moon}
          transform={`translate(${middle} ${middle})`}
        />
      </svg>
    </div>
  );
}

/** Keyframes sampled from a visitor's pose, every `step` ms of its crossing, from (`x`, `y`). */
function framesOf(ms: number, step: number, at: (t: number) => Keyframe): Keyframe[] {
  const count = Math.max(12, Math.ceil(ms / step));
  return Array.from({ length: count + 1 }, (_, n) => at(n / count));
}

const placed = (x: number, y: number, pose: Pose): Keyframe => ({
  transform: `translate(${x + pose.x}px, ${y + pose.y}px) rotate(${pose.rotate}deg)`,
  opacity: pose.opacity,
});

/**
 * Now and then a visitor crosses the sky (`SKY_VISITS`): a shooting star by night, a seed or
 * birds by day. Each is drawn once and played as one compositor animation; between visits no
 * timer but the next one's runs. Each fades with its own sky, so a turn takes it away.
 */
function Visits(props: { night: boolean; palette: SkyPalette }) {
  const { night, palette } = props;
  const box = useRef<HTMLDivElement>(null);
  const star = useRef<HTMLDivElement>(null);
  const seed = useRef<SVGSVGElement>(null);
  const flock = useRef<HTMLDivElement>(null);
  const wings = useRef<(SVGSVGElement | null)[]>([]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Schedules the next visitor on a timer while the window shows, and clears it when the sky turns or leaves.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const play = (visit: SkyVisit) => {
      const sky = box.current;
      if (sky === null || reducedMotion()) return;
      const { width, height } = sky.getBoundingClientRect();
      if (width === 0) return;
      const reach = height * STARS_REACH;
      const x = visit.x * width;
      const y = visit.y * reach;
      const ms = SKY_VISITS.ms[visit.kind];
      const timing = { duration: ms, easing: "linear" } as const;
      if (visit.kind === "shootingStar")
        star.current?.animate(
          framesOf(ms, 30, (t) => placed(x, y, shootingStarAt(t, width, reach))),
          timing,
        );
      else if (visit.kind === "seed")
        seed.current?.animate(
          framesOf(ms, 120, (t) => placed(x, y, seedAt(t, width))),
          timing,
        );
      else {
        flock.current?.animate(
          framesOf(ms, 120, (t) => placed(x, y, birdsAt(t, width))),
          timing,
        );
        wings.current.forEach((wing, n) =>
          wing?.animate(
            framesOf(ms, 40, (t) => ({ transform: `scaleY(${wingAt(t, n, ms)})` })),
            timing,
          ),
        );
      }
    };
    const arm = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      const visit = nextVisit(night, first, Math.random);
      first = false;
      timer = setTimeout(() => {
        play(visit);
        arm();
      }, visit.wait);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [night]);
  return (
    <div ref={box} data-cells-sky-layer="">
      <div data-cells-sky-layer="" style={{ opacity: comes(SKY_SPANS.stars[0]) }}>
        <div
          ref={star}
          data-cells-sky-visitor=""
          style={{
            width: 70,
            height: 1.5,
            borderRadius: 1,
            background: `linear-gradient(to right, transparent, ${withAlpha(palette.star, 0.9)})`,
          }}
        />
      </div>
      <div data-cells-sky-layer="" style={{ opacity: goes(SKY_SPANS.cloudsGo) }}>
        <svg ref={seed} data-cells-sky-visitor="" width={16} height={22} viewBox="0 0 16 22">
          <g
            stroke={palette.seed.colour}
            strokeOpacity={palette.seed.alpha}
            strokeWidth={0.5}
            strokeLinecap="round"
            fill={palette.seed.colour}
            fillOpacity={palette.seed.alpha}
          >
            {SEED.filaments.map((end) => (
              <g key={`${end.x}:${end.y}`}>
                <line x1={SEED.heart.x} y1={SEED.heart.y} x2={end.x} y2={end.y} />
                <circle cx={end.x} cy={end.y} r={0.55} stroke="none" />
              </g>
            ))}
            <line
              x1={SEED.heart.x}
              y1={SEED.stalk.from}
              x2={SEED.heart.x}
              y2={SEED.stalk.to}
              strokeWidth={0.6}
            />
            <ellipse
              cx={SEED.heart.x}
              cy={SEED.seed.y}
              rx={SEED.seed.rx}
              ry={SEED.seed.ry}
              stroke="none"
            />
          </g>
        </svg>
        <div ref={flock} data-cells-sky-visitor="">
          {BIRDS.map((bird, n) => (
            <svg
              key={bird.dx}
              ref={(wing) => {
                wings.current[n] = wing;
              }}
              data-cells-sky-bird=""
              width={10 * bird.size}
              height={4 * bird.size}
              viewBox="0 0 10 4"
              overflow="visible"
              style={{ left: bird.dx, top: bird.dy }}
            >
              <path
                d={BIRD_PATH}
                fill="none"
                stroke={palette.birds.colour}
                strokeOpacity={palette.birds.alpha}
                strokeWidth={1.3 / bird.size}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ))}
        </div>
      </div>
    </div>
  );
}
