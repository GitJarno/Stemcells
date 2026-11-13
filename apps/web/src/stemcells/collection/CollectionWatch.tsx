// Keeps this window's collection current, and plays a feat's moment: read when the workspace
// comes up, a beat after any run starts or ends (the ledger writes after the event) and when
// the window comes back. A feat earned since the first read gets its card, one at a time,
// never while a Cell waits on the person.

import { useEffect, useRef, useState } from "react";

import { useMinute } from "../rail/clock";
import { useMomentChats } from "../upstream/askiMoments";
import { FeatCard } from "./FeatCard";
import { earnedIds, momentOf, rungAbove } from "./fresh";
import { readCollection, useCollection } from "./read";

/** The ledger keeps a landing well inside a second; this long after a run changes, it is read. */
const LEDGER_WRITES_WITHIN = 2_500;

/** What was earned when this window first read the collection: none of it gets a card. */
let baseline: ReadonlySet<string> | null = null;

export function CollectionWatch() {
  const collection = useCollection();
  const minute = useMinute();
  const chats = useMomentChats(null, new Date(minute).toISOString());
  const runs = chats.map((chat) => `${chat.threadId}:${chat.run?.id}:${chat.run?.ended}`).join();
  const waits = chats.some((chat) => chat.standing === "needsYou");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [showing, setShowing] = useState<string | null>(null);
  const read = useRef(runs);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the machine's collection a beat after any run starts or ends, clearing the timer on change.
  useEffect(() => {
    if (read.current === runs) return;
    read.current = runs;
    const soon = setTimeout(() => void readCollection(), LEDGER_WRITES_WITHIN);
    return () => clearTimeout(soon);
  }, [runs]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the machine's collection as the workspace comes up and whenever the window comes back into view.
  useEffect(() => {
    void readCollection();
    const shown = () => {
      if (document.visibilityState === "visible") void readCollection();
    };
    document.addEventListener("visibilitychange", shown);
    return () => document.removeEventListener("visibilitychange", shown);
  }, []);
  if (collection === null) return null;
  baseline ??= earnedIds(collection);
  const next = momentOf(showing, baseline, collection, dismissed);
  // Held once picked: the card notes its feat seen as it shows, which must not take it down.
  if (showing === null && next !== undefined && !waits) setShowing(next.feat.id);
  if (showing !== null && next === undefined) setShowing(null);
  if (showing === null || next === undefined) return null;
  const threadId = next.state.earned?.threadId ?? null;
  return (
    <FeatCard
      key={next.feat.id}
      standing={next}
      worn={threadId === null ? [] : (collection.worn[threadId] ?? [])}
      next={rungAbove(next, collection)}
      onDone={() => {
        setDismissed((before) => new Set(before).add(next.feat.id));
        setShowing(null);
      }}
    />
  );
}
