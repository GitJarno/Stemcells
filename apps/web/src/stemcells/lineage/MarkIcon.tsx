import type { MarkId } from "../../../../../stemcells/ledger/marks.ts";
import { MARK_ICON_BOX, MARK_ICON_STROKE, MARK_ICONS } from "./markIcons";

/** A mark's icon in the ink of the words beside it: the shape says which mark, not a hue. */
export function MarkIcon(props: { readonly mark: MarkId; readonly className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_ICON_BOX} ${MARK_ICON_BOX}`}
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth={MARK_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {MARK_ICONS[props.mark].map((part) =>
        "d" in part ? (
          <path key={part.d} d={part.d} />
        ) : (
          <circle
            key={part.circle.join()}
            cx={part.circle[0]}
            cy={part.circle[1]}
            r={part.circle[2]}
          />
        ),
      )}
    </svg>
  );
}
