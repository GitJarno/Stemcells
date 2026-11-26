import { createContext, useSyncExternalStore } from "react";

import { deriveSharedTopBand, type NativeLayoutMetrics } from "../upstream/reservedRegions";

/**
 * The chat whose header a bar draws, from `ThreadHeader`'s substitute to `AppBar`'s: `titled`
 * when the Cell stands beside its name there (`CellTitle`), not in a draft or a chat not yet known.
 */
export const ChatHeaderContext = createContext<{
  readonly threadId: string;
  readonly titled: boolean;
} | null>(null);

/**
 * Each chat's column width, handed from its bar, which stands in the column, to its title, which
 * the native bar renders outside it. Kept out of the header's options, so a column resized by the
 * inspector's divider redraws the title alone.
 */
const widths = new Map<string, number>();
const listeners = new Set<() => void>();

export function setColumnWidth(threadId: string, width: number | null): void {
  if (width === null) widths.delete(threadId);
  else widths.set(threadId, width);
  for (const listener of listeners) listener();
}

export function useColumnWidth(threadId: string): number | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => widths.get(threadId) ?? null,
  );
}

/**
 * The width a chat's title row has in its column: where the bar shares its row with the system's
 * status (the unfolded Duo, `deriveSharedTopBand`), the bar's buttons stand beside the status,
 * so the title ends that much sooner.
 */
export function titleRowWidth(metrics: NativeLayoutMetrics | null): number | null {
  if (metrics === null) return null;
  const band = deriveSharedTopBand(metrics);
  return metrics.width - (band?.left ?? 0) - (band?.right ?? 0);
}
