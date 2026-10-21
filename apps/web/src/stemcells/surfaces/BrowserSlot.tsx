import { type ComponentProps, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { shownBrowserView, UpstreamBrowserSurfaceSlot } from "../upstream/surfaces";
import { ride } from "./ride";

/**
 * Upstream's browser slot, its browser riding the page it sits on
 * (`ride.ts`). The wrapper has no box of its own: the slot measured is
 * upstream's, in its place.
 */
export function BrowserSurfaceSlot(props: ComponentProps<typeof UpstreamBrowserSurfaceSlot>) {
  const { tabId } = props;
  const host = useRef<HTMLDivElement>(null);
  // A rest is a new layout version: upstream's slot presents its rect again.
  const [rests, setRests] = useState(0);

  useLayoutEffect(() => {
    const anchor = host.current?.firstElementChild;
    if (!(anchor instanceof HTMLElement)) return;
    return ride({
      anchor,
      view: () => shownBrowserView(tabId),
      // Placed before the transform goes, in the same frame.
      rest: () => flushSync(() => setRests((count) => count + 1)),
    });
  }, [tabId]);

  return (
    <div ref={host} style={{ display: "contents" }}>
      <UpstreamBrowserSurfaceSlot
        {...props}
        layoutVersion={`${props.layoutVersion ?? ""}:${rests}`}
      />
    </div>
  );
}
