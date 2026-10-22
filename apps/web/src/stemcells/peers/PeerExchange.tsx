import { createContext, use, useState, type ReactNode } from "react";

import { type Entry, exchangeOf, type PeerNote } from "./exchange";

// The chat's messages with other Cells, read once per timeline from the
// entries it draws (`upstream/substitutes/MessagesTimeline.tsx`), so a card
// knows whether its ask was answered and which question a reply answers.

const PeerNotes = createContext<ReadonlyMap<string, PeerNote>>(new Map());

const sameNotes = (a: ReadonlyMap<string, PeerNote>, b: ReadonlyMap<string, PeerNote>) =>
  a.size === b.size &&
  [...a].every(([id, note]) => {
    const other = b.get(id);
    return (
      other !== undefined &&
      other.kind === note.kind &&
      other.answered === note.answered &&
      other.answers === note.answers &&
      other.gist === note.gist &&
      other.rest === note.rest
    );
  });

export function PeerExchangeProvider(props: {
  readonly entries: ReadonlyArray<Entry>;
  readonly children: ReactNode;
}) {
  const next = exchangeOf(props.entries);
  // A streaming reply hands the timeline new entries many times a second;
  // the cards re-render only when what they show changed.
  const [notes, setNotes] = useState(next);
  if (notes !== next && !sameNotes(next, notes)) setNotes(next);
  return <PeerNotes value={notes}>{props.children}</PeerNotes>;
}

/** The peer note for a message or a tool call, by its id; null when it is none. */
export const usePeerNote = (id: string): PeerNote | null => use(PeerNotes).get(id) ?? null;
