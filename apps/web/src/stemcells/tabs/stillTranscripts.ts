/**
 * A long chat re-wraps in more than a frame, so while a border between Cells is held, or a row
 * glides to even, the transcripts beside it keep their width and lanes (`workspace.css`) and the
 * border slides over them; they take the new width once, when it rests or is let go. The
 * composers follow the borders all along.
 */
const TRANSCRIPT = "[data-stemcells-pane] [data-chat-canvas] .messages-timeline-scroll";

/** A transcript as it stands: its width and its lanes' padding. */
interface Held {
  readonly transcript: HTMLElement;
  readonly width: number;
  readonly start: string;
  readonly end: string;
}

/**
 * What each border holds still, so it lets go of the same Cells: a border
 * gone from the page (its Cell closed mid-drag) has no siblings to find.
 */
const holding = new WeakMap<HTMLElement, ReadonlyArray<HTMLElement>>();

export function holdTranscriptsStill(
  separator: HTMLElement,
  still: boolean,
  scope: "pair" | "row",
): void {
  const sides = (
    scope === "pair"
      ? [separator.previousElementSibling, separator.nextElementSibling]
      : [...(separator.parentElement?.children ?? [])].filter((child) => child !== separator)
  ).filter(
    (side): side is HTMLElement =>
      side instanceof HTMLElement && !side.hasAttribute("data-stemcells-split"),
  );
  if (!still) {
    // A chat read to its end stays there as it re-wraps: its pane holds
    // the end for a while after its width changes (`keepEnd.ts`).
    for (const side of [...(holding.get(separator) ?? []), ...sides]) {
      side.removeAttribute("data-stemcells-still");
    }
    holding.delete(separator);
    return;
  }
  holding.set(separator, [...(holding.get(separator) ?? []), ...sides]);
  // Every transcript is read before any is written, so holding them takes
  // one layout. Their custom properties don't inherit (`workspace.css`):
  // set on a transcript, they restyle it alone, not each row in it.
  const held = sides.map((side) =>
    [...side.querySelectorAll<HTMLElement>(TRANSCRIPT)].map((transcript): Held => {
      const style = getComputedStyle(transcript);
      return {
        transcript,
        width: transcript.offsetWidth,
        start: style.paddingInlineStart,
        end: style.paddingInlineEnd,
      };
    }),
  );
  const anchors = scope === "pair" ? (["before", "after"] as const) : evenAnchors(sides);
  sides.forEach((side, index) => {
    for (const { transcript, width, start, end } of held[index]!) {
      transcript.style.setProperty("--sc-still-width", `${width}px`);
      transcript.style.setProperty("--sc-still-start", start);
      transcript.style.setProperty("--sc-still-end", end);
    }
    side.setAttribute("data-stemcells-still", anchors[index] ?? "before");
  });
}

/**
 * Which edge each Cell's transcript keeps to while it moves: the one that moves less, so the text
 * stays put. Beside a dragged border, the edge away from it ("before" for the Cell before it,
 * "after" for the one after); in a row gliding to even, the edge nearer where it lands.
 */
export function evenAnchors(
  sides: ReadonlyArray<{ readonly offsetWidth: number }>,
): Array<"before" | "after"> {
  const lengths = sides.map((side) => side.offsetWidth);
  const even = lengths.reduce((sum, length) => sum + length, 0) / Math.max(1, lengths.length);
  let start = 0;
  return lengths.map((length, index) => {
    const startMoves = Math.abs(start - index * even);
    const endMoves = Math.abs(start + length - (index + 1) * even);
    start += length;
    return endMoves < startMoves ? "after" : "before";
  });
}
