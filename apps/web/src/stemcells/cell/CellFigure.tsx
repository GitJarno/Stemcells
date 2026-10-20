/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// A Cell's character, drawn pixel for pixel from the look data in its
// provider's hue, wearing what it was dealt, with the "?" over it while it
// waits on you. Its activity rides on it as data (`data-activity`,
// `data-action`, `data-prop`) for what acts it out.

import { type CSSProperties, useState } from "react";
import { acting, type Activity } from "./activity.ts";
import { AskMark } from "./AskMark.tsx";
import { moodOf, POINTS_PER_PIXEL, path, SIZE, wornPaths } from "./look.ts";
import { dayOf, looksOf } from "./looks.ts";
import "../tokens/stemcells.css";
import "./cell.css";

/** What a Cell named `name` wears on `day` when dealt alone: its own first piece of each theme worn. */
export function lookOf(name: string, day: string): readonly string[] {
  return looksOf([name], day).get(name)?.worn ?? [];
}

/**
 * A Cell's character in its mood. It wears `look` (`theme/piece` ids, dealt
 * over the whole roster so no two wear one piece) when given; otherwise the
 * look its name is dealt alone, on the day it was first drawn, kept while it
 * stays on screen. The pieces may rise above the body and reach past its
 * sides: they draw outside the character's box, which stays the body's size.
 */
export function CellFigure(props: {
  readonly name: string;
  readonly mood: string;
  readonly activity?: Activity | undefined;
  /** Its provider's hue as a CSS colour; absent, the interface ink. */
  readonly hue?: string | undefined;
  readonly look?: readonly string[] | undefined;
  /** Points a pixel of the look is drawn; a whole number keeps its edges on device pixels. */
  readonly points?: number | undefined;
}) {
  const [day] = useState(() => dayOf(new Date()));
  const mood = moodOf(props.mood);
  const worn = wornPaths(props.look ?? lookOf(props.name, day));
  const points = props.points ?? POINTS_PER_PIXEL;
  const act = props.activity === undefined ? undefined : acting(props.activity);
  const hue = props.hue === undefined ? undefined : ({ "--hue": props.hue } as CSSProperties);
  return (
    <span
      className="cell-figure"
      data-mood={mood}
      data-activity={props.activity}
      data-action={act?.action}
      data-prop={act?.prop}
    >
      <svg
        className="character"
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        width={SIZE.width * points}
        height={SIZE.height * points}
        overflow="visible"
        aria-hidden="true"
        style={hue}
      >
        <path d={path(mood)} />
        {worn.map(([ink, d]) => (
          <path key={ink} d={d} fill={ink} />
        ))}
      </svg>
      <AskMark active={mood === "needsYou"} pixel={points} />
    </span>
  );
}
