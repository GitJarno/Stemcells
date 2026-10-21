/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (words.css), outside upstream's Tailwind entry. */
import type { Readout as ReadoutData, ReadoutWord } from "./cells";
import type { Span } from "./text";

/**
 * What Send will do when the words start several Cells (decision 10): one
 * sentence of tokens, the words read back, in place of the model and
 * effort pickers. A word you typed wears its plate and opens its menu; a
 * default is dim. Past the most Cells, the count wears the warning edge
 * and says so.
 */
export function Readout(props: {
  readonly readout: ReadoutData;
  /** A token was clicked: the word it reads back, and where it is on screen. */
  readonly onWord: (mark: Span, at: DOMRect) => void;
}) {
  const { readout, onWord } = props;
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
  return (
    <div className="sc-readout" data-stemcells-readout="">
      <span className="sc-readout-total" data-over={readout.over ? "" : undefined}>
        {readout.total} Cells
      </span>
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
      {readout.over ? (
        <span className="sc-readout-warning">
          {" "}
          · {readout.total} is over your {readout.most} · ⌘↵ sends
        </span>
      ) : null}
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
