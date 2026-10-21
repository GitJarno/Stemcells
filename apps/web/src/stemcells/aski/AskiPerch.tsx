import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

import type { CellRef } from "../tabs/layout";
import {
  chatCanvasOf,
  composerOverlayOf,
  observeResize,
  useChatStarted,
} from "../upstream/askiPerch";
import { AskiFigure } from "./AskiFigure";
import { AskiMoments } from "./moments/AskiMoments";
import "../tokens/stemcells.css";
import "./perch.css";

/**
 * Aski in its own chat, where the person speaks to it
 * (stemcells/tasks/aski-room.md, decision 10). It stands over the
 * composer, where a Cell's line stands in a Cell's pane. In a chat not yet
 * started it floats, whole, in the middle of the empty transcript; once the
 * chat has started it perches on the composer's edge at half its size, and
 * leans in while it answers. One figure in one theater: a pose is only a
 * transform, so the figure, its eyes and its moments never remount.
 */
export function AskiPerch(props: { aski: CellRef }) {
  const perch = useRef<HTMLDivElement>(null);
  const started = useChatStarted(props.aski);
  const rise = useRise(perch);
  // Until the chat is known it perches: an empty chat floats up when it is.
  const pose = started === false ? "afloat" : "perched";
  return (
    <div
      ref={perch}
      data-stemcells-aski-perch=""
      data-pose={pose}
      style={{ "--aski-rise": `${rise}px` } as CSSProperties}
    >
      <div data-aski-perch-stage="">
        <AskiMoments aski={props.aski}>
          <AskiFigure aski={props.aski} />
        </AskiMoments>
      </div>
    </div>
  );
}

/**
 * How far Aski rises from its perch to float in the middle of the empty
 * transcript: the room between the pane's band and the perch's foot, less
 * Aski's own height, halved. Read again as the chat or its composer
 * resizes: a longer draft lifts the perch, and Aski with it.
 */
function useRise(perch: { current: HTMLDivElement | null }): number {
  const [rise, setRise] = useState(0);
  useLayoutEffect(() => {
    const element = perch.current;
    const stage = element?.firstElementChild;
    const canvas = element ? chatCanvasOf(element) : null;
    const composer = element ? composerOverlayOf(element) : null;
    if (!element || !(stage instanceof HTMLElement) || !canvas || !composer) return;
    const measure = () => {
      const style = getComputedStyle(element);
      const px = (token: string) => Number.parseFloat(style.getPropertyValue(token)) || 0;
      // The pane's band (--sc-pane-band), from the plain tokens it is made of.
      const band = px("--sc-pane-button") + 2 * px("--sc-space-md");
      const foot = element.getBoundingClientRect().bottom;
      const room = foot - canvas.getBoundingClientRect().top - band;
      // The stage's own height: a transform doesn't change it.
      setRise(Math.max(0, Math.round((room - stage.offsetHeight) / 2)));
    };
    const stops = [canvas, composer].map((box) => observeResize(box, measure));
    return () => {
      for (const stop of stops) stop();
    };
  }, [perch]);
  return rise;
}
