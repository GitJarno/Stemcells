// Colours the page gives Aski, read back as 0–255 channels for what draws
// pixels itself: Aski's figure and its scenes.

let probe: CanvasRenderingContext2D | null = null;

/**
 * A computed colour as 0–255 sRGB channels, and its alpha. A computed colour
 * keeps the space it was written in (a theme's oklch() stays oklch()), so the
 * browser paints it on one pixel and the pixel is read back.
 */
export function channels(colour: string): { rgb: [number, number, number]; alpha: number } {
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (probe === null) return { rgb: [0, 0, 0], alpha: 0 };
  probe.clearRect(0, 0, 1, 1);
  // A colour the canvas can't read leaves the pixel clear.
  probe.fillStyle = "transparent";
  probe.fillStyle = colour.trim();
  probe.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = probe.getImageData(0, 0, 1, 1).data;
  return { rgb: [r, g, b], alpha: a / 255 };
}

/** The skin's ink, read from the element's own colour. */
export const inkOf = (el: Element): [number, number, number] =>
  channels(getComputedStyle(el).color).rgb;

/** The ground the element stands on: the backgrounds of the boxes around it, laid over each other up to the first opaque one. */
export function groundOf(el: Element): [number, number, number] {
  const layers: { rgb: [number, number, number]; alpha: number }[] = [];
  for (let at: Element | null = el; at !== null; at = at.parentElement) {
    const layer = channels(getComputedStyle(at).backgroundColor);
    if (layer.alpha > 0) layers.push(layer);
    if (layer.alpha >= 1) break;
  }
  let ground: [number, number, number] = [0, 0, 0];
  for (const { rgb, alpha } of layers.toReversed())
    ground = [0, 1, 2].map((c) => ground[c]! + (rgb[c]! - ground[c]!) * alpha) as [
      number,
      number,
      number,
    ];
  return ground;
}
