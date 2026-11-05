import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react";
import { Pressable, type TextStyle, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { DISK_STATUS, diskBytes } from "../../../../../stemcells/words/disk.ts";
import { AppText } from "../upstream/disk";
import { type CellGroup, FieldPicture, useFieldTheme } from "./fieldPicture";
import {
  bandColor,
  diskPressure,
  type FieldFinding,
  type FieldFocus,
  type FieldLayout,
  FULL_BELOW,
  hollowCells,
  rgbCss,
  type Rgb,
} from "./kit";

// The top of the phone's Settings › Disk: the drive's status in its colour, the room left, and the
// drive as a field of Cells, as the Mac shows it (`apps/web/src/stemcells/disk/DriveHero.tsx`).
// A finger has no hover: touching the field names the band under it in the headline's place, as
// a chart does when scrubbed, so the finger never covers what it uncovers.

const SHUFFLE_MS = 820;
const SHUFFLE_STEP_MS = 55;
const LABELS_AFTER_MS = 700;
const LABEL_CHAR = 6.2;

const statusWord = (free: number, warnBelow: number) =>
  free < FULL_BELOW ? DISK_STATUS.full : DISK_STATUS[diskPressure(free, warnBelow)];

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

const FIGURE = {
  fontSize: 54,
  lineHeight: 58,
  letterSpacing: -2,
  fontVariant: ["tabular-nums"],
} satisfies TextStyle;

/** The figure spins and locks with the wave, digit by digit, then stands. */
function ShuffledFigure({ text }: { readonly text: string }) {
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(reduced ? SHUFFLE_MS : 0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A one-shot animation clock on mount, stopped by unmount or its own end.
  useEffect(() => {
    if (reduced) return undefined;
    const start = Date.now();
    const timer = setInterval(() => {
      const next = Math.min(SHUFFLE_MS, Date.now() - start);
      setElapsed(next);
      if (next >= SHUFFLE_MS) clearInterval(timer);
    }, SHUFFLE_STEP_MS);
    return () => clearInterval(timer);
  }, [reduced]);
  return (
    <AppText className="font-t3-semibold text-foreground" style={FIGURE}>
      {elapsed >= SHUFFLE_MS ? text : shuffledText(text, elapsed)}
    </AppText>
  );
}

/** Each label sits under the band it names; a band too narrow for its name goes without. */
function BandLabels(props: { readonly layout: FieldLayout; readonly hidden: boolean }) {
  const { layout } = props;
  const width = layout.cols * layout.pitch;
  let lastEnd = -Infinity;
  const labels: Array<ReactNode> = [];
  layout.bands.forEach((band) => {
    if (band.count === 0) return;
    const x = Math.floor(band.start / layout.rows) * layout.pitch;
    const bandWidth = Math.ceil(band.count / layout.rows) * layout.pitch;
    const textWidth = Math.max(band.title.length, diskBytes(band.bytes).length) * LABEL_CHAR;
    if (bandWidth < Math.min(textWidth, 46) || x < lastEnd + 6) return;
    const flip = x + textWidth > width;
    lastEnd = x + textWidth;
    labels.push(
      <View key={band.id} className="absolute top-0" style={flip ? { right: 0 } : { left: x }}>
        <AppText
          className={`text-2xs font-t3-medium text-foreground-muted ${flip ? "text-right" : ""}`}
          numberOfLines={1}
        >
          {band.title}
        </AppText>
        <AppText
          className={`text-2xs text-foreground-muted ${flip ? "text-right" : ""}`}
          style={{ fontVariant: ["tabular-nums"] }}
          numberOfLines={1}
        >
          {diskBytes(band.bytes)}
        </AppText>
      </View>,
    );
  });
  // The words arrive once the wave has passed them, not ahead of the cells they name. Hidden on
  // a view of its own: the fade-in owns its view's opacity.
  return (
    <View
      style={{ opacity: props.hidden ? 0 : 1 }}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Animated.View
        entering={FadeIn.delay(LABELS_AFTER_MS).duration(300)}
        className="relative h-8"
      >
        {labels}
      </Animated.View>
    </View>
  );
}

/** What the touched band holds, where the labels stand: the item under the finger, or its note. */
function bandDetail(
  layout: FieldLayout,
  focus: FieldFocus,
  warnBelow: number,
  systemNote: string,
): string {
  const band = layout.bands[focus.band];
  if (band === undefined) return "";
  const item = focus.item === null ? undefined : band.items[focus.item];
  if (item !== undefined) return `${item.name} · ${diskBytes(item.bytes)}`;
  if (focus.item !== null && focus.item >= band.items.length) {
    const rest = band.bytes - band.items.reduce((sum, each) => sum + each.bytes, 0);
    return `Everything else · ${diskBytes(rest)}`;
  }
  if (band.kind === "free") return `Turns amber under ${diskBytes(warnBelow)}.`;
  if (band.kind === "counting") return "Counted so far.";
  if (band.kind === "system") return systemNote;
  return band.items
    .slice(0, 3)
    .map((each) => `${each.name} ${diskBytes(each.bytes)}`)
    .join(" · ");
}

const sameFocus = (a: FieldFocus | null, b: FieldFocus | null) =>
  a?.band === b?.band && a?.item === b?.item;

/** The drive itself: a few SVG paths that rest when nothing moves. */
function DriveField(props: {
  readonly layout: FieldLayout;
  readonly colors: ReturnType<typeof useFieldTheme>["colors"];
  readonly tone: Rgb;
  readonly previewTone: Rgb;
  readonly warnTone: Rgb;
  readonly focus: FieldFocus | null;
  readonly preview: ReadonlyArray<FieldFinding> | null;
  readonly warnBelow: number;
  readonly label: string;
  readonly onFocus: (focus: FieldFocus | null) => void;
}) {
  const { layout, colors, tone, previewTone, warnTone, focus, preview, warnBelow, onFocus } = props;
  const reduced = useReducedMotion();
  const [groups, setGroups] = useState<ReadonlyArray<CellGroup>>([]);
  // Asks for no frame until it's handed figures, so making it in render starts nothing.
  const [picture] = useState(() => new FieldPicture(reduced, setGroups));
  const entered = useRef(false);
  const scrubbed = useRef<FieldFocus | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The picture's animation frames stop with the field.
  useEffect(() => () => picture.dispose(), [picture]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands new figures to the picture, which runs outside React.
  useEffect(() => {
    picture.update({ layout, colors, tone, entrance: !entered.current });
    entered.current = true;
  }, [picture, layout, colors, tone]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands what's lit to the picture, which runs outside React.
  useEffect(() => {
    picture.setFocus(focus);
  }, [picture, focus]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands what would come back to the picture, which runs outside React.
  useEffect(() => {
    picture.setHollow(preview === null ? new Set() : hollowCells(layout, preview), previewTone);
  }, [picture, preview, previewTone, layout]);

  const showsWarn = focus !== null && layout.bands[focus.band]?.kind === "free";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands the warning line to the picture, which runs outside React.
  useEffect(() => {
    picture.setWarn(showsWarn ? Math.max(1, Math.round(warnBelow / layout.unit)) : 0, warnTone);
  }, [picture, showsWarn, warnBelow, warnTone, layout]);

  const hit = (x: number, y: number) => {
    const cell = picture.cellAt(x, y);
    if (cell === null) return null;
    const bandIndex = layout.bandOf[cell.cell] ?? 0;
    const band = layout.bands[bandIndex];
    const item =
      band !== undefined && band.items.length > 0 ? (layout.itemOf[cell.cell] ?? 0) : null;
    return { cell, focus: { band: bandIndex, item } };
  };

  const scrub = useEffectEvent((x: number, y: number, starting: boolean) => {
    if (starting) scrubbed.current = focus;
    const found = hit(x, y);
    if (found === null) return;
    picture.setPointer({ col: found.cell.col, row: found.cell.row });
    if (sameFocus(scrubbed.current, found.focus)) return;
    if (scrubbed.current?.band !== found.focus.band) void Haptics.selectionAsync();
    scrubbed.current = found.focus;
    onFocus(found.focus);
  });
  const lift = useEffectEvent(() => picture.setPointer(null));
  // A tap holds a band until the same tap, or one on the headline, lets it go.
  const tapped = useEffectEvent((x: number, y: number) => {
    const found = hit(x, y);
    if (found === null || sameFocus(focus, found.focus)) {
      onFocus(null);
      return;
    }
    void Haptics.selectionAsync();
    onFocus(found.focus);
  });
  // Built once: the worklets plugin copies what a gesture's callbacks close over when it's built.
  // Sideways scrubs the field; up and down still scroll the page.
  const [gesture] = useState(() =>
    Gesture.Race(
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onStart((event) => scrub(event.x, event.y, true))
        .onUpdate((event) => scrub(event.x, event.y, false))
        .onFinalize(() => lift()),
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((event, success) => {
          if (success) tapped(event.x, event.y);
        }),
    ),
  );

  const width = layout.cols * layout.pitch;
  const height = layout.rows * layout.pitch;
  return (
    <GestureDetector gesture={gesture}>
      <View accessible accessibilityRole="image" accessibilityLabel={props.label}>
        <Svg width={width} height={height}>
          {groups.map((group) => (
            <Path
              key={group.key}
              d={group.d}
              fill={group.fill}
              fillOpacity={group.fillOpacity}
              stroke={group.stroke ?? undefined}
              strokeWidth={group.stroke === null ? 0 : 1.2}
            />
          ))}
        </Svg>
      </View>
    </GestureDetector>
  );
}

export function DriveHero(props: {
  readonly name: string;
  readonly free: number;
  readonly total: number;
  readonly warnBelow: number;
  readonly layout: FieldLayout | null;
  readonly fieldHeight: number;
  readonly systemNote: string;
  readonly focus: FieldFocus | null;
  readonly preview: ReadonlyArray<FieldFinding> | null;
  readonly onFocus: (focus: FieldFocus | null) => void;
}) {
  const { free, total, warnBelow, layout, focus, preview, onFocus } = props;
  const { colors, tones } = useFieldTheme();
  const added = preview?.reduce((sum, finding) => sum + finding.bytes, 0) ?? 0;
  const shownFree = free + added;
  const pressure = diskPressure(free, warnBelow);
  const shownPressure = diskPressure(shownFree, warnBelow);
  const statusColor = rgbCss(tones[shownPressure]);
  const touched = focus === null || layout === null ? undefined : layout.bands[focus.band];
  const band = touched?.kind === "free" ? undefined : touched;
  const label = `${diskBytes(free)} free of ${diskBytes(total)}.${
    layout === null
      ? ""
      : ` ${layout.bands
          .filter((each) => each.kind !== "free" && each.count > 0)
          .map((each) => `${each.title} ${diskBytes(each.bytes)}`)
          .join(", ")}.`
  }`;
  return (
    <View>
      <Pressable
        disabled={focus === null}
        accessible={focus !== null}
        accessibilityRole={focus === null ? undefined : "button"}
        onPress={() => onFocus(null)}
        accessibilityLabel={band === undefined ? undefined : `${band.title}. Show free space`}
      >
        {/* Stays mounted under a touched band, so the figure spins once, as the drive lands. */}
        <View
          style={{ opacity: band === undefined ? 1 : 0 }}
          accessibilityElementsHidden={band !== undefined}
          importantForAccessibility={band === undefined ? "auto" : "no-hide-descendants"}
        >
          <AppText className="text-sm" numberOfLines={1}>
            <AppText className="font-t3-semibold" style={{ color: statusColor }}>
              {statusWord(shownFree, warnBelow)}
            </AppText>
            <AppText className="text-foreground-muted">{`  ${props.name}`}</AppText>
          </AppText>
          <View className="mt-1 mb-3 flex-row flex-wrap items-baseline gap-x-2">
            <ShuffledFigure text={diskBytes(shownFree)} />
            <AppText
              className="text-sm text-foreground-muted"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              free of {diskBytes(total)}
              {added > 0 ? (
                <AppText className="font-t3-semibold" style={{ color: statusColor }}>
                  {`  +${diskBytes(added)}`}
                </AppText>
              ) : null}
            </AppText>
          </View>
        </View>
        {band === undefined ? null : (
          <View className="absolute inset-x-0 top-0">
            <View className="flex-row items-center gap-2">
              <View
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: rgbCss(bandColor(colors, band)) }}
              />
              <AppText
                className="shrink text-sm font-t3-semibold text-foreground"
                numberOfLines={1}
              >
                {band.title}
              </AppText>
              <AppText className="text-sm text-foreground-muted">
                {total > 0 ? `${Math.round((band.bytes / total) * 100)}%` : ""}
              </AppText>
            </View>
            <View className="mt-1 flex-row flex-wrap items-baseline gap-x-2">
              <AppText className="font-t3-semibold text-foreground" style={FIGURE}>
                {diskBytes(band.bytes)}
              </AppText>
              <AppText className="text-sm text-foreground-muted">of {diskBytes(total)}</AppText>
            </View>
          </View>
        )}
      </Pressable>
      <View style={{ minHeight: props.fieldHeight }}>
        {layout === null ? null : (
          <>
            <DriveField
              layout={layout}
              colors={colors}
              tone={tones[pressure]}
              previewTone={tones[shownPressure]}
              warnTone={tones.soon}
              focus={focus}
              preview={preview}
              warnBelow={warnBelow}
              label={label}
              onFocus={onFocus}
            />
            <View className="mt-1.5">
              <BandLabels layout={layout} hidden={focus !== null} />
              {focus === null ? null : (
                <AppText
                  className="absolute inset-x-0 top-0 text-xs text-foreground-muted"
                  numberOfLines={2}
                >
                  {bandDetail(layout, focus, warnBelow, props.systemNote)}
                </AppText>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
