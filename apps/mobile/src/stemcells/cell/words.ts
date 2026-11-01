/**
 * Upstream's alerts about a thread, as a person reads them on the phone: a thread is a Cell, and
 * one at work is flying (`stemcells/AGENTS.md`, Words). Whole sentences only, so a title quoted
 * inside one is never reworded; the `Dialog` substitute says them in T3's place.
 */
export const CELL_ALERTS: Readonly<Record<string, string>> = {
  "Could not archive thread": "Could not archive Cell",
  "Could not unarchive thread": "Could not unarchive Cell",
  "Could not settle thread": "Could not settle Cell",
  "Could not un-settle thread": "Could not un-settle Cell",
  "Could not delete thread": "Could not delete Cell",
  "The thread could not be archived.": "The Cell could not be archived.",
  "The thread could not be unarchived.": "The Cell could not be unarchived.",
  "The thread could not be deleted.": "The Cell could not be deleted.",
  "The thread could not be settled.": "The Cell could not be settled.",
  "The thread could not be un-settled.": "The Cell could not be un-settled.",
  "This connection cannot change threads.": "This connection cannot change Cells.",
  "This thread is working. Interrupt it first, then try again.":
    "This Cell is flying. Interrupt it first, then try again.",
  "Delete thread?": "Delete Cell?",
  "Could not undo thread action": "Could not undo Cell action",
  "Could not snooze thread": "Could not snooze Cell",
  "The thread could not be snoozed.": "The Cell could not be snoozed.",
  "This thread is waiting on you. Respond to the pending request before snoozing it.":
    "This Cell is waiting on you. Respond to the pending request before snoozing it.",
  "This thread is still starting a turn. Try again once it's running.":
    "This Cell is still starting a turn. Try again once it's flying.",
  "Could not wake thread": "Could not wake Cell",
  "This environment's server does not support snoozing yet. Update the server to wake this thread.":
    "This environment's server does not support snoozing yet. Update the server to wake this Cell.",
  "The thread could not be woken.": "The Cell could not be woken.",
  "Could not pin thread": "Could not pin Cell",
  "The thread could not be pinned.": "The Cell could not be pinned.",
  "Could not unpin thread": "Could not unpin Cell",
  "The thread could not be unpinned.": "The Cell could not be unpinned.",
  "This environment's server does not support turning auto-settle off per thread yet. Update the server to use it.":
    "This environment's server does not support turning auto-settle off per Cell yet. Update the server to use it.",
  "This environment's server does not support title regeneration yet. Update the server to regenerate thread titles.":
    "This environment's server does not support title regeneration yet. Update the server to regenerate Cell titles.",
  "The thread title could not be regenerated.": "The Cell title could not be regenerated.",
  "Rename thread": "Rename Cell",
  "Could not rename thread": "Could not rename Cell",
  "Thread title cannot be empty.": "Cell title cannot be empty.",
  "The thread could not be renamed.": "The Cell could not be renamed.",
  "Could not move thread": "Could not move Cell",
  "This environment's server does not support reordering these threads. Update the server to arrange them.":
    "This environment's server does not support reordering these Cells. Update the server to arrange them.",
  "The thread could not be moved.": "The Cell could not be moved.",
  "Try copying this thread again.": "Try copying this Cell again.",
  "This action needs a saved thread.": "This action needs a saved Cell.",
  "Attached thread unavailable": "Attached Cell unavailable",
  "Could not update thread": "Could not update Cell",
  "Couldn't open a thread": "Couldn't open a Cell",
};

/** `text` in Cell words when it is one of upstream's alerts about a thread, else as it is. */
export function inCellWords(text: string): string;
export function inCellWords(text: string | undefined): string | undefined;
export function inCellWords(text: string | null | undefined): string | null | undefined;
export function inCellWords(text: string | null | undefined): string | null | undefined {
  return typeof text === "string" ? (CELL_ALERTS[text] ?? text) : text;
}
