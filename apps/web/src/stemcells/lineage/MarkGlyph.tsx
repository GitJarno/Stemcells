import type { MarkId } from "../../../../../stemcells/ledger/marks.ts";
import { MARK_GLYPH_PATHS, MARK_GLYPH_SIDE } from "./markGlyphs";

/** A mark's glyph in the ink of the words beside it: the sign says which mark, not a hue. */
export function MarkGlyph(props: { readonly mark: MarkId; readonly className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_GLYPH_SIDE} ${MARK_GLYPH_SIDE}`}
      className={props.className}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path d={MARK_GLYPH_PATHS[props.mark]} />
    </svg>
  );
}
