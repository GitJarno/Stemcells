import { type CSSProperties, useEffect, useLayoutEffect, useRef } from "react";

import { cssEasing } from "../motion/listMotion";
import { litPath } from "../motion/moon";
import {
  nextVisit,
  type Pose,
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
/** Where the moon stands: the titlebar's right, away from the window's controls. */
const BODY_FROM_RIGHT = "1.75rem";
const { r: R, rises: RISES, halo: HALO } = SKY_SHAPE.body;
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

const gradient = (stops: ReturnType<typeof skyStops>) =>
  `linear-gradient(to bottom, ${stops
    .map((stop) => `${withAlpha(stop.colour, stop.opacity)} ${stop.offset * 100}%`)
    .join(", ")})`;

const STARS = starGroups(BODY_ACROSS);

/**
 * The column's night (stemcells/tasks/day-night.md): behind the window's controls, the search and
 * New Cell, at `at`, the sky the column is headed to (none, or night); the phone's sky, drawn in
 * CSS. A turn sets off from where the sky stands, on the shared timings.
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
          background: gradient(skyStops(palette.night, WHOLE)),
          opacity: comes(SKY_SPANS.nightDeepens),
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
      <ShootingStars night={to >= 0.5} palette={palette} />
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
 * Now and then a shooting star crosses the night (`SKY_VISITS`), drawn once and played as one
 * compositor animation; between them no timer but the next one's runs, and none at all without
 * night. It fades with the stars, so a turn takes one in flight away.
 */
function ShootingStars(props: { night: boolean; palette: SkyPalette }) {
  const { night } = props;
  const box = useRef<HTMLDivElement>(null);
  const star = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Schedules the next shooting star on a timer while the window shows, and clears it when night lifts.
  useEffect(() => {
    if (!night) return;
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
      const ms = SKY_VISITS.ms;
      star.current?.animate(
        framesOf(ms, 30, (t) => placed(x, y, shootingStarAt(t, width, reach))),
        { duration: ms, easing: "linear" },
      );
    };
    const arm = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      const visit = nextVisit(first, Math.random);
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
    <div ref={box} data-cells-sky-layer="" style={{ opacity: comes(SKY_SPANS.stars[0]) }}>
      <div
        ref={star}
        data-cells-sky-visitor=""
        style={{
          width: 70,
          height: 1.5,
          borderRadius: 1,
          background: `linear-gradient(to right, transparent, ${withAlpha(props.palette.star, 0.9)})`,
        }}
      />
    </div>
  );
}
