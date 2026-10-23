/**
 * Which risky sentences need the person's yes before Cells start
 * (stemcells/tasks/prompting.md, decision 17): one a Cell's prompt asks
 * for that the person's own words don't, word for word and in the same
 * polarity. Typed words that reach a Cell as typed pass: the Cell's own
 * permission mode is the guard there. Ported from the Swift app's
 * `RiskHold`; Stemcells has no dictation yet, so a sentence heard by the
 * ear isn't asked about here.
 */
import { type RiskFinding, type RiskKind, type RiskSpan, riskFindings } from "./floor";

/** A risky sentence as a Cell would read it, its trigger marked. */
export interface HoldLine {
  readonly sentence: string;
  /** Where the trigger stands in `sentence`. */
  readonly trigger: RiskSpan;
  readonly kind: RiskKind;
  /** The prompt it stands in, by its index in `briefs`. */
  readonly brief: number;
}

/**
 * The lines to ask about: each risky act in `briefs` (each Cell's prompt)
 * that `words` (what the person wrote, and anything they attached as text)
 * don't ask for in the same words, once per clause.
 */
export function holdLines(words: readonly string[], briefs: readonly string[]): HoldLine[] {
  const said = words.flatMap((text) =>
    riskFindings(text)
      .filter((finding) => !finding.negated)
      .map((finding) => ({
        trigger: norm(text.slice(finding.start, finding.end)),
        sentence: norm(text.slice(finding.sentence.start, finding.sentence.end)),
      })),
  );
  const out: HoldLine[] = [];
  const seen = new Set<string>();
  briefs.forEach((brief, index) => {
    for (const finding of riskFindings(brief)) {
      if (finding.negated) continue;
      const trigger = norm(brief.slice(finding.start, finding.end));
      const clause = norm(clauseOf(finding, brief));
      const verbatim = said.some(
        (one) => same(one.trigger, trigger) && contains(one.sentence, clause),
      );
      if (verbatim || seen.has(clause.join(" "))) continue;
      seen.add(clause.join(" "));
      const { start } = finding.sentence;
      out.push({
        sentence: brief.slice(start, finding.sentence.end),
        trigger: { start: finding.start - start, end: finding.end - start },
        kind: finding.kind,
        brief: index,
      });
    }
  });
  return out;
}

/** Lowercased words, punctuation and apostrophes shed: "Force-push the fix!" reads as "force push the fix". */
function norm(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((word, i) => word === b[i]);
}

/** `needle` stands in `hay`, its words together. */
function contains(hay: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0) return true;
  for (let i = 0; i + needle.length <= hay.length; i++)
    if (needle.every((word, j) => hay[i + j] === word)) return true;
  return false;
}

/**
 * The trigger's clause: from the last comma, colon, semicolon or dash
 * before it to the next one after it, inside its sentence, so "Your part:
 * force push the fix" is compared as "force push the fix".
 */
function clauseOf(finding: RiskFinding, text: string): string {
  const mark = /[,:;–—]/;
  let start = finding.start;
  while (start > finding.sentence.start && !mark.test(text[start - 1]!)) start--;
  let end = finding.end;
  while (end < finding.sentence.end && !mark.test(text[end]!)) end++;
  return text.slice(start, end);
}
