/**
 * A question's option previews (stemcells/tasks/question-previews.md): what an option shows
 * before the person chooses it. Plain TypeScript, as the phone bundles it too
 * (`apps/mobile/src/stemcells/previews/kit.ts`).
 */

/** How a preview is drawn: an agent's own markdown, or its text exactly as written. */
export type Preview =
  | { readonly as: "markdown"; readonly text: string }
  | { readonly as: "written"; readonly text: string };

/** A code fence opening a line, as markdown reads one. */
const FENCE = /^ {0,3}(?:`{3,}|~{3,})/m;

/**
 * Null for no preview. One with a fence is the agent's markdown. One with none is a mockup, a
 * snippet or a config: markdown would run its lines together, drop their indents and read a
 * rule of dashes as a heading, so it is drawn as written.
 */
export function previewOf(preview: string | null | undefined): Preview | null {
  // Blank lines around it go; the first line's own indent stays.
  const text = (preview ?? "").replace(/^(?:[^\S\n]*\n)+/, "").trimEnd();
  if (text.trim() === "") return null;
  return { as: FENCE.test(text) ? "markdown" : "written", text };
}

/** Each option's preview, in the options' order; null when no option has one. */
export function previewsOf(
  options: ReadonlyArray<{ readonly preview?: string | null | undefined }>,
): ReadonlyArray<Preview | null> | null {
  const previews = options.map((option) => previewOf(option.preview));
  return previews.some((preview) => preview !== null) ? previews : null;
}

/** The option the person last pointed at or focused, in one question. */
export interface Highlight {
  readonly questionId: string;
  readonly index: number;
}

/**
 * Whose preview shows: the highlighted option of this question, else the first option that
 * has one. A highlight from another question, or past the options, counts for nothing.
 */
export function shownOf(
  previews: ReadonlyArray<Preview | null>,
  questionId: string,
  highlight: Highlight | null,
): number {
  if (
    highlight !== null &&
    highlight.questionId === questionId &&
    highlight.index >= 0 &&
    highlight.index < previews.length
  )
    return highlight.index;
  return Math.max(
    0,
    previews.findIndex((preview) => preview !== null),
  );
}
