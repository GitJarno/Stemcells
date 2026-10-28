import { useEffect, useState } from "react";

import { timing } from "../tokens/motion";
import { KINDS, setTaking, useAutonomy, type Kind } from "./autonomy";

/**
 * Aski's offer in the room, once the person took one kind of card five times
 * in a row: a click grants it, "Not now" turns it down for good. It lets
 * Aski answer Cells, so like an allow it can't be clicked in its first
 * moment, and words never reach it.
 */
export function AutonomyOffer() {
  const kind = useAutonomy()?.offers[0];
  return kind === undefined ? null : <Offer key={kind} kind={kind} />;
}

function Offer(props: { kind: Kind }) {
  const words = KINDS[props.kind];
  const [ready, setReady] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Arm the read-before-allow timer on mount and clear it on unmount.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), timing("readBeforeAllow"));
    return () => clearTimeout(timer);
  }, []);
  return (
    <section tabIndex={-1} data-stemcells-need="" data-open="" aria-label={`Aski: ${words.ask}`}>
      <header data-need-head="">
        <span data-need-who="">Aski</span>
      </header>
      <p data-need-ask="">{words.ask}</p>
      <p data-need-note="">{words.offer}</p>
      {/* A grant says what it does on every option, not only the lit one. */}
      <div data-need-options="" data-explained="">
        <button
          type="button"
          data-need-option=""
          data-allows=""
          disabled={!ready}
          onClick={() => void setTaking(props.kind, true)}
        >
          <span data-need-option-title="">From now on</span>
          <span data-need-option-consequence="">
            Waits 30 seconds first, with Undo, and tells the Cell to stop and ask you before
            anything final. Settings › Aski turns it off.
          </span>
        </button>
        <button type="button" data-need-option="" onClick={() => void setTaking(props.kind, false)}>
          <span data-need-option-title="">Not now</span>
          <span data-need-option-consequence="">Aski doesn't offer it again.</span>
        </button>
      </div>
    </section>
  );
}

/**
 * A card Aski is about to take: what it will do, Undo, and the fuse to when
 * it goes. Keyed on the window by its caller: a window that starts again (a
 * wake) draws a fresh fuse.
 */
export function TakingFuse(props: {
  kind: Kind;
  from: string;
  at: string;
  onUndo: () => Promise<boolean>;
}) {
  const from = Date.parse(props.from);
  const length = Math.max(0, Date.parse(props.at) - from);
  // Read once: the fuse runs on from where it was when the card first showed
  // it, or stays full until a window that starts later (after a wake) begins.
  const [elapsed] = useState(() => Math.min(length, Date.now() - from));
  const [unheard, setUnheard] = useState(false);
  return (
    <div data-need-held="">
      <div data-need-held-row="">
        <span data-need-held-what="">
          {unheard ? "Undo didn't reach this Mac. Try again." : KINDS[props.kind].taking}
        </span>
        <button
          type="button"
          onClick={() => void props.onUndo().then((heard) => setUnheard(!heard))}
        >
          Undo
        </button>
      </div>
      <div data-need-fuse="">
        <i style={{ animationDuration: `${length}ms`, animationDelay: `${-elapsed}ms` }} />
      </div>
    </div>
  );
}
