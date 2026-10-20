/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// The "?" over a Cell that waits on you: one mark that rides any Cell at
// any size, measured in its sprite pixels.

import type { CSSProperties } from "react";
import { cssLinear, settledDuration, type Spring } from "../tokens/spring.ts";
import "../tokens/stemcells.css";
import "./cell.css";

/** How the mark comes and goes: a quick spring with a little overshoot. */
const ARRIVE: Spring = { response: 0.3, damping: 0.7 };
const ARRIVE_DURATION = `${Math.round(settledDuration(ARRIVE) * 1000)}ms`;
const ARRIVE_EASING = cssLinear(ARRIVE);

export function AskMark(props: {
  /** Whether the Cell waits on you; the mark stays mounted so it can leave as it came. */
  readonly active: boolean;
  /** Points a sprite pixel is drawn. */
  readonly pixel: number;
}) {
  const style = {
    "--ask-pixel": `${props.pixel}px`,
    "--ask-arrive-duration": ARRIVE_DURATION,
    "--ask-arrive-easing": ARRIVE_EASING,
  } as CSSProperties;
  return (
    <span className="ask-mark" data-active={props.active} aria-hidden="true" style={style}>
      ?
    </span>
  );
}
