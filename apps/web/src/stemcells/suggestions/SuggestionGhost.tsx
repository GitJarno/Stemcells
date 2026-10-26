import { createPortal } from "react-dom";

import { cn } from "../upstream/ui";
import { Kbd } from "../upstream/suggestions";

/**
 * The suggestion where the composer's placeholder stands, in its place and
 * its look, with the key that takes it after the words: Tab where there is
 * a keyboard, a tap where there isn't. Drawn into the editor's own box,
 * over upstream's placeholder, which stays for screen readers.
 */
export function SuggestionGhost(props: {
  readonly host: HTMLElement;
  readonly text: string;
  /** Upstream's placeholder classes for this composer: its resting line, say. */
  readonly className: string | undefined;
  readonly onTake: () => void;
}) {
  return createPortal(
    <div
      aria-hidden
      data-stemcells-suggestion=""
      className={cn(
        "pointer-events-none absolute inset-0 leading-relaxed text-placeholder",
        props.className,
      )}
    >
      {props.text}
      <button
        type="button"
        tabIndex={-1}
        // A margin, not a space: the resting composer lays its placeholder out as a row.
        className="pointer-events-auto ms-1.5 inline-flex shrink-0 align-middle"
        // Keeps the caret in the composer: a click takes the words, not the focus.
        onPointerDown={(event) => event.preventDefault()}
        onClick={props.onTake}
      >
        <Kbd>
          <span className="pointer-coarse:hidden">Tab</span>
          <span className="hidden pointer-coarse:inline">Use</span>
        </Kbd>
      </button>
    </div>,
    props.host,
  );
}
