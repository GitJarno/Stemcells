import { type CSSProperties, useLayoutEffect, useRef } from "react";

import { cssEasing } from "../motion/listMotion";
import { litPath, moonPhase } from "../motion/moon";
import {
  CLOUDS,
  SKY,
  SKY_SHAPE,
  SKY_SPANS,
  SKY_TURN,
  skyAtStage,
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
/** Where the sun and moon stand: the titlebar's right, away from the window's controls. */
const BODY_FROM_RIGHT = "1.75rem";
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
const warm = (peak: number) => `calc(sin(${along(SKY_SPANS.horizon)} * ${Math.PI}) * ${peak})`;

const gradient = (stops: ReturnType<typeof skyStops>) =>
  `linear-gradient(to bottom, ${stops
    .map((stop) => `${withAlpha(stop.colour, stop.opacity)} ${stop.offset * 100}%`)
    .join(", ")})`;

const clouds = (colour: string, alpha: number) =>
  CLOUDS.flatMap((cloud) => {
    const x = cloud.x * 100;
    const y = cloud.y * STARS_REACH * 100;
    const fill = `${withAlpha(colour, alpha)}, transparent`;
    return [
      `radial-gradient(${cloud.width / 2}px ${cloud.height / 2}px at ${x}% ${y}%, ${fill})`,
      `radial-gradient(${cloud.width / 4}px ${cloud.height * 0.4}px at calc(${x}% + ${cloud.width * 0.18}px) calc(${y}% - ${cloud.height * 0.35}px), ${fill})`,
    ];
  }).join(", ");

const disc = (colour: string, halo: number) =>
  `radial-gradient(circle closest-side, ${colour} 0 ${100 / HALO - 1}%, transparent ${100 / HALO}%), radial-gradient(circle closest-side, ${withAlpha(colour, halo)}, transparent)`;

const STARS = starGroups(BODY_ACROSS);

/**
 * The column's sky (stemcells/tasks/day-night.md): behind the window's controls, the search and
 * New Cell, at the sky of the stage the column is headed to; the phone's sky, drawn in CSS. A turn
 * sets off from where the sky stands, on the shared timings, and `rise` takes dawn into day at the
 * rise's slower pace.
 */
export function ColumnSky(props: { stage: string; now: number; rise?: boolean }) {
  const palette = SKY[useSkyScheme()];
  const ref = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);
  const to = skyAtStage(props.stage);
  const rise = props.rise ?? false;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Turns the sky's CSS transition from the value it shows now, which only the browser knows mid-turn.
  useLayoutEffect(() => {
    const sky = ref.current;
    if (sky === null) return;
    const shows = Number.parseFloat(getComputedStyle(sky).getPropertyValue("--sky-night"));
    const turn = drawn.current
      ? skyTurn(Number.isFinite(shows) ? shows : to, to, reducedMotion(), rise)
      : null;
    drawn.current = true;
    sky.style.transition =
      turn === null
        ? "none"
        : `--sky-night ${turn.ms}ms ${turn.eased ? cssEasing(SKY_TURN.easing) : "linear"}`;
    sky.style.setProperty("--sky-night", String(to));
  }, [to, rise]);
  // Held to a few hundred phases, so the path redraws a few times a day, not each minute.
  const phase = Math.round(moonPhase(props.now) * 240) / 240;
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
          background: `radial-gradient(ellipse 85% 100% at calc(100% - ${BODY_FROM_RIGHT}) 40%, ${palette.warm.inner}, ${withAlpha(palette.warm.outer, 0.55)} 50%, transparent)`,
          opacity: warm(palette.warm.peak),
        }}
      />
      <div
        data-cells-sky-layer=""
        style={{
          background: clouds(palette.cloud.colour, palette.cloud.alpha),
          opacity: goes(SKY_SPANS.cloudsGo),
        }}
      />
      <div
        data-cells-sky-layer=""
        style={{ background: clouds(palette.warm.inner, palette.cloud.alpha), opacity: warm(1) }}
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
      >
        <div
          data-cells-sky-layer=""
          style={{
            background: disc(palette.setting, palette.halo),
            opacity: comes(SKY_SPANS.sunWarms),
          }}
        />
      </div>
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
