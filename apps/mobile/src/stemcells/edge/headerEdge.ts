// Which edges a scroll view hands UIKit (`upstream/substitutes/NativeScrollViewMarker.tsx`), apart
// from the view so Node can test it.

/** A transparent header with nothing behind it: iOS 27's `automatic` edge is a hard band. */
export const NO_HEADER_BAND = {
  top: "hidden",
  bottom: "hidden",
  left: "hidden",
  right: "hidden",
} as const;

type Edges<Effect extends string> = {
  readonly top?: Effect;
  readonly bottom?: Effect;
  readonly left?: Effect;
  readonly right?: Effect;
};

/**
 * The home takes no band anywhere, and a page in the Duo's columns none under its header, where
 * UIKit draws one over the camera's band; the rest is what the screen asked for.
 */
export function headerEdges<Effect extends string>(input: {
  readonly home: boolean;
  readonly duoPage: boolean;
  readonly asked: Edges<Effect> | undefined;
}): Edges<Effect | "hidden"> | undefined {
  if (input.home) return NO_HEADER_BAND;
  if (input.duoPage) return { ...NO_HEADER_BAND, ...input.asked, top: "hidden" };
  return input.asked;
}
