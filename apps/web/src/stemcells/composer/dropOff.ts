/**
 * The Cell and its line stand on clean ground: the transcript fades out
 * across the band they sit in, from the Cell's head down to the plate, and
 * shows again only behind the plate, whose glass reads it; below the plate,
 * to the pane's foot, it stays out. Writes the band to the pane
 * (`--sc-drop-top`, `--sc-drop-plate`, `--sc-drop-under`: how far its top,
 * the plate's top and the plate's bottom sit above the transcript's foot;
 * `--sc-drop-lead`: the room above it that the transcript keeps clear at its
 * end), where `composer-line.css` masks the transcript with it. A composer
 * with nothing over its plate has no band.
 */
export function dropOff(composer: HTMLElement, pane: HTMLElement): () => void {
  const overlay = composer.closest("[data-chat-composer-overlay]");
  const plate = composer.querySelector("[data-chat-composer-main-surface]");
  if (overlay === null || plate === null) return () => undefined;
  const measure = () => {
    const room = overlay.getBoundingClientRect();
    const glass = plate.getBoundingClientRect();
    const band = bandOf(
      room.bottom,
      room.top,
      composer.getBoundingClientRect().top,
      glass.top,
      glass.bottom,
    );
    if (band === null) {
      clear(pane);
      return;
    }
    pane.style.setProperty("--sc-drop-top", `${band.top}px`);
    pane.style.setProperty("--sc-drop-plate", `${band.plate}px`);
    pane.style.setProperty("--sc-drop-under", `${band.under}px`);
    pane.style.setProperty("--sc-drop-lead", `${band.lead}px`);
    pane.dataset.dropOff = "";
  };
  measure();
  // oxlint-disable-next-line t3code/no-raw-resize-observer -- The band goes to a mask, never into React state.
  const sized = new ResizeObserver(measure);
  sized.observe(composer);
  return () => {
    sized.disconnect();
    clear(pane);
  };
}

/**
 * The band over the plate, measured up from the transcript's foot (which the
 * composer's overlay shares): from the top of what stands on the plate down
 * to the plate's top; the plate's bottom; and the lead above the band,
 * inside the overlay, that the transcript keeps clear of its last row. None
 * when nothing stands there.
 */
export function bandOf(
  foot: number,
  overlayTop: number,
  top: number,
  plateTop: number,
  plateBottom: number,
): {
  readonly top: number;
  readonly plate: number;
  readonly under: number;
  readonly lead: number;
} | null {
  if (plateTop - top < 1) return null;
  return {
    top: Math.round(foot - top),
    plate: Math.round(foot - plateTop),
    under: Math.max(0, Math.round(foot - plateBottom)),
    lead: Math.max(0, Math.floor(top - overlayTop)),
  };
}

function clear(pane: HTMLElement): void {
  pane.style.removeProperty("--sc-drop-top");
  pane.style.removeProperty("--sc-drop-plate");
  pane.style.removeProperty("--sc-drop-under");
  pane.style.removeProperty("--sc-drop-lead");
  delete pane.dataset.dropOff;
}
