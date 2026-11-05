import { type ReactNode, useEffect, useRef, useState } from "react";

import { DISK_STATUS, diskBytes } from "../../../../../stemcells/words/disk.ts";
import { useTheme } from "../upstream/disk";
import { type FieldBand, type FieldLayout, hollowCells, type FieldFinding } from "./field";
import {
  bandColor,
  DARK_FIELD,
  LIGHT_FIELD,
  type FieldColors,
  resolveTokenRgb,
  rgbCss,
  type Rgb,
} from "./fieldColors";
import type { FieldFocus } from "./fieldMotion";
import { FieldPainter } from "./fieldPainter";
import { diskPressure, FULL_BELOW, type DiskPressure } from "./pressure";

// The top of Settings › Disk: the drive's status in its colour, the room left, and the drive as a
// field of Cells where what's free wears that same colour, so the eye goes from word to room.

const STATUS_TONE: Readonly<Record<DiskPressure, string>> = {
  calm: "text-success-foreground",
  soon: "text-warning-foreground",
  now: "text-error-foreground",
};

const TONE_TOKENS: Readonly<Record<DiskPressure, readonly [string, Rgb]>> = {
  calm: ["--success-foreground", [52, 211, 153]],
  soon: ["--warning-foreground", [251, 191, 36]],
  now: ["--error-foreground", [248, 113, 113]],
};

const statusWord = (free: number, warnBelow: number) =>
  free < FULL_BELOW ? DISK_STATUS.full : DISK_STATUS[diskPressure(free, warnBelow)];

function resolveFieldTheme(resolvedTheme: "light" | "dark") {
  const resolve = (pressure: DiskPressure): Rgb => {
    const [token, fallback] = TONE_TOKENS[pressure];
    return resolveTokenRgb(token, fallback);
  };
  return {
    colors: resolvedTheme === "dark" ? DARK_FIELD : LIGHT_FIELD,
    tones: { calm: resolve("calm"), soon: resolve("soon"), now: resolve("now") },
  };
}

const fieldThemes = new Map<string, ReturnType<typeof resolveFieldTheme>>();

/** One answer per theme: it stands behind every effect that repaints a canvas. */
function fieldThemeOf(key: string, resolvedTheme: "light" | "dark") {
  const known = fieldThemes.get(key);
  if (known !== undefined) return known;
  const resolved = resolveFieldTheme(resolvedTheme);
  fieldThemes.set(key, resolved);
  return resolved;
}

/** The field's colours and each status's, as this theme resolves them. */
export function useFieldTheme() {
  const { resolvedTheme, theme, themeHalves } = useTheme();
  // All three: another theme of the same lightness has other tokens.
  return fieldThemeOf(JSON.stringify([resolvedTheme, theme, themeHalves]), resolvedTheme);
}

const SHUFFLE_MS = 820;
const SHUFFLE_STEP_MS = 55;
const LABELS_AFTER_MS = 700;

/** Digits still spinning `elapsed` into the wave stand as noise; the rest are the figure. */
function shuffledText(text: string, elapsed: number): string {
  const characters = [...text];
  const step = Math.floor(elapsed / SHUFFLE_STEP_MS);
  return characters
    .map((character, index) => {
      const lockAt = SHUFFLE_MS * (0.35 + (0.65 * (index + 1)) / characters.length);
      if (elapsed >= lockAt || !/\d/.test(character)) return character;
      return String(((index * 37 + step * 89) % 97) % 10);
    })
    .join("");
}

