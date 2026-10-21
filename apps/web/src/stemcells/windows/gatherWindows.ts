/**
 * Gather and Put back in a window (stemcells/tasks/windows.md): what the
 * strip's button offers, read from the windows as they are, and pressing it
 * from the button or ⌥⌘G.
 */
import { useEffect, useState } from "react";

import { displaySetKey } from "./arrangement";
import { windowsBridge } from "./bridge";
import { gatherButton, pressGather } from "./gather";
import { commitMove, readSnapshot } from "./wire";

export const GATHER_SHORTCUT = "mod+alt+g";

export type GatherOffer = "gather" | "putBack";

/** Every window into this one, or the windows back where they were: whichever is on offer. */
export async function gatherOrPutBack(): Promise<boolean> {
  const bridge = windowsBridge();
  if (!bridge) return false;
  const moved = await commitMove((seen) =>
    pressGather(seen.arrangement, bridge.boot.id, displaySetKey(seen.displays)),
  );
  return moved !== null;
}

/** What the button offers now, read again whenever a window opens or closes or a display changes. */
export function useGatherOffer(): GatherOffer | null {
  const [offer, setOffer] = useState<GatherOffer | null>(null);
  useEffect(() => {
    const bridge = windowsBridge();
    if (!bridge) return;
    let asked = 0;
    const read = () => {
      asked += 1;
      const question = asked;
      void bridge.snapshot().then((snapshot) => {
        if (question !== asked) return;
        const { arrangement, displays } = readSnapshot(snapshot);
        setOffer(gatherButton(arrangement, displaySetKey(displays)));
      });
    };
    read();
    const stop = bridge.onArranged(read);
    return () => {
      asked += 1;
      stop();
    };
  }, []);
  return offer;
}
