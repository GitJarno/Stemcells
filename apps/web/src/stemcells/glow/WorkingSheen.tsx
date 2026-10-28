/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (glow.css), outside upstream's Tailwind entry. */
import { use, useLayoutEffect, useRef } from "react";

import { channels } from "../aski/stage/colour";
import { PaneCellContext } from "../tabs/paneCell";
import { crossing, paneOf, resweep, standing, sweep } from "../motion/beat";
import { type Sight, watchSight } from "../motion/sight";
import { reducedMotion } from "../tokens/motion";
import { useCellDriver } from "../upstream/providers";
import { rgba, SHEEN_BAND, SHEEN_CORE, sheenTone, toneTokenOf } from "./light";
import "../tokens/stemcells.css";
import "./glow.css";

/**
 * The working row's word, lit by the pane's one wave: a band of the provider's colour (at least
 * the ink's lightness, so it is never a shade) crosses it on the glass's clock (`motion/beat.ts`).
 * The light is a copy of the word under a sliding window, so only transforms move; a resize
 * re-aims the slide in flight. It holds unseen or with reduced motion (`motion/sight.ts`).
 */
export function WorkingSheen(props: { readonly children: string }) {
  const tone = toneTokenOf(useCellDriver(use(PaneCellContext)));
  const wordRef = useRef<HTMLSpanElement>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Own the sheen's crossing animations and its resize, theme, motion and sight watchers.
  useLayoutEffect(() => {
    const word = wordRef.current;
    if (word === null) return;
    const lens = word.querySelector<HTMLElement>(".sheen-window")!;
    const glyphs = word.querySelector<HTMLElement>(".sheen-glyphs")!;
    lens.style.width = `${SHEEN_BAND}px`;
    let crossings: Animation[] = [];
    let sight: Sight = "focused";
    const recolour = () => {
      const style = getComputedStyle(word);
      const lifted = sheenTone(
        channels(style.getPropertyValue(tone)).rgb,
        channels(style.getPropertyValue("--sc-soft")).rgb,
      );
      glyphs.style.color = rgba(lifted, SHEEN_CORE);
    };
    const aim = () => {
      if (reducedMotion() || sight === "hidden") {
        for (const animation of crossings) animation.cancel();
        crossings = [];
        return;
      }
      // The window's middle rides the pane's crest; the copy slides against it.
      const { left, width } = standing(word);
      const { from, to } = crossing(width, left, SHEEN_BAND / 2);
      const stepped = sight === "unfocused";
      const [sliding, copy] = crossings;
      if (sliding && copy) {
        resweep(sliding, from, to, "", stepped);
        resweep(copy, -from, -to, "", stepped);
      } else {
        crossings = [sweep(lens, from, to, "", stepped), sweep(glyphs, -from, -to, "", stepped)];
      }
    };
    recolour();
    aim();
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The place goes to the sheen's animations, never into React state.
    const sized = new ResizeObserver(aim);
    sized.observe(word);
    sized.observe(paneOf(word));
    const skinned = new MutationObserver(recolour);
    skinned.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-skin", "data-device", "data-theme-id", "class", "style"],
    });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", aim);
    const unwatch = watchSight(word, (now) => {
      sight = now;
      aim();
    });
    return () => {
      sized.disconnect();
      skinned.disconnect();
      motion.removeEventListener("change", aim);
      unwatch();
      for (const animation of crossings) animation.cancel();
    };
  }, [tone]);

  return (
    <span ref={wordRef} className="working-sheen">
      {props.children}
      <span className="sheen-clip" aria-hidden="true">
        <span className="sheen-window">
          <span className="sheen-glyphs">{props.children}</span>
        </span>
      </span>
    </span>
  );
}
