// Aski divides on the home, as on the Mac (`apps/web/src/stemcells/aski/
// copies.ts`): a Cell forming in its card (`cell/forming.ts`) gets a small
// copy of Aski that buds off Aski over the list and flies to the card,
// landing as the Cell's glyphs start. Boxes are in the window's points.

import { useSyncExternalStore } from "react";
import type { ViewInstance } from "react-native";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Flight {
  readonly threadId: string;
  readonly from: Box;
  readonly to: Box;
  /** When it lands, on the Cells' clock (`clockSeconds`). */
  readonly lands: number;
}

let aski: ViewInstance | null = null;
const flights = new Map<string, Flight>();
/** Cells whose copy has left: one copy a Cell, however often its card shows. */
const sent = new Set<string>();
let shown: readonly Flight[] = [];
const listeners = new Set<() => void>();

function changed(): void {
  shown = [...flights.values()];
  for (const listener of listeners) listener();
}

/** Where Aski stands over the list, while it does: copies bud off it. */
export function askiStandsIn(view: ViewInstance | null): void {
  aski = view;
}

/** Sends a copy from Aski to the Cell of `threadId`, standing in `to`, to land at `lands`; none while Aski isn't on the home. */
export function sendCopy(threadId: string, to: Box, lands: number): void {
  if (sent.has(threadId) || aski === null) return;
  sent.add(threadId);
  aski.measureInWindow((x, y, width, height) => {
    if (width === 0) return;
    flights.set(threadId, { threadId, from: { x, y, width, height }, to, lands });
    changed();
  });
}

/** The copy to the Cell of `threadId` has landed. */
export function copyLanded(threadId: string): void {
  if (flights.delete(threadId)) changed();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The copies in flight. */
export function useCopies(): readonly Flight[] {
  return useSyncExternalStore(subscribe, () => shown);
}
