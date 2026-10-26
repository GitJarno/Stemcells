// A Cell on the phone, as the Mac draws it (`apps/web/src/stemcells/cell/CellFigure.tsx`).
// Its box is the miniature's (13 × 14 cells), hats and all, so every Cell stands on the same
// line; its picture reaches past the box by the margin, taking no room.

import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import Animated, { useReducedMotion, ZoomIn, ZoomOut } from "react-native-reanimated";
import Svg, { ClipPath, Defs, G, Path, Text as SvgText } from "react-native-svg";

import { CODE_FONT, NEEDS_YOU, NOTCH } from "../tokens";
import { never, now, onBeat } from "./clock";
import { useComposed } from "./compose";
import { drawFrame, type Drawing, drawingOf } from "./figure";
import { formingAt } from "./forming";
import {
  type Activity,
  asksYou,
  BLOCKS,
  bodyOf,
  BOX,
  type CellScene,
  empty,
  frameShown,
  GLYPHS,
  type Ground,
  HOP,
  inBlocks,
  isBlinking,
  MARGIN,
  type MiniFrame,
  type Mood,
  sceneFor,
  sceneOf,
  wornLook,
} from "./kit";

/** The frames a Cell forms through: its box empty, its blocks, its hop; none when its kit has no hop. */
interface Formed {
  readonly before: MiniFrame;
  readonly blocks: readonly MiniFrame[];
  readonly hop: readonly MiniFrame[];
}

const formedByLook = new Map<string, Formed | null>();

function formedOf(worn: string): Formed | null {
  let formed = formedByLook.get(worn);
  if (formed !== undefined) return formed;
  const hop = sceneOf(wornLook(worn === "" ? [] : worn.split("+")), HOP)?.mini;
  const first = hop?.[0];
  formed =
    hop === undefined || first === undefined
      ? null
      : {
          before: empty(first),
          blocks: Array.from({ length: BLOCKS }, (_, step) => inBlocks(first, step)),
          hop,
        };
  formedByLook.set(worn, formed);
  return formed;
}

/** What a forming Cell shows at `seconds`: a frame of its forming, a glyph over its box, or nothing (it stands). */
function formingShown(
  formed: Formed | null,
  from: number | undefined,
  seconds: number | undefined,
): MiniFrame | string | undefined {
  if (formed === null || from === undefined || seconds === undefined) return undefined;
  const step = formingAt(seconds, from, formed.hop.length);
  if (step === undefined) return undefined;
  if (step.part === "empty") return formed.before;
  if (step.part === "glyphs") return GLYPHS[step.step]!;
  return step.part === "blocks" ? formed.blocks[step.step]! : formed.hop[step.step]!;
}

/** The frame a Cell shows at `seconds`: playing, its scene's; held, the first, its eyes shut while it blinks. */
function frameAt(
  scene: CellScene,
  name: string,
  seconds: number | undefined,
  plays: boolean,
  pleading: boolean,
): MiniFrame {
  if (plays || seconds === undefined) return frameShown(scene, name, seconds, pleading);
  const shut = scene.shut !== undefined && isBlinking(name, seconds, pleading);
  return (shut ? scene.shut! : scene).mini[0]!;
}

