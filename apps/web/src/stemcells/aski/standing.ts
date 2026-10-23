/**
 * Aski standing in a new chat (stemcells/tasks/aski-manager.md, decision
 * 4) until the chat's words go: then the spawn's Aski takes its place, or,
 * for one Cell, it flies to the Cell's line itself (`words/spawn/play.ts`).
 * By draft, so another new chat keeps its own.
 */
import { useSyncExternalStore } from "react";

const gone = new Set<string>();
const listeners = new Set<() => void>();

const told = () => {
  for (const listener of listeners) listener();
};

/** The words of draft `draftId` went: Aski leaves where it stood. */
export function standingLeaves(draftId: string): void {
  if (gone.has(draftId)) return;
  gone.add(draftId);
  told();
}

/** Nothing went after all: Aski stands in draft `draftId`'s chat again. */
export function standingBack(draftId: string): void {
  if (gone.delete(draftId)) told();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Whether Aski has left draft `draftId`'s chat. */
export function useStandingLeft(draftId: string | null): boolean {
  const read = () => draftId !== null && gone.has(draftId);
  return useSyncExternalStore(subscribe, read, read);
}

/** Aski standing in the chat of `editor`'s composer, if it stands there still. */
export function standingIn(editor: Element): Element | null {
  return (
    editor
      .closest('[data-chat-composer-stack="true"]')
      ?.querySelector("[data-stemcells-aski-standing]:not([data-left])") ?? null
  );
}
