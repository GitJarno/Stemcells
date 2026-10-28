/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (glow.css), outside upstream's Tailwind entry. */
import { use, useLayoutEffect, useRef } from "react";

import { channels, groundOf, inkOf } from "../aski/stage/colour";
import { path, SIZE } from "../cell/look";
import { scrollThrough } from "../composer/scrollThrough";
import { paneOf, standing } from "../motion/beat";
import { watchSight } from "../motion/sight";
import { PaneCellContext } from "../tabs/paneCell";
import { reducedMotion } from "../tokens/motion";
import { ProviderLogo } from "../upstream/providers";
import { useCellStatus } from "../upstream/status";
import {
  type Glow,
  glowOf,
  IMPRINT_OVERHANG,
  imprintShows,
  imprintSide,
  luminanceOf,
  type Point,
  toneTokenOf,
} from "./light";
import { type GlassInk, GlassLight } from "./motion";
import "../tokens/stemcells.css";
import "./glow.css";
import "./veil.css";

/**
 * Where upstream's send button stands when the composer shows none: its
 * centre this far in from the glass's corner, its far edge this far.
 */
const SEND_INSET = 32;
const SEND_REACH = 48;

/**
 * A Cell's composer shows what the Cell is doing on its glass: its provider's light while it
 * works, on the pane's beat (`motion/beat.ts`); a warm breath while blocked on you; a bloom at
 * the send button on your turn. The words set the band's strength, so they keep their ink
 * (`light.ts`). Unseen or with reduced motion it holds still; beside another app it steps.
 */
export function CellComposerGlass(props: { readonly provider: string }) {
  const cell = use(PaneCellContext);
  const glow = glowOf(useCellStatus(cell));
  const tone = toneTokenOf(props.provider);
  const rootRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<GlassLight | null>(null);
  const latest = useRef<{ glow: Glow; tone: string }>({ glow, tone });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Push the latest glow and tone into the imperative glass light before paint.
  useLayoutEffect(() => {
    latest.current = { glow, tone };
    const root = rootRef.current;
    const light = lightRef.current;
    if (root === null || light === null) return;
    place(root, light);
    light.configure(glow, paletteOf(root, tone), reducedMotion());
  }, [glow, tone]);

  // The composer floats over the transcript, in every pane of ours: a wheel
  // over it scrolls the chat (`scrollThrough`).
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Pass wheels over the floating composer to the transcript, detaching on unmount.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const composer = root?.closest<HTMLElement>('[data-chat-composer-stack="true"]');
    if (!root?.closest("[data-stemcells-pane]") || !composer) return;
    return scrollThrough(composer);
  }, []);

  const hasCell = cell !== null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Own the glass light's animations and its resize, theme, motion and sight watchers for a Cell.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!hasCell || root === null) return;
    const light = new GlassLight(partsOf(root));
    lightRef.current = light;
    place(root, light);
    light.configure(
      latest.current.glow,
      paletteOf(root, latest.current.tone),
      reducedMotion(),
      true,
    );
    const restyle = () =>
      light.configure(latest.current.glow, paletteOf(root, latest.current.tone), reducedMotion());
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The size goes to the light's animations, never into React state.
    const sized = new ResizeObserver(() => place(root, light));
    sized.observe(root);
    // The wave crosses the pane: a pane that changes width moves its crest's path.
    sized.observe(paneOf(root));
    // A skin or theme change re-colours the light; the root's attributes
    // say when (a theme sets its id, the dark class and its palette).
    const skinned = new MutationObserver(restyle);
    skinned.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-skin", "data-device", "data-theme-id", "class", "style"],
    });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", restyle);
    // A glass no one can see holds; one beside another app steps.
    const unwatch = watchSight(root, (sight) => light.see(sight));
    return () => {
      sized.disconnect();
      skinned.disconnect();
      motion.removeEventListener("change", restyle);
      unwatch();
      light.stop();
      lightRef.current = null;
    };
  }, [hasCell]);

  // Every composer in a pane of ours holds the layer (it anchors the
  // scroll-through); a Cell's also holds its light and its provider's mark.
  if (!hasCell) return <div ref={rootRef} data-stemcells-composer-glass="" aria-hidden="true" />;
  return (
    <div ref={rootRef} data-stemcells-composer-glass="" aria-hidden="true">
      {/* Under the light, which washes over it while the Cell works. */}
      <span className="glass-imprint">
        <ProviderLogo
          driver={props.provider}
          fallback={
            <svg viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} fill="currentColor">
              <path d={path("awake")} />
            </svg>
          }
        />
      </span>
      <div className="glass-light">
        <div className="glass-lit">
          <div className="glass-wash">
            <div className="glass-wash-near" />
            <div className="glass-wash-far" />
          </div>
          <div className="glass-band" />
        </div>
        <div className="glass-bloom" />
      </div>
    </div>
  );
}

function partsOf(root: HTMLElement) {
  const part = (name: string) => root.querySelector<HTMLElement>(`.glass-${name}`)!;
  return {
    light: part("light"),
    lit: part("lit"),
    wash: part("wash"),
    near: part("wash-near"),
    far: part("wash-far"),
    band: part("band"),
    bloom: part("bloom"),
  };
}

/**
 * The glass's size and its send button: the light comes from and gathers to
 * the button's centre, and the mark stays clear of its far edge. The button
 * is the last in the composer's trailing actions (send, stop or resume); a
 * composer showing none (an approval) takes the corner it stands in.
 */
function place(root: HTMLElement, light: GlassLight) {
  const box = root.getBoundingClientRect();
  const size = { width: box.width, height: box.height };
  const buttons = root.parentElement?.querySelectorAll<HTMLElement>(
    '[data-chat-composer-actions="right"] button',
  );
  const send = buttons?.[buttons.length - 1]?.getBoundingClientRect();
  let anchor: Point = { x: size.width - SEND_INSET, y: size.height - SEND_INSET };
  let clearing = SEND_REACH;
  if (send !== undefined && send.width > 0) {
    anchor = { x: send.left + send.width / 2 - box.left, y: send.top + send.height / 2 - box.top };
    clearing = Math.max(box.right - send.left, box.bottom - send.top);
  }
  const inset = (size.width - anchor.x + size.height - anchor.y) / 2;
  light.layout(size, anchor, inset, standing(root));
  const side = imprintSide(size);
  root.style.setProperty("--imprint-side", `${side}px`);
  root.style.setProperty("--imprint-overhang", `${-side * IMPRINT_OVERHANG}px`);
  root.toggleAttribute("data-imprint", imprintShows(size, clearing));
}

/** The light's colours as the page paints them now. */
function paletteOf(root: HTMLElement, toneToken: string): GlassInk {
  const style = getComputedStyle(root);
  const surface = channels(style.getPropertyValue("--chat-composer-glass-surface"));
  const glass = surface.alpha > 0 ? surface.rgb : groundOf(root.parentElement ?? root);
  return {
    tone: channels(style.getPropertyValue(toneToken)).rgb,
    warm: channels(style.getPropertyValue("--sc-needs-you")).rgb,
    glass,
    lightInk: luminanceOf(inkOf(root)) > luminanceOf(glass),
  };
}
