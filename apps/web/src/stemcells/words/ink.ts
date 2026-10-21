/**
 * What the composer inks, from the reader's facts: each word that set
 * something up wears a token plate, and a project only mentioned gets a
 * quiet underline. Only the winner is inked: a place that lost to the
 * address is a mention, never a second plate. `stemcells/tasks/prompting.md`,
 * decision 4.
 */

import type { Facts } from "./read";
import { SPAWN_NOUNS, type Span } from "./text";

export type InkKind = "place" | "model" | "effort" | "count" | "quiet" | "cell";

export interface InkMark extends Span {
  readonly kind: InkKind;
  /** A model whose provider can't take a Cell now (not signed in, not ready). */
  readonly warn: boolean;
}

/** `ready` says whether a provider can start a Cell now. */
export function inkOf(facts: Facts, ready: (providerId: string) => boolean): InkMark[] {
  const marks: InkMark[] = [];
  const add = (span: Span, kind: InkKind, warn = false) =>
    marks.push({ start: span.start, end: span.end, kind, warn });
  const between = (a: number, b: number) => facts.text.slice(Math.min(a, b), Math.max(a, b));

  for (const h of facts.routing) add(h, "place");
  for (const m of facts.models) {
    const warn = !ready(m.form.provider.id);
    const count = m.countToken;
    // "2 Sol" and "Sol ×2" are one plate; "3 Cells on Sol" is two: the
    // count with its noun, and the model.
    if (count === null) add(m, "model", warn);
    else if (/^\s*$/.test(between(count.end, m.start)) || /^\s*$/.test(between(m.end, count.start)))
      add(
        { start: Math.min(m.start, count.start), end: Math.max(m.end, count.end) },
        "model",
        warn,
      );
    else {
      const noun = facts.tokens.find((t) => t.start > count.end && !t.literal);
      const end =
        noun && SPAWN_NOUNS.has(noun.norm) && /^\s*$/.test(between(count.end, noun.start))
          ? noun.end
          : count.end;
      add({ start: count.start, end }, "count");
      add(m, "model", warn);
    }
  }
  for (const e of facts.efforts) add(e, "effort");
  for (const c of facts.counts) add(c, "count");
  for (const q of facts.quiet) add(q, "quiet");
  if (facts.cell) add(facts.cell, "cell");

  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: InkMark[] = [];
  for (const m of marks) if (!kept.some((k) => k.start < m.end && m.start < k.end)) kept.push(m);
  return kept;
}
