/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheets (words.css, answers.css), outside upstream's Tailwind entry. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ShownAnswers } from "./room";

import "./answers.css";

/** Where the whole line opens over the composer, on screen. */
interface Pop {
  readonly left: number;
  readonly bottom: number;
  readonly width: number;
}

/**
 * What Enter does with the words in Aski's composer, one line in the model picker's place
 * (stemcells/tasks/aski-room.md, decision 8): each card's number, Cell and what it gets, then
 * "rest → Aski". Upstream's fitting measures it as the picker; when the row can't hold it, the
 * line ends short and a click opens it whole.
 */
export function AnswersReadout(props: { readonly shown: ShownAnswers }) {
  const { parts, rest } = props.shown;
  const root = useRef<HTMLButtonElement>(null);
  const [pop, setPop] = useState<Pop | null>(null);

  // oxlint-disable-next-line t3code/react-effect-budget -- Close the open popover on Escape or an outside pointerdown; remove the listeners when it closes.
  useEffect(() => {
    if (pop === null) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      const target = event.target as Element | null;
      if (root.current?.contains(target) || target?.closest?.(".sc-answers-pop")) return;
      setPop(null);
    };
    window.addEventListener("keydown", close, true);
    window.addEventListener("pointerdown", close, true);
    return () => {
      window.removeEventListener("keydown", close, true);
      window.removeEventListener("pointerdown", close, true);
    };
  }, [pop]);

  const line = (
    <>
      {parts.map((part, index) => (
        <span key={part.key} className="sc-answers-part">
          {index > 0 ? <span className="sc-answers-sep"> · </span> : null}
          {part.number === null ? null : (
            <>
              <span className="sc-answers-who">
                {part.number} {part.who}
              </span>{" "}
            </>
          )}
          <span className="sc-answers-what" data-tone={part.tone}>
            {part.what}
          </span>
        </span>
      ))}
      {rest ? (
        <span className="sc-answers-part">
          {parts.length > 0 ? <span className="sc-answers-sep"> · </span> : null}
          rest <span className="sc-answers-aski">→ Aski</span>
        </span>
      ) : null}
    </>
  );

  const open = () => {
    const at = root.current;
    const box = at?.closest("[data-chat-composer-footer]")?.getBoundingClientRect();
    const top = at?.getBoundingClientRect().top;
    if (!at || !box || top === undefined) return;
    // Only a line cut short has more to show.
    const label = at.querySelector<HTMLElement>(".sc-readout-sentence");
    if (pop === null && label && label.scrollWidth <= label.clientWidth) return;
    setPop(
      pop === null ? { left: box.left, bottom: window.innerHeight - top, width: box.width } : null,
    );
  };

  return (
    <>
      <button
        ref={root}
        type="button"
        className="sc-readout sc-answers-readout"
        data-stemcells-readout=""
        // Upstream's fitting measures the row's first control by this, and its
        // label by the one below; "true" stays the picker's own.
        data-chat-provider-model-picker=""
        aria-haspopup="dialog"
        aria-expanded={pop !== null}
        // A press here keeps the caret in the composer.
        onMouseDown={(event) => event.preventDefault()}
        onClick={open}
      >
        <span className="sc-readout-sentence" data-chat-provider-model-picker-label="true">
          {line}
        </span>
      </button>
      {pop
        ? createPortal(
            <div
              className="sc-readout-pop sc-answers-pop"
              role="dialog"
              aria-label="What Enter does"
              style={{ left: pop.left, bottom: pop.bottom, width: pop.width }}
            >
              {line}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
