/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (words.css), outside upstream's Tailwind entry. */
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useMinute } from "../rail/clock";
import { useLimitPools } from "../upstream/rail";
import { observeResize, rowHoldsWider } from "../upstream/words";

import { placesOf, type Readout as ReadoutData, type ReadoutWord } from "./cells";
import { limitNotes } from "./limits";
import type { Span } from "./text";

/** Where the full sentence opens over a folded readout, on screen. */
interface Pop {
  readonly left: number;
  readonly bottom: number;
  readonly width: number;
}

/**
 * What Send will do when the words start several Cells (decision 10): one
 * sentence of tokens, the words read back, standing in the model picker's
 * place in the controls row (`readoutSlot.ts`). A word you typed wears its
 * plate and opens its menu; a default is dim. Past the most Cells, the
 * count wears the warning edge and says so; so does a message whose Cells
 * only the planner could share the work out to, which holds. A provider
 * whose plan runs short says so too.
 *
 * Upstream's fitting measures it as it measures the picker. The whole
 * sentence shows when the row holds it beside every other control at full
 * size; otherwise it folds to "3 Cells · Harbor, Atlas ▾", which opens it
 * whole (decision 18), and the fold is what upstream fits: the row's other
 * controls go small only when even the fold doesn't fit. A warning and a
 * plan's note stay in the fold, after the places; cut short, a plan's tone
 * stays on the caret. The count never goes.
 */
