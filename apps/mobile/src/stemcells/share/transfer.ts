// The one download a person waits on before the share sheet opens, for the app's one card
// (`TransferCard.tsx`). A download that ends within a moment never shows, so a small file
// doesn't flash a card; progress reaches the card a whole percent (or megabyte) at a time.
import { useSyncExternalStore } from "react";

/** How long a download runs before its card shows, in ms. */
export const SHOWS_AFTER_MS = 300;
const MEGABYTE = 1024 * 1024;

export interface Transfer {
  readonly id: number;
  readonly name: string;
  readonly written: number;
  /** Null while the server hasn't said how big the file is. */
  readonly total: number | null;
  readonly cancel: () => void;
}

let shown: Transfer | null = null;
let lastId = 0;
const listeners = new Set<() => void>();

function show(next: Transfer | null) {
  shown = next;
  for (const listener of listeners) listener();
}

const step = (transfer: Transfer) =>
  transfer.total === null
    ? Math.floor(transfer.written / MEGABYTE)
    : Math.floor((transfer.written * 100) / transfer.total);

/** Starts a download's card; `cancel` is what its Cancel does. */
export function beginTransfer(name: string, cancel: () => void) {
  const id = ++lastId;
  let latest: Transfer = { id, name, written: 0, total: null, cancel };
  let visible = false;
  const timer = setTimeout(() => {
    visible = true;
    show(latest);
  }, SHOWS_AFTER_MS);
  return {
    progress(written: number, totalBytes: number) {
      const next = { ...latest, written, total: totalBytes > 0 ? totalBytes : null };
      const moved = step(next) !== step(latest) || next.total !== latest.total;
      latest = next;
      if (visible && moved) show(latest);
    },
    end() {
      clearTimeout(timer);
      visible = false;
      if (shown?.id === id) show(null);
    },
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const read = () => shown;

export const shownTransfer = read;

export function useShownTransfer(): Transfer | null {
  return useSyncExternalStore(subscribe, read, read);
}
