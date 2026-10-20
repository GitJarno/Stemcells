// Colours the skin gives the page, read back as 0–255 channels for what
// draws pixels itself: Aski's figure and its scenes.

/** A computed colour as 0–255 channels, and its alpha. */
export function channels(colour: string): { rgb: [number, number, number]; alpha: number } {
  const [r = 0, g = 0, b = 0, alpha = 1] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  return { rgb: [r, g, b], alpha };
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