export function Readout(props: {
  readonly readout: ReadoutData;
  /** The providers the Cells start on, as drivers. */
  readonly drivers: readonly string[];
  /** A token was clicked: the word it reads back, and where it is on screen. */
  readonly onWord: (mark: Span, at: DOMRect) => void;
}) {
  const { readout, onWord } = props;
  const now = useMinute();
  const short = limitNotes(props.drivers, useLimitPools(now), now);
  // The worst of them, which the fold's caret wears.
  const tone = short.some((note) => note.tone === "out") ? "out" : short[0]?.tone;
  const notes = short.map((note) => (
    <span key={note.text}>
      {" · "}
      <span className="sc-readout-limit" data-tone={note.tone}>
        {note.text}
      </span>
    </span>
  ));

  const root = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const sentence = useRef<HTMLSpanElement>(null);
  const places = useRef<HTMLSpanElement>(null);
  const [folded, setFolded] = useState(false);
  const [pop, setPop] = useState<Pop | null>(null);
  const shown = folded ? pop : null;

  // Folded while the row can't hold the whole sentence (folded, the sentence
  // is measured unseen), and never narrower than its count.
  const fit = useEffectEvent(() => {
    const at = root.current;
    const whole = sentence.current;
    const count = head.current;
    if (!at || !whole || !count) return;
    at.style.setProperty("--sc-readout-least", `${count.offsetWidth}px`);
    const label = places.current ?? whole;
    const natural = at.getBoundingClientRect().width + label.scrollWidth - label.clientWidth;
    const wider = count.offsetWidth + whole.scrollWidth - natural;
    // A pixel of slack to unfold, as upstream's fitting has to promote.
    const holds = rowHoldsWider(at, wider + (folded ? 1 : 0));
    setFolded(!holds);
    if (holds) setPop(null);
  });
  useLayoutEffect(() => {
    const at = root.current;
    const row = at?.parentElement;
    if (!at || !row) return;
    // The row, and the controls beside it, as they change size.
    return observeResize([at, row, ...row.querySelectorAll("[data-resting-block]")], () => fit());
  }, []);
  // The words changed: the sentence may be longer or shorter now.
  useLayoutEffect(() => fit());

  // The sentence closes on Esc and on a press outside it (a token's menu
  // counts as inside, and takes Esc first).
  useEffect(() => {
    if (shown === null) return;
    const close = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(".sc-word-menu")) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape" || document.querySelector(".sc-word-menu")) return;
      } else if (root.current?.contains(target) || target?.closest?.(".sc-readout-pop")) return;
      setPop(null);
    };
    window.addEventListener("keydown", close, true);
    window.addEventListener("pointerdown", close, true);
    return () => {
      window.removeEventListener("keydown", close, true);
      window.removeEventListener("pointerdown", close, true);
    };
  }, [shown]);

  const word = (part: ReadoutWord) =>
    part.mark === null ? (
      <span className="sc-readout-default">{part.text}</span>
    ) : (
      <button
        type="button"
        tabIndex={-1}
        className={`sc-word sc-word-${part.mark.kind}`}
        // A press here keeps the caret where it is.
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => onWord(part.mark!, event.currentTarget.getBoundingClientRect())}
      >
        {part.text}
      </button>
    );
  const total = (
    <span className="sc-readout-total" data-over={readout.over ? "" : undefined}>
      {readout.total} Cells
    </span>
  );
  // What holds the send: it stays in the fold too, as the notes do.
  const warning = readout.held ? (
    <span className="sc-readout-warning"> · say what each Cell does</span>
  ) : readout.over ? (
    <span className="sc-readout-warning">
      {" "}
      · {readout.total} is over your {readout.most} · ⌘↵ sends
    </span>
  ) : null;
  const rest = (
    <>
      {": "}
      {readout.groups.map((group, index) => (
        <span key={keyOf(group, index)}>
          {index > 0 ? ", " : null}
          {group.count ? (
            <>
              {word(group.count)}
              {group.model ? " " : null}
            </>
          ) : null}
          {group.model ? word(group.model) : null}
          {group.effort ? <> at {word(group.effort)}</> : null}
          {group.place ? (
            <>
              {group.count || group.model || group.effort ? " in " : null}
              {word(group.place)}
            </>
          ) : null}
        </span>
      ))}
      {readout.share ? <span className="sc-readout-share"> · {readout.share}</span> : null}
      {warning}
      {notes}
    </>
  );
  // The whole sentence opens over the composer's box, as wide as it.
  const open = () => {
    const at = root.current;
    const box = at?.closest("[data-chat-composer-footer]")?.getBoundingClientRect();
    const top = at?.getBoundingClientRect().top;
    if (!box || top === undefined) return;
    setPop((last) =>
      last === null ? { left: box.left, bottom: window.innerHeight - top, width: box.width } : null,
    );
  };
  return (
    <div
      ref={root}
      className="sc-readout"
      data-stemcells-readout=""
      // Upstream's fitting measures the row's first control by this, and
      // its label by the one below; "true" stays the picker's own.
      data-chat-provider-model-picker=""
      data-folded={folded ? "" : undefined}
    >
      <span ref={head} className="sc-readout-head">
        {total}
      </span>
      {folded ? (
        <button
          type="button"
          className="sc-readout-fold"
          aria-haspopup="dialog"
          aria-expanded={shown !== null}
          data-tone={tone}
          onMouseDown={(event) => event.preventDefault()}
          onClick={open}
        >
          <span
            ref={places}
            className="sc-readout-places"
            data-chat-provider-model-picker-label="true"
          >
            {/* A no-break space: a space leading the label would be lost. */}
            {"\u00a0· "}
            {placesOf(readout).join(", ")}
            {warning}
            {notes}
          </span>
          <ChevronDownIcon className="sc-readout-caret" aria-hidden="true" />
        </button>
      ) : null}
      <span
        ref={sentence}
        className="sc-readout-sentence"
        data-chat-provider-model-picker-label={folded ? undefined : "true"}
        aria-hidden={folded || undefined}
        inert={folded || undefined}
      >
        {rest}
      </span>
      {shown
        ? createPortal(
            <div
              className="sc-readout-pop"
              role="dialog"
              aria-label="What Send starts"
              style={{ left: shown.left, bottom: shown.bottom, width: shown.width }}
            >
              {total}
              {rest}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * A group reads back where its words are, so its key is where they stand:
 * a list's places share their model's words, so the place tells them apart.
 */
function keyOf(group: ReadoutData["groups"][number], index: number): string {
  const words = [group.count, group.model, group.effort, group.place];
  if (!words.some((w) => w?.mark)) return `default-${index}`;
  return `at-${words.map((w) => w?.mark?.start ?? "").join(":")}`;
}
