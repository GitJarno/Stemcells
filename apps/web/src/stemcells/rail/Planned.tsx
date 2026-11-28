/**
 * What a planned row adds to a Cell's line in Awake (aski-orchestrator.md, decision 12): its birth
 * words, the Cell condensing in its box, and the line settling out of glyphs on the Cells' beat.
 * A text step swaps one attribute that CSS draws over the words: no layout, React's text untouched.
 */
import { type RefObject, useLayoutEffect, useRef } from "react";

import {
  ARRIVAL_BEAT_MS,
  ARRIVALS,
  chipWords,
  DECODE_STEPS,
  decodeAt,
} from "../../../../../stemcells/aski/arrivals.ts";
import { cellNameOf } from "../cell/name";
import { cssEasing, LIST_MOTION } from "../motion/listMotion";
import { reducedMotion } from "../tokens/motion";
import { glyphsIn } from "../words/spawn/play";
import type { Arrival } from "./arrivals";

/** A planned row's name and its model, between its project's mark and its title. */
export function BirthWords(props: { arrival: Arrival }) {
  const { row } = props.arrival;
  const model = row.modelName;
  const effort = chipWords(row).slice(model.length);
  return (
    <span data-cells-birth="" data-leaving={props.arrival.state === "fading" ? "" : undefined}>
      <span data-cells-birth-name="" data-settle="">
        {cellNameOf(row.threadId)}
      </span>
      {model === "" ? null : (
        <span data-cells-birth-chip="">
          <span data-settle="">{model}</span>
          {effort === "" ? null : (
            <span data-cells-birth-effort="" data-settle="">
              {effort}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Settles `line`'s words from `from`, a `performance.now()` time: every `[data-settle]` in it, in
 * reading order, shows `decodeAt`'s text for the step due (cells.css draws `data-settling` over
 * the words), and is its own words again once settled. A line that comes late joins at the step
 * due then. Returns what stops it.
 */
function settleLine(line: HTMLElement, from: number): () => void {
  const parts = [...line.querySelectorAll<HTMLElement>("[data-settle]")];
  // A part with words of its own settles to them; one without (a mark) stands for a character.
  const words = parts.map((part) => part.dataset.settle || part.textContent || "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    for (const part of parts) delete part.dataset.settling;
    delete line.dataset.settlingLine;
  };
  const step = () => {
    const at = Math.floor((performance.now() - from) / ARRIVAL_BEAT_MS);
    if (at >= DECODE_STEPS) return clear();
    const shown = at < 0 ? null : decodeAt(words, at);
    parts.forEach((part, index) => {
      const now = shown?.[index];
      if (now !== undefined && now.settled === words[index]!.length) delete part.dataset.settling;
      else part.dataset.settling = now?.text ?? "";
    });
    timer = setTimeout(step, Math.max(0, from + (at + 1) * ARRIVAL_BEAT_MS - performance.now()));
  };
  line.dataset.settlingLine = "";
  step();
  return () => {
    clearTimeout(timer);
    clear();
  };
}

/**
 * Plays a planned row's arrival in `line` once, as it first shows: its Cell's glyphs in the Cell's
 * box and its line's settle, both counted in beats from when it landed. A row seen later, or
 * under Reduce Motion, just stands.
 */
export function useArrivalPlays(line: RefObject<HTMLElement | null>, arrival: Arrival | null) {
  const at = arrival?.forms ? arrival.at : undefined;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Start the row's one-shot arrival on its DOM as it mounts, before paint, and stop it if the row goes first.
  useLayoutEffect(() => {
    const element = line.current;
    if (element === null || at === undefined || reducedMotion()) return;
    const box = element.querySelector<HTMLElement>("[data-cells-row-cell]");
    if (box) void glyphsIn(box, at);
    return settleLine(element, at + ARRIVALS.settles * ARRIVAL_BEAT_MS);
  }, [line, at]);
}

const MOVE = { duration: LIST_MOTION.move.duration, easing: cssEasing(LIST_MOTION.move.easing) };

/**
 * The title takes the birth words' place as they go: it glides from where it stood to where it
 * stands now, the lists' move. `born` is whether the line holds birth words.
 */
export function useTitleGlide(title: RefObject<HTMLElement | null>, born: boolean) {
  const was = useRef<{ born: boolean; left: number } | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the title's place after each layout and glide it from its last place when the birth words left, before paint.
  useLayoutEffect(() => {
    const element = title.current;
    if (element === null) return;
    const left = element.offsetLeft;
    const before = was.current;
    was.current = { born, left };
    if (before === null || !before.born || born || before.left === left || reducedMotion()) return;
    element.animate([{ translate: `${before.left - left}px 0` }, { translate: "0 0" }], MOVE);
  });
}
