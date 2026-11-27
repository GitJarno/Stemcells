// Whether the Cell heading a chat is drawn from its model (Settings › Collection › Cells): a
// preview, off unless the person turned it on, as the Mac's (`apps/web/src/stemcells/cell/
// modelPreview.ts`). Kept in a file of ours on this phone (`stemcells/tasks/cell-model.md`).

import { useSyncExternalStore } from "react";

import { readKept, writeKept } from "../upstream/kept";

const FILE = "cell-model";
const ON = "on";

let on: boolean | null = null;
const listeners = new Set<() => void>();

const read = (): boolean => {
  on ??= readKept(FILE) === ON;
  return on;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function setCellModelOn(next: boolean): void {
  on = next;
  for (const listener of listeners) listener();
  void writeKept(FILE, next ? ON : "off");
}

export function useCellModelOn(): boolean {
  return useSyncExternalStore(subscribe, read);
}
