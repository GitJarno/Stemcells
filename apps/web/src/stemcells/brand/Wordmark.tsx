import { WORDMARK, WORDMARK_VIEW_BOX } from "../../../../../stemcells/brand/mark.ts";

// The wordmark, `stemcells`, where upstream draws the T3 logo beside "Code".
// Outfit's outlines from `stemcells/brand`, in the place's own colour; the
// link around it carries the name for assistive tech.

/** The sidebar's top-left. */
export function SidebarWordmark() {
  return (
    <svg
      aria-hidden
      className="block h-[13px] w-auto shrink-0"
      viewBox={WORDMARK_VIEW_BOX}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={WORDMARK} fill="currentColor" />
    </svg>
  );
}
