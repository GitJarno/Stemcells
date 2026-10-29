// The stops of a scrim (`Scrim.tsx`), apart from its view so Node can test them.

/** The ground's opacity along the fade, from whole to clear: eased, so it has no visible start. */
const EASED = [
  [0, 1],
  [0.19, 0.738],
  [0.34, 0.541],
  [0.47, 0.382],
  [0.565, 0.278],
  [0.65, 0.194],
  [0.73, 0.126],
  [0.802, 0.075],
  [0.861, 0.042],
  [0.91, 0.021],
  [0.952, 0.008],
  [0.982, 0.002],
  [1, 0],
] as const;

/** The stops, top to bottom, for a `height` whose ground is whole for `whole` from `edge`. */
export function scrimStops(edge: "top" | "bottom", height: number, whole: number) {
  const at = Math.min(1, Math.max(0, whole / height));
  const inward = [
    { offset: 0, opacity: 1 },
    ...EASED.map(([along, opacity]) => ({ offset: at + along * (1 - at), opacity })),
  ].filter((stop, index, all) => index === 0 || stop.offset !== all[index - 1]?.offset);
  // SVG's stops must ascend, so a bottom edge's run the other way.
  return edge === "top"
    ? inward
    : inward.map((stop) => ({ ...stop, offset: 1 - stop.offset })).reverse();
}
