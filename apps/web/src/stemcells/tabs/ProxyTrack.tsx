import "./proxy.css";

import type { CSSProperties, ReactNode } from "react";

import { SLOTS } from "./proxy";

const SLOT_NUMBERS = Array.from({ length: SLOTS }, (_, slot) => slot);

/**
 * The inside of a proxy (`[data-stemcells-proxy]`, `proxy.ts`): its track of snap slots, and the
 * frame that stays in view as the proxy scrolls. `children` go in the frame; among them is the
 * hold (`[data-stemcells-hold]`) the strip is in.
 */
export function ProxyTrack(props: { children: ReactNode }) {
  return (
    <div data-stemcells-proxy-track="" style={{ "--sc-proxy-slots": SLOTS } as CSSProperties}>
      <div data-stemcells-proxy-slots="">
        {SLOT_NUMBERS.map((slot) => (
          <i key={slot} data-stemcells-proxy-slot={slot} />
        ))}
      </div>
      <div data-stemcells-proxy-frame="">{props.children}</div>
    </div>
  );
}
