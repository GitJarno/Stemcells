// A Cell on the phone, as the Mac draws it (`apps/web/src/stemcells/cell/CellFigure.tsx`).
// Its box is the miniature's (13 × 14 cells), hats and all, so every Cell stands on the same
// line; its picture reaches past the box by the margin, taking no room.

import { memo, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { ClipPath, Defs, G, Path, Text as SvgText } from "react-native-svg";

import { CODE_FONT } from "../tokens";
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
  clockSeconds,
  empty,
  type Entrance,
  entering,
  frameFor,
  GLYPHS,
  type Ground,
  HOP,
  inBlocks,
  isBlinking,
  mannerOf,
  MARGIN,
  type MiniFrame,
  type Mood,
  performing,
  prepare,
  sceneFor,
  sceneOf,
  stand,
  standingOf,
  wornLook,
} from "./kit";

/** A look composed and drawn: what a Cell wears, its mood and act, and whether it forms. */
interface Standing {
  readonly key: string;
  readonly worn: string;
  readonly mood: Mood;
  readonly activity: Activity | undefined;
  readonly forms: boolean;
}

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

/** Whose picture it last was, where that Cell stood as drawn, and the moment it entered that with. */
interface Stood {
  readonly name: string;
  readonly mood: Mood;
  readonly working: boolean;
  readonly entrance: Entrance | undefined;
}

/** The frame a Cell held still shows at `seconds`: its scene's first, its eyes shut while it blinks on its own cadence. */
function heldAt(
  scene: CellScene,
  name: string,
  seconds: number | undefined,
  pleading: boolean,
): MiniFrame {
  const shut =
    seconds !== undefined &&
    scene.shut !== undefined &&
    isBlinking(name, seconds, pleading, mannerOf(name).blink);
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
  /** Out of sight (the home under a chat), or one of several in a row: it stands on its first frame and reads no clock. */
  readonly held?: boolean | undefined;
  readonly ground?: Ground | undefined;
  /** When its glyphs start, on the clock, as it forms (`forming.ts`); it just stands without. */
  readonly formingFrom?: number | undefined;
  /** When its last turn landed (ms since the epoch): a cheer seen as it happens plays from its first frame. */
  readonly landedAt?: number | undefined;
  /** It waits for the person's check: its forming's first blocks, held, until it forms on (`home/PlannedRows.tsx`). */
  readonly outline?: boolean | undefined;
}) {
  const points = props.points ?? 2;
  const { name, mood, activity } = props;
  const worn = (props.look ?? []).join("+");
  const plays = props.plays ?? false;
  const reduced = useReducedMotion();
  const still = reduced || props.held === true;
  const outline = props.outline === true;
  const forms = outline || (props.formingFrom !== undefined && !reduced);
  const key = `${worn}|${mood}|${activity ?? ""}|${forms}|${plays ? mannerOf(name).id : ""}`;
  const ready = useComposed(key, () => {
    const look = wornLook(worn === "" ? [] : worn.split("+"));
    sceneFor(look, mood, activity, 0);
    if (plays) prepare(look, { name, mood, activity });
    if (forms) formedOf(worn);
  });
  // The last look composed stands while the next one composes: a Cell
  // turning to a new mood or act no longer drops out for a frame or more.
  const [standing, setStanding] = useState<Standing | null>(null);
  if (ready && standing?.key !== key) setStanding({ key, worn, mood, activity, forms });
  const drawn: Standing | null = ready ? { key, worn, mood, activity, forms } : standing;
  const look = drawn === null ? null : wornLook(drawn.worn === "" ? [] : drawn.worn.split("+"));
  // The stance it enters is kept from the render that first draws it, as React asks of a value
  // derived from the one before: a move starts once its frames are composed, not while they are.
  const [stood, setStood] = useState<Stood | null>(null);
  const working = drawn?.activity !== undefined;
  if (
    drawn !== null &&
    (stood?.name !== name || stood.mood !== drawn.mood || stood.working !== working)
  ) {
    const before = stood?.name === name ? stood : undefined;
    // Where it stands, for a poke to be answered in (`acting.ts`).
    stand(name, drawn.mood, working);
    const moment = entering(
      name,
      before,
      { mood: drawn.mood, working },
      now(),
      props.landedAt === undefined ? undefined : clockSeconds(props.landedAt),
    );
    setStood({ name, mood: drawn.mood, working, entrance: moment ?? before?.entrance });
  }
  const entrance = stood?.name === name ? stood.entrance : undefined;
  const shown = useSyncExternalStore(drawn !== null && !still ? onBeat : never, () => {
    if (drawn === null || look === null) return null;
    const seconds = still ? undefined : now();
    const formed = drawn.forms ? formedOf(drawn.worn) : null;
    if (outline && formed !== null) return formed.blocks[0]!;
    const forming = formingShown(formed, props.formingFrom, seconds);
    if (forming !== undefined) return forming;
    // A poke is answered wherever the Cell is drawn, playing or held still.
    const poked =
      seconds !== undefined &&
      performing(name, seconds, standingOf(drawn.mood, drawn.activity !== undefined)) !== undefined;
    return plays || poked
      ? frameFor(look, { name, mood: drawn.mood, activity: drawn.activity, entrance }, seconds)
      : heldAt(sceneFor(look, drawn.mood, drawn.activity, 0), name, seconds, asksYou(drawn.mood));
  });
  const body = bodyOf(props.provider);
  const ground = props.ground ?? "black";
  const drawing =
    shown === null
      ? null
      : typeof shown === "string"
        ? outlineOf(formedOf(drawn!.worn)!.hop[0]!, body)
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
              <Ink
                key={`${ink.fill}${ink.opacity}`}
                d={ink.d}
                fill={ink.fill}
                opacity={ink.opacity}
              />
            ))
          )}
        </Svg>
      )}
    </View>
  );
}

/** One ink of a frame. A beat moves two or three of a Cell's dozen; the rest keep their path and draw nothing. */
const Ink = memo(function Ink(props: {
  readonly d: string;
  readonly fill: string;
  readonly opacity: number;
}) {
  return <Path d={props.d} fill={props.fill} fillOpacity={props.opacity} />;
});

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
