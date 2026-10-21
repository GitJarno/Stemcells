/**
 * What Aski's place in its chat reads from upstream
 * (stemcells/tasks/aski-room.md, decision 10): whether the chat has started,
 * and where the chat's canvas is. `askiPerch.contract.test.ts` pins what
 * this and `aski/perch.css` rely on.
 */
import { useQuietThreadShell } from "~/state/entities";

import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

export { observeResize } from "~/lib/observeResize";

/**
 * Whether the chat has been sent anything: a chat with no run yet shows
 * upstream's empty transcript. Null until its shell is known.
 */
export function useChatStarted(cell: CellRef): boolean | null {
  const shell = useQuietThreadShell(threadRefOf(cell));
  return shell === null ? null : shell.latestRun !== null;
}

/** The chat's canvas, the box its transcript and composer share. */
export const chatCanvasOf = (element: Element): HTMLElement | null =>
  element.closest<HTMLElement>("[data-chat-canvas]");

/** The box over the transcript's foot that holds the composer, and grows with it. */
export const composerOverlayOf = (element: Element): HTMLElement | null =>
  element.closest<HTMLElement>('[data-chat-composer-overlay="true"]');
