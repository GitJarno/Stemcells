// Whether somebody is at this Mac, as its server says
// (`GET /api/stemcells/presence`), for Aski's eyes. Asked while the page is
// in sight: every few seconds while nobody is there, so the eyes open soon
// after the person is back, and less often while somebody is. A server
// that stops answering leaves its last word standing: a Mac that said
// nobody was at it and then went quiet is taken to be asleep.

import { useEffect, useState } from "react";

import { getFromPrimary } from "../upstream/askiEyes";

const PRESENCE_PATH = "/api/stemcells/presence";
/** How often to ask, in milliseconds, while somebody is at the Mac and while nobody is. */
const EVERY = { present: 10_000, away: 2_000 } as const;

/** Whether somebody is at this Mac; true until the server says otherwise. */
export function usePresent(): boolean {
  const [present, setPresent] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let gone = false;
    let asking = false;
    let last = true;
    const ask = async (): Promise<void> => {
      timer = undefined;
      if (document.hidden || asking) return;
      asking = true;
      try {
        const response = await getFromPrimary(PRESENCE_PATH);
        if (response.ok) {
          const said = (await response.json()) as { present?: unknown };
          if (typeof said.present === "boolean") last = said.present;
        }
      } catch {
        // No answer: the last word stands.
      } finally {
        asking = false;
      }
      if (gone) return;
      setPresent(last);
      timer = setTimeout(() => void ask(), last ? EVERY.present : EVERY.away);
    };
    const shown = (): void => {
      if (!document.hidden && timer === undefined) void ask();
    };
    void ask();
    document.addEventListener("visibilitychange", shown);
    return () => {
      gone = true;
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", shown);
    };
  }, []);
  return present;
}