export function CellFigure(props: {
  /** Its chat's thread id: what it is called, when it blinks, what it wears when dealt alone. */
  readonly name: string;
  readonly mood: Mood;
  readonly activity?: Activity | undefined;
  /** Its provider's driver (`claudeAgent`, `codex`, …), whose colours it wears. */
  readonly provider?: string | null | undefined;
  /** What it was dealt with the others in view (`roster.ts`); bare until then. */
  readonly look?: readonly string[] | undefined;
  /** Points a cell of the miniature is drawn. */
  readonly points?: number | undefined;
  /** Acts out its scene; held still, it only blinks. */
  readonly plays?: boolean | undefined;
  readonly ground?: Ground | undefined;
  /** When its glyphs start, on the clock, as it forms (`forming.ts`); it just stands without. */
  readonly formingFrom?: number | undefined;
}) {
  const points = props.points ?? 2;
  const { name, mood, activity } = props;
  const worn = (props.look ?? []).join("+");
  const plays = props.plays ?? false;
  const pleading = asksYou(mood);
  const reduced = useReducedMotion();
  const look = wornLook(worn === "" ? [] : worn.split("+"));
  const forms = props.formingFrom !== undefined && !reduced;
  const ready = useComposed(`${worn}|${mood}|${activity ?? ""}|${forms}`, () => {
    sceneFor(look, mood, activity, 0);
    if (forms) formedOf(worn);
  });
  const shown = useSyncExternalStore(ready && !reduced ? onBeat : never, () => {
    if (!ready) return null;
    const seconds = reduced ? undefined : now();
    const forming = forms ? formingShown(formedOf(worn), props.formingFrom, seconds) : undefined;
    return (
      forming ??
      frameAt(
        sceneFor(look, mood, activity, plays ? (seconds ?? 0) : 0),
        name,
        seconds,
        plays,
        pleading,
      )
    );
  });
  const body = bodyOf(props.provider);
  const ground = props.ground ?? "black";
  const drawing =
    shown === null
      ? null
      : typeof shown === "string"
        ? outlineOf(formedOf(worn)!.hop[0]!, body)
        : drawFrame(shown, body, ground);
  const cell = points / 2;
  return (
    <View
      pointerEvents="none"
      style={{ width: BOX.width * points, height: BOX.height * points }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {drawing === null ? null : (
        <Svg
          width={drawing.width * cell}
          height={drawing.height * cell}
          viewBox={`0 0 ${drawing.width} ${drawing.height}`}
          style={{ position: "absolute", left: -MARGIN.x * points, top: -MARGIN.y * points }}
        >
          {typeof shown === "string" ? (
            <Glyphs glyph={shown} drawing={drawing} />
          ) : (
            drawing.inks.map((ink) => (
              <Path
                key={`${ink.fill}${ink.opacity}`}
                d={ink.d}
                fill={ink.fill}
                fillOpacity={ink.opacity}
              />
            ))
          )}
        </Svg>
      )}
      {pleading && typeof shown !== "string" ? <AskMark points={points} /> : null}
    </View>
  );
}

/** Rows of glyphs over a forming Cell's box, as the Mac draws them. */
const GLYPH_ROWS = 3;

const outlines = new Map<string, Drawing>();

/** `frame`'s outline filled with its body's own colour, for the glyphs to condense in. */
function outlineOf(frame: MiniFrame, body: string): Drawing {
  const key = `${body}\n${frame.drawn.detail.join("\n")}`;
  let drawing = outlines.get(key);
  if (drawing === undefined) {
    drawing = drawingOf(
      frame.drawn.detail.map((row) => row.replaceAll(/[^.]/g, "B")),
      body,
    );
    outlines.set(key, drawing);
  }
  return drawing;
}

/** Rows of `glyph` over the Cell's outline in its body's ink: Aski's characters condensing into it. */
function Glyphs(props: { readonly glyph: string; readonly drawing: Drawing }) {
  const { width, height, inks } = props.drawing;
  const ink = inks[0];
  if (ink === undefined) return null;
  const size = height / GLYPH_ROWS;
  const columns = Math.ceil(width / (size * 0.6));
  return (
    <>
      <Defs>
        <ClipPath id="forming">
          <Path d={ink.d} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#forming)">
        {Array.from({ length: GLYPH_ROWS }, (_, row) => (
          <SvgText
            key={row}
            x={0}
            y={(row + 0.85) * size}
            fontSize={size}
            fontFamily={CODE_FONT}
            fontWeight="700"
            fill={ink.fill}
          >
            {props.glyph.repeat(columns)}
          </SvgText>
        ))}
      </G>
    </>
  );
}

/** The "?" over a Cell that waits on you, off its top corner, measured in its pixels. */
function AskMark(props: { readonly points: number }) {
  const pixel = props.points;
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(14)}
      exiting={ZoomOut.duration(160)}
      style={{
        position: "absolute",
        top: pixel * -3,
        right: pixel * -2.5,
        paddingHorizontal: pixel * 1.6,
        paddingVertical: pixel * 0.4,
        borderRadius: pixel * 1.8,
        backgroundColor: NEEDS_YOU,
        shadowColor: NEEDS_YOU,
        shadowOpacity: 0.55,
        shadowRadius: pixel * 2.5,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: NOTCH,
          fontFamily: CODE_FONT,
          fontWeight: "800",
          fontSize: pixel * 5.5,
          lineHeight: pixel * 6.5,
        }}
      >
        ?
      </Text>
    </Animated.View>
  );
}
