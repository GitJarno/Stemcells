import { useState, useSyncExternalStore } from "react";

/**
 * Whether a workbench still shows surfaces it no longer owns. While a tab's pages slide, the
 * page leaving keeps its surfaces, its browser riding with it (`ride.ts`), until the pages rest.
 * Only a workbench leaving listens for the rest: the others don't render again as pages move.
 */
export function useOwnedUntilRest(owns: boolean, node: HTMLElement | null): boolean {
  const [kept, setKept] = useState(owns);
  const leaving = !owns && kept;
  const pages = leaving ? (node?.closest<HTMLElement>("[data-stemcells-pages]") ?? null) : null;
  const subscribe = (change: () => void) => {
    if (pages === null) return () => undefined;
    const rest = new MutationObserver(change);
    rest.observe(pages, { attributes: true, attributeFilter: ["data-moving"] });
    return () => rest.disconnect();
  };
  const moving = useSyncExternalStore(
    subscribe,
    () => pages?.hasAttribute("data-moving") ?? false,
    () => false,
  );
  const shows = owns || (kept && moving);
  if (shows !== kept) setKept(shows);
  return shows;
}
