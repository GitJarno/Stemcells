/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (glow.css), outside upstream's Tailwind entry. */
import { use, useLayoutEffect, useRef } from "react";

import { channels } from "../aski/stage/colour";
import { PaneCellContext } from "../tabs/paneCell";
import { sweep } from "../motion/beat";
import { reducedMotion } from "../tokens/motion";
import { useCellDriver } from "../upstream/providers";
import { rgba, SHEEN_BAND, SHEEN_CORE, sheenTone, toneTokenOf } from "./light";
import "../tokens/stemcells.css";
import "./glow.css";

/**
 * The working row's word, lit by the chat's own wave: a soft band of
 * brighter ink crosses it on the composer's beat, the same pass, rest,
 * curve and wall clock as the band crossing the glass, so the word and the
 * glass light up as one wave and nothing else in the row moves. One band
 * crosses the whole window; each word shows the stretch of it over itself.
 * The band is the chat's provider's colour, as the glass's light is, lifted
 * to at least the interface ink's lightness so it is always a light over the
 * word, never a shade. Under reduced motion the word holds its ink.
 *
 * The light is a copy of the word seen through a moving window: the window
 * slides and the copy slides back under it, so the glyphs stay put and only
 * transforms move.
 */
export function WorkingSheen(props: { readonly children: string }) {
  const tone = toneTokenOf(useCellDriver(use(PaneCellContext)));
  const wordRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const word = wordRef.current;
    if (word === null) return;
    const lens = word.querySelector<HTMLElement>(".sheen-window")!;
    const glyphs = word.querySelector<HTMLElement>(".sheen-glyphs")!;
    let crossing: Animation[] = [];
    const cross = () => {
      for (const animation of crossing) animation.cancel();
      crossing = [];
      const style = getComputedStyle(word);
      const lifted = sheenTone(
        channels(style.getPropertyValue(tone)).rgb,
        channels(style.getPropertyValue("--sc-soft")).rgb,
      );
      glyphs.style.color = rgba(lifted, SHEEN_CORE);
      lens.style.width = `${SHEEN_BAND}px`;
      if (reducedMotion()) return;
      // One band crosses the window, from clear of its left edge to clear
      // of its right; the window slides with it, the copy against it.
      const x = word.getBoundingClientRect().left;
      const from = -SHEEN_BAND - x;
      const to = document.documentElement.clientWidth - x;
      crossing = [sweep(lens, from, to), sweep(glyphs, -from, -to)];
    };
    cross();
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The place goes to the sheen's animations, never into React state.
    const sized = new ResizeObserver(cross);
    sized.observe(word);
    addEventListener("resize", cross);
    const skinned = new MutationObserver(cross);
    skinned.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-skin", "data-device", "data-theme-id", "class", "style"],
    });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", cross);
    return () => {
      sized.disconnect();
      removeEventListener("resize", cross);
      skinned.disconnect();
      motion.removeEventListener("change", cross);
      for (const animation of crossing) animation.cancel();
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
