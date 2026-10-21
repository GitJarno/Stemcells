/**
 * The chat's scroll rail as numbers: where its track runs in the pane,
 * where the thumb stands on it, and where a hand on the track takes the
 * transcript. `ScrollRail.tsx` reads the page and draws the marks.
 */

/** A scroller's extent, as the DOM reports it. */
export interface Extent {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

/** The thumb on its track: its length, and its top's offset from the track's top. */
export interface Thumb {
  readonly length: number;
  readonly offset: number;
}

/** A box's top and bottom on the page. */
export interface Span {
  readonly top: number;
  readonly bottom: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** How far a scroller travels; under a pixel is rounding, nothing to scroll. */
function room(extent: Extent): number {
  const travel = extent.scrollHeight - extent.clientHeight;
  return travel < 1 ? 0 : travel;
}

/**
 * The thumb on a `track` px long, never shorter than `least`: the
 * viewport's share of the transcript, standing where the viewport stands.
 * At the end, within a pixel, it stands at the track's end. Null when the
 * transcript fits: there is no rail.
 */
export function thumbOn(extent: Extent, track: number, least: number): Thumb | null {
  const travel = room(extent);
  if (travel === 0 || track <= 0) return null;
  const length = Math.min(
    track,
    Math.max(least, (track * extent.clientHeight) / extent.scrollHeight),
  );
  const share = travel - extent.scrollTop <= 1 ? 1 : clamp(extent.scrollTop / travel, 0, 1);
  return { length, offset: (track - length) * share };
}

/**
 * How far through the scroller a thumb `length` long stands with its top
 * `offset` down the track: 0 at the top, 1 at the end. Null when the thumb
 * fills the track and cannot move.
 */
export function shareAt(offset: number, length: number, track: number): number | null {
  const reach = track - length;
  return reach <= 0 ? null : clamp(offset / reach, 0, 1);
}

/** The scrollTop that stands a thumb `length` long with its top `offset` down the track. */
export function scrollTopAt(offset: number, length: number, extent: Extent, track: number): number {
  const share = shareAt(offset, length, track);
  return share === null ? extent.scrollTop : share * room(extent);
}

/**
 * How far the transcript's own box sits from the pane's top (`head`) and
 * its foot from the pane's foot (`foot`), its foot cut at the composer
 * when the composer floats over it. The stylesheet keeps the track below
 * the buttons' band and a gap above the composer.
 */
export function trackEnds(
  pane: Span,
  transcript: Span,
  composerTop: number | null,
): {
  head: number;
  foot: number;
} {
  const bottom =
    composerTop === null ? transcript.bottom : Math.min(transcript.bottom, composerTop);
  return {
    head: Math.max(0, transcript.top - pane.top),
    foot: Math.max(0, pane.bottom - bottom),
  };
}
