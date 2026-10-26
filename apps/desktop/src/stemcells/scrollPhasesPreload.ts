/**
 * Stemcells: hands the page macOS's trackpad scroll phases as `window.stemcellsScrollPhases`
 * (read by apps/web/src/stemcells/tabs/phases.ts), on the page's clock. The main process
 * (scrollPhases.ts) stamps each with the system's clock; the page's clock sits a fixed distance
 * from it, and the quickest message to arrive lines the two up.
 */
import { contextBridge, ipcRenderer } from "electron";

interface ScrollPhases {
  readonly t: number;
  readonly phase: number;
  readonly momentum: number;
  readonly moved: boolean;
}

const listeners = new Set<(scroll: ScrollPhases) => void>();
/** The system's clock less the page's (ms), as near as the messages so far show. */
let ahead = -Infinity;

ipcRenderer.on("stemcells:scroll-phases", (_event, message: unknown) => {
  const got = performance.now();
  if (!Array.isArray(message) || message.length !== 6) return;
  if (!message.every((value) => typeof value === "number")) return;
  const [time, phase, momentum, dx, dy, sent] = message as number[];
  ahead = Math.max(ahead, sent! - got);
  // Phase 0 in both: the clock alone.
  if (phase === 0 && momentum === 0) return;
  const scroll = {
    t: time! - ahead,
    phase: phase!,
    momentum: momentum!,
    moved: dx !== 0 || dy !== 0,
  };
  for (const listener of listeners) listener(scroll);
});

contextBridge.exposeInMainWorld("stemcellsScrollPhases", {
  subscribe(listener: (scroll: ScrollPhases) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
});
