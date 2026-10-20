// Whether somebody is at this Mac, as its server says
// (`GET /api/stemcells/presence`), for Aski's eyes. Asked only while the
// page is in sight: every few seconds while somebody is at the Mac, and
// seldom while nobody is, since each answer reads the Mac's registry. A
// return shows itself here first: while nobody was there, the pointer
// moving, a key or the window coming forward asks again at once. A server
// that stops answering leaves its last word standing: a Mac that said
// nobody was at it and then went quiet is taken to be asleep.

import { useEffect, useState } from "react";

import { getFromPrimary } from "../upstream/askiEyes";

const PRESENCE_PATH = "/api/stemcells/presence";
/** How often to ask, in milliseconds, while somebody is at the Mac and while nobody is. */
export const EVERY = { present: 10_000, away: 60_000 } as const;
/** The least time between two asks a return prompts, in milliseconds: the server's own reading lasts this long. */
export const AGAIN = 2_000;

/** The page as the watch needs it: whether it is hidden, and where its visibility, pointer, keys and focus are heard. */
export interface PresencePage {
  readonly hidden: () => boolean;
  readonly document: EventTarget;
  readonly window: EventTarget;
}

/**
 * Asks `read` whether somebody is at the Mac, and tells `tell` each answer:
 * on the schedule above, never while the page is hidden, and at once when
 * the page stirs while nobody was there. `read` answers undefined when the
 * server said nothing. Returns the function that stops it.
 */
export function watchPresence(
  read: () => Promise<boolean | undefined>,
  tell: (present: boolean) => void,
  page: PresencePage,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let gone = false;
  let asking = false;
  let last = true;
  let askedAt = 0;
  const ask = async (): Promise<void> => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (page.hidden() || asking) return;
    asking = true;
    askedAt = Date.now();
    try {
      last = (await read()) ?? last;
    } catch {
      // No answer: the last word stands.
    } finally {
      asking = false;
    }
    if (gone || page.hidden()) return;
    tell(last);
    timer = setTimeout(() => void ask(), last ? EVERY.present : EVERY.away);
  };
  const shown = (): void => {
    if (!page.hidden() && timer === undefined) void ask();
  };
  // Somebody may be back: ask now rather than at the next slow turn.
  const stirred = (): void => {
    if (!last && Date.now() - askedAt >= AGAIN) void ask();
  };
  void ask();
  page.document.addEventListener("visibilitychange", shown);
  for (const type of ["pointermove", "keydown", "focus"])
    page.window.addEventListener(type, stirred);
  return () => {
    gone = true;
    if (timer !== undefined) clearTimeout(timer);
    page.document.removeEventListener("visibilitychange", shown);
    for (const type of ["pointermove", "keydown", "focus"])
      page.window.removeEventListener(type, stirred);
  };
}

/** What the server says, true or false; undefined when it says nothing it can be taken at. */
async function readPresence(): Promise<boolean | undefined> {
  const response = await getFromPrimary(PRESENCE_PATH);
  if (!response.ok) return undefined;
  const said = (await response.json()) as { present?: unknown };
  return typeof said.present === "boolean" ? said.present : undefined;
}

/** Whether somebody is at this Mac; true until the server says otherwise. */
export function usePresent(): boolean {
  const [present, setPresent] = useState(true);
  useEffect(
    () =>
      watchPresence(readPresence, setPresent, { hidden: () => document.hidden, document, window }),
    [],
  );
  return present;
}
