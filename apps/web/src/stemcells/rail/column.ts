/**
 * How wide the left column stands when it shows: the rail (the default, the
 * smallest it goes) or upstream's wide sidebar. Hidden is upstream's own
 * open and closed, so its shortcut and button hide and show whichever this
 * says. Remembered in this browser.
 */
import { create } from "zustand";

export type ColumnWidth = "rail" | "wide";

const COLUMN_STORAGE_KEY = "stemcells.leftColumn";

export function parseColumnWidth(raw: string | null): ColumnWidth {
  return raw === "wide" ? "wide" : "rail";
}

function readStoredWidth(): ColumnWidth {
  if (typeof localStorage === "undefined") return "rail";
  try {
    return parseColumnWidth(localStorage.getItem(COLUMN_STORAGE_KEY));
  } catch {
    return "rail";
  }
}

interface ColumnStore {
  readonly width: ColumnWidth;
  readonly setWidth: (width: ColumnWidth) => void;
}

export const useColumnStore = create<ColumnStore>((set) => ({
  width: readStoredWidth(),
  setWidth: (width) => {
    set({ width });
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, width);
    } catch {
      // A full or blocked storage forgets the choice on reload, nothing more.
    }
  },
}));
