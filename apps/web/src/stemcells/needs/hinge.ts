/**
 * Where a two-screen device's hinge crosses Aski's page (stemcells/tasks/
 * aski-room.md, decision 10). Side by side, the chat keeps the first screen
 * and the list the second; stacked, held like a laptop, the list takes the
 * top screen and the chat the bottom one, near the hands.
 */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Screen {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Hinge {
  readonly axis: "side" | "stacked";
  /** Where the first screen ends, in the page's own pixels. */
  readonly start: number;
  /** Where the second screen begins. */
  readonly end: number;
}

/**
 * The hinge, when it runs through the page's middle half; one near an edge
 * would leave the chat or the list a sliver, so the page keeps its one-screen
 * layout then.
 */
export function hingeAcross(box: Box, screens: ReadonlyArray<Screen>): Hinge | null {
  const [first, second] = screens;
  if (screens.length !== 2 || first === undefined || second === undefined) return null;
  const side = second.left >= first.right;
  const size = side ? box.width : box.height;
  const start = side ? first.right - box.left : first.bottom - box.top;
  const end = side ? second.left - box.left : second.top - box.top;
  if (start < size / 4 || end > (size * 3) / 4) return null;
  return { axis: side ? "side" : "stacked", start, end };
}

export const sameHinge = (a: Hinge | null, b: Hinge | null): boolean =>
  a === b ||
  (a !== null && b !== null && a.axis === b.axis && a.start === b.start && a.end === b.end);
