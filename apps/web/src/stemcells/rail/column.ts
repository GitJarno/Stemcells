/**
 * What the left column shows when it shows: the Cells' column (the default, which also keeps
 * which stage is open), the rail (its narrowest) or upstream's list, for what only it does
 * (projects, environments). Hidden is upstream's own open and closed, so its shortcut and
 * button hide and show whichever this says. Remembered in this browser, by its lead window.
 */
import { create } from "zustand";

import { windowsBridge } from "../windows/bridge";

export type ColumnWidth = "cells" | "rail" | "list";

/** A stage of the line every Cell travels (stemcells/tasks/left-column.md), or the pins beside it. */
export type ColumnStage = "needs" | "working" | "landed" | "settled" | "pinned";

const COLUMN_STORAGE_KEY = "stemcells.leftColumn";
const STAGE_STORAGE_KEY = "stemcells.leftColumn.stage";
const PROJECT_STORAGE_KEY = "stemcells.leftColumn.project";

/** "wide" was upstream's list when the rail was the default: the wide column is the Cells' now. */
export function parseColumnWidth(raw: string | null): ColumnWidth {
  return raw === "rail" || raw === "list" ? raw : "cells";
}

/**
 * A window torn off or opened beside the lead window starts on the rail, whatever was
 * remembered, and its own changes stay its own: the remembered width is the lead window's.
 */
export function startingWidth(stored: string | null, leads: boolean): ColumnWidth {
  return leads ? parseColumnWidth(stored) : "rail";
}

const leadsAtStart = windowsBridge()?.boot.lead ?? true;

/** The stages in the line's order, the pins last: the order a swipe goes through them. */
export const COLUMN_STAGES: ReadonlyArray<ColumnStage> = [
  "needs",
  "working",
  "landed",
  "settled",
  "pinned",
];

export function parseColumnStage(raw: string | null): ColumnStage {
  return COLUMN_STAGES.find((stage) => stage === raw) ?? "needs";
}

function readStored(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A full or blocked storage forgets the choice on reload, nothing more.
  }
}

interface ColumnStore {
  readonly width: ColumnWidth;
  readonly stage: ColumnStage;
  /** The project the column shows, by upstream's group key (`filter.ts`); null for every one. */
  readonly project: string | null;
  readonly setWidth: (width: ColumnWidth) => void;
  readonly setStage: (stage: ColumnStage) => void;
  readonly setProject: (project: string | null) => void;
}

export const useColumnStore = create<ColumnStore>((set) => ({
  width: startingWidth(readStored(COLUMN_STORAGE_KEY), leadsAtStart),
  stage: parseColumnStage(readStored(STAGE_STORAGE_KEY)),
  project: readStored(PROJECT_STORAGE_KEY) || null,
  setWidth: (width) => {
    set({ width });
    if (leadsAtStart) store(COLUMN_STORAGE_KEY, width);
  },
  setStage: (stage) => {
    set({ stage });
    store(STAGE_STORAGE_KEY, stage);
  },
  setProject: (project) => {
    set({ project });
    store(PROJECT_STORAGE_KEY, project ?? "");
  },
}));
