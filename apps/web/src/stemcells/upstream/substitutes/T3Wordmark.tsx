/**
 * Substitutes upstream's `components/T3Wordmark.tsx` (`plugin.ts`). Where
 * upstream draws T3's wordmark as an icon (the work log's rows for T3's own
 * tools, and the lifecycle row of a thread one of them started), it draws
 * Stemcells' mark, SC█, in the same box and the same colour.
 */
import type { SVGProps } from "react";

import {
  MARK_CURSOR,
  MARK_LETTERS,
  MARK_VIEW_BOX,
} from "../../../../../../stemcells/brand/mark.ts";

export function T3Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox={MARK_VIEW_BOX} xmlns="http://www.w3.org/2000/svg">
      <path d={MARK_LETTERS} fill="currentColor" />
      <path d={MARK_CURSOR} fill="currentColor" />
    </svg>
  );
}