/** The figure spins and locks with the wave, digit by digit, then stands. */
function ShuffledFigure({ text }: { readonly text: string }) {
  const [reduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [elapsed, setElapsed] = useState(reduced ? SHUFFLE_MS : 0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A one-shot animation clock on mount, stopped by unmount or its own end.
  useEffect(() => {
    if (reduced) return undefined;
    let frame = 0;
    let shown = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const next = Math.min(SHUFFLE_MS, now - start);
      if (Math.floor(next / SHUFFLE_STEP_MS) !== Math.floor(shown / SHUFFLE_STEP_MS)) {
        shown = next;
        setElapsed(next);
      }
      if (next < SHUFFLE_MS) frame = requestAnimationFrame(tick);
      else setElapsed(SHUFFLE_MS);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);
  return <span aria-hidden>{elapsed >= SHUFFLE_MS ? text : shuffledText(text, elapsed)}</span>;
}

/** Each label sits under the band it names, and a band too narrow for its name goes without. */
function BandLabels(props: { readonly layout: FieldLayout; readonly focus: FieldFocus | null }) {
  const { layout, focus } = props;
  // The words arrive once the wave has passed them, not ahead of the cells they name.
  const [landed, setLanded] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A one-shot timer on mount, cleared on unmount.
  useEffect(() => {
    const timer = setTimeout(() => setLanded(true), LABELS_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  const width = layout.cols * layout.pitch;
  let lastEnd = -Infinity;
  const labels: Array<ReactNode> = [];
  layout.bands.forEach((band, index) => {
    if (band.count === 0) return;
    const x = Math.floor(band.start / layout.rows) * layout.pitch;
    const bandWidth = Math.ceil(band.count / layout.rows) * layout.pitch;
    const textWidth = Math.max(band.title.length * 6, diskBytes(band.bytes).length * 6);
    if (bandWidth < Math.min(textWidth, 46) || x < lastEnd + 6) return;
    const flip = x + textWidth > width;
    lastEnd = x + textWidth;
    const on = focus?.band === index;
    labels.push(
      <span
        key={band.id}
        className={`absolute top-0 whitespace-nowrap transition-opacity duration-100 ${flip ? "text-right" : ""} ${focus !== null && !on ? "opacity-35" : ""}`}
        style={flip ? { right: 0 } : { left: x }}
      >
        <span className={`block font-medium ${on ? "text-foreground" : "text-foreground/70"}`}>
          {band.title}
        </span>
        <span className="block tabular-nums">{diskBytes(band.bytes)}</span>
      </span>,
    );
  });
  return (
    <div
      aria-hidden
      className={`relative mt-1.5 h-8 text-2xs text-muted-foreground transition-opacity duration-300 ${landed ? "" : "opacity-0"}`}
    >
      {labels}
    </div>
  );
}

function BandCard(props: {
  readonly band: FieldBand;
  readonly item: number | null;
  readonly total: number;
  readonly warnBelow: number;
  readonly swatch: Rgb;
  readonly systemNote: string;
}) {
  const { band, item, swatch } = props;
  const share = props.total > 0 ? Math.round((band.bytes / props.total) * 100) : 0;
  const rest = band.bytes - band.items.reduce((sum, each) => sum + each.bytes, 0);
  const note =
    band.kind === "free"
      ? `Turns amber under ${diskBytes(props.warnBelow)}.`
      : band.kind === "counting"
        ? "Counted so far."
        : band.kind === "system"
          ? props.systemNote
          : null;
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: rgbCss(swatch) }} />
        <span className="min-w-0 truncate">{band.title}</span>
        <span className="ml-auto shrink-0 font-medium text-muted-foreground tabular-nums">
          {diskBytes(band.bytes)} · {share}%
        </span>
      </div>
      {note === null ? null : (
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{note}</p>
      )}
      {band.items.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs tabular-nums">
          {band.items.slice(0, 5).map((each, index) => (
            <li
              key={each.name}
              className={`flex justify-between gap-2 ${index === item ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              <span className="min-w-0 truncate">{each.name}</span>
              <span className="shrink-0">{diskBytes(each.bytes)}</span>
            </li>
          ))}
          {rest > 1e8 ? (
            <li
              className={`flex justify-between gap-2 ${item === band.items.length ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              <span>Everything else</span>
              <span>{diskBytes(rest)}</span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}

const CARD_WIDTH = 248;

/** The drive itself, drawn on a canvas that rests when nothing moves. */
function DriveField(props: {
  readonly layout: FieldLayout;
  readonly colors: FieldColors;
  readonly tone: Rgb;
  readonly previewTone: Rgb;
  readonly warnTone: Rgb;
  readonly focus: FieldFocus | null;
  readonly preview: ReadonlyArray<FieldFinding> | null;
  readonly warnBelow: number;
  readonly label: string;
  readonly systemNote: string;
  readonly total: number;
  readonly onFocus: (focus: FieldFocus | null) => void;
}) {
  const { layout, colors, tone, previewTone, warnTone, focus, preview, warnBelow } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const painter = useRef<FieldPainter | null>(null);
  const entered = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const [cardBand, setCardBand] = useState<{ band: number; item: number | null } | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The painter owns the canvas and its animation frames, from mount to unmount.
  useEffect(() => {
    const element = canvas.current;
    if (element === null) return undefined;
    const made = new FieldPainter(element);
    painter.current = made;
    return () => {
      made.dispose();
      painter.current = null;
      entered.current = false;
    };
  }, []);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands new figures to the canvas, which is outside React.
  useEffect(() => {
    painter.current?.update({ layout, colors, tone, entrance: !entered.current });
    entered.current = true;
  }, [layout, colors, tone]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands what's lit to the canvas, which is outside React.
  useEffect(() => {
    painter.current?.setFocus(focus);
  }, [focus]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands what would come back to the canvas, which is outside React.
  useEffect(() => {
    painter.current?.setHollow(
      preview === null ? new Set() : hollowCells(layout, preview),
      previewTone,
    );
  }, [preview, previewTone, layout]);

  const showsWarn = focus !== null && layout.bands[focus.band]?.kind === "free";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands the warning line to the canvas, which is outside React.
  useEffect(() => {
    painter.current?.setWarn(
      showsWarn ? Math.max(1, Math.round(warnBelow / layout.unit)) : 0,
      warnTone,
    );
  }, [showsWarn, warnBelow, warnTone, layout]);

  const leave = () => {
    painter.current?.setPointer(null);
    props.onFocus(null);
    setCardBand(null);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const hit = painter.current?.cellAt(x, y);
    if (!hit) {
      leave();
      return;
    }
    painter.current?.setPointer({ col: hit.col, row: hit.row });
    const bandIndex = layout.bandOf[hit.cell] ?? 0;
    const band = layout.bands[bandIndex];
    const item =
      band !== undefined && band.items.length > 0 ? (layout.itemOf[hit.cell] ?? 0) : null;
    if (focus?.band !== bandIndex || focus.item !== item) {
      props.onFocus({ band: bandIndex, item });
      setCardBand({ band: bandIndex, item });
    }
    const element = card.current;
    if (element === null) return;
    const left = Math.max(0, x + 14 + CARD_WIDTH > bounds.width ? x - CARD_WIDTH - 14 : x + 14);
    const height = element.offsetHeight;
    const top = Math.max(-16, Math.min(y - height / 2, bounds.height - height + 16));
    element.style.transform = `translate(${left}px, ${top}px)`;
  };

  const shownBand = cardBand === null ? undefined : layout.bands[cardBand.band];
  return (
    <div className="relative">
      <canvas
        ref={canvas}
        role="img"
        aria-label={props.label}
        className="block w-full touch-pan-y"
        onPointerMove={move}
        onPointerLeave={leave}
      />
      <div
        ref={card}
        aria-hidden
        className={`pointer-events-none absolute top-0 left-0 z-10 rounded-xl border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-xl transition-opacity duration-100 ${shownBand === undefined ? "opacity-0" : "opacity-100"}`}
        style={{ width: CARD_WIDTH }}
      >
        {shownBand === undefined || cardBand === null ? null : (
          <BandCard
            band={shownBand}
            item={cardBand.item}
            total={props.total}
            warnBelow={warnBelow}
            swatch={shownBand.kind === "free" ? tone : bandColor(colors, shownBand)}
            systemNote={props.systemNote}
          />
        )}
      </div>
    </div>
  );
}

export function DriveHero(props: {
  readonly name: ReactNode;
  readonly free: number;
  readonly total: number;
  readonly warnBelow: number;
  readonly layout: FieldLayout | null;
  readonly systemNote: string;
  readonly focus: FieldFocus | null;
  readonly preview: ReadonlyArray<FieldFinding> | null;
  readonly action: ReactNode;
  readonly onFocus: (focus: FieldFocus | null) => void;
  readonly fieldMinHeight: number;
}) {
  const { free, total, warnBelow, layout, preview } = props;
  const { colors, tones } = useFieldTheme();
  const added = preview?.reduce((sum, finding) => sum + finding.bytes, 0) ?? 0;
  const shownFree = free + added;
  const pressure = diskPressure(free, warnBelow);
  const shownPressure = diskPressure(shownFree, warnBelow);
  const label = `${diskBytes(free)} free of ${diskBytes(total)}.${
    layout === null
      ? ""
      : ` ${layout.bands
          .filter((band) => band.kind !== "free" && band.count > 0)
          .map((band) => `${band.title} ${diskBytes(band.bytes)}`)
          .join(", ")}.`
  }`;
  return (
    <div className="relative mb-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span
              className={`font-semibold transition-colors duration-200 ${STATUS_TONE[shownPressure]}`}
            >
              {statusWord(shownFree, warnBelow)}
            </span>
            <span className="min-w-0 truncate text-muted-foreground">{props.name}</span>
          </p>
          <p className="mt-1 mb-4 flex flex-wrap items-baseline gap-x-2.5" aria-label={label}>
            <span className="text-6xl leading-none font-semibold tracking-tighter tabular-nums">
              <ShuffledFigure text={diskBytes(shownFree)} />
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              free of {diskBytes(total)}
              {added > 0 ? (
                <span className={`ml-2 font-semibold ${STATUS_TONE[shownPressure]}`}>
                  +{diskBytes(added)}
                </span>
              ) : null}
            </span>
          </p>
        </div>
        {props.action}
      </div>
      <div style={{ minHeight: props.fieldMinHeight }}>
        {layout === null ? null : (
          <>
            <DriveField
              layout={layout}
              colors={colors}
              tone={tones[pressure]}
              previewTone={tones[shownPressure]}
              warnTone={tones.soon}
              focus={props.focus}
              preview={preview}
              warnBelow={warnBelow}
              label={label}
              systemNote={props.systemNote}
              total={total}
              onFocus={props.onFocus}
            />
            <BandLabels layout={layout} focus={props.focus} />
          </>
        )}
      </div>
    </div>
  );
}
