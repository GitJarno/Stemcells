// A Cell drawn from its model on the phone, in the box and on the grid `CellFigure` keeps: a
// picture as tall as the hero art, so a pixel of it is a pixel of the old Cell. Its pose is
// stepped on the beat, and a picture is taken only when it has moved half a pixel, as the
// Mac's (`apps/web/src/stemcells/cell/CellModelFigure.tsx`).

import { useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { now, onBeat } from "./clock";
import { type Drawing, drawingOfSprite } from "./figure";
import {
  type Act,
  actOf,
  type Activity,
  bodyOf,
  BOX,
  drawSprite,
  figureOf,
  grownOf,
  hueOfBody,
  type Layer,
  MARGIN,
  type Mood,
  moved,
  performerOf,
  type Pose,
  poseAt,
  roomOver,
  seedOf,
  STILL,
  type SpriteView,
  tallerView,
  wear,
  wholeView,
  wornLayers,
} from "./kit";

/** The phone reads no Cell's strength yet (`growth.ts`): each is drawn as it is born. */
const GROWN = grownOf(undefined);

/** Two pixels to a cell of the miniature, margin and all: the hero art's own grid. */
const VIEW = wholeView(
  GROWN,
  (BOX.height + MARGIN.y * 2) * 2,
  0.45,
  (BOX.width + MARGIN.x * 2) * 2,
);

/** What a look has on and the picture it needs: taller than `VIEW` by the room its headwear takes. */
interface Dress {
  readonly layers: readonly Layer[];
  readonly view: SpriteView;
}

const dresses = new Map<string, Dress>();

/** `look`'s pieces (its ids joined by `+`), found once. */
function dressOf(look: string): Dress {
  const known = dresses.get(look);
  if (known !== undefined) return known;
  const layers = wornLayers(look === "" ? [] : look.split("+"));
  const over = roomOver(figureOf(poseAt("rest", STILL.rest, GROWN)), VIEW, layers);
  const dress = { layers, view: over === 0 ? VIEW : tallerView(VIEW, over) };
  dresses.set(look, dress);
  return dress;
}

function pictureOf(pose: Pose, body: string, look: string): Drawing {
  const { layers, view } = dressOf(look);
  const figure = figureOf(pose);
  return drawingOfSprite(
    wear(drawSprite(figure, view, hueOfBody(body)), figure, view, layers, body),
  );
}

const stills = new Map<string, Drawing>();

/** An act's telling pose on a body in a look: what a Cell held still shows, drawn once. */
function stillOf(act: Act, body: string, look: string): Drawing {
  const key = `${act}|${body}|${look}`;
  let drawing = stills.get(key);
  if (drawing === undefined) {
    drawing = pictureOf(poseAt(act, STILL[act], GROWN), body, look);
    stills.set(key, drawing);
  }
  return drawing;
}

export function CellModelFigure(props: {
  /** Its chat's thread id: when it breathes and blinks. */
  readonly name: string;
  readonly mood: Mood;
  readonly activity?: Activity | undefined;
  /** Its provider's driver, whose colour it wears. */
  readonly provider?: string | null | undefined;
  /** What it wears, as the drawn Cell does (`roster.ts`): the same pieces, on this body. */
  readonly look?: readonly string[] | undefined;
  /** Points a cell of the miniature is drawn. */
  readonly points?: number | undefined;
  /** Out of sight: it stands in its act's telling pose and reads no clock. */
  readonly held?: boolean | undefined;
}) {
  const { name } = props;
  const points = props.points ?? 2;
  const act = actOf(props.mood, props.activity);
  const body = bodyOf(props.provider);
  const look = (props.look ?? []).join("+");
  const still = useReducedMotion() || props.held === true;
  /** The body playing, kept while it is the same Cell, and the act it was last given. */
  const playing = useRef<{
    readonly of: string;
    readonly performer: ReturnType<typeof performerOf>;
    act: Act | undefined;
  }>(undefined);
  const [moving, setMoving] = useState<Drawing | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Step the model on each beat of the Cells' clock and keep its newest picture, unsubscribing when what it plays changes.
  useLayoutEffect(() => {
    if (still) return;
    if (playing.current?.of !== name)
      playing.current = { of: name, performer: performerOf(GROWN, seedOf(name)), act: undefined };
    const cell = playing.current;
    let last: number | undefined;
    let shown: Pose | undefined;
    const beat = () => {
      const at = now() * 1000;
      if (cell.act !== act) {
        cell.performer.play(act, at);
        cell.act = act;
      }
      const pose = cell.performer.step(
        at,
        last === undefined ? 1 / 12 : Math.min(0.25, (at - last) / 1000),
      );
      last = at;
      if (shown !== undefined && !moved(shown, pose, VIEW.span / VIEW.rows)) return;
      shown = pose;
      setMoving(pictureOf(pose, body, look));
    };
    beat();
    return onBeat(beat);
  }, [name, act, body, look, still]);
  const drawing = still ? stillOf(act, body, look) : moving;
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
          style={{
            position: "absolute",
            left: -MARGIN.x * points,
            // A picture taller than the box's (headwear's room) stands as far over it.
            top: -MARGIN.y * points - (drawing.height - VIEW.rows) * cell,
          }}
        >
          {drawing.inks.map((ink) => (
            <Path
              key={`${ink.fill}${ink.opacity}`}
              d={ink.d}
              fill={ink.fill}
              fillOpacity={ink.opacity}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}
