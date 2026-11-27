// @effect-diagnostics globalDate:off - a day is the machine's own calendar's, as the person reads it.
/**
 * The cards a question found, in words for Aski (`stemcells_recall`): one Cell a line, linked,
 * with what was asked, what came of it and what shows it. A digest (no free words) goes by
 * day, newest first; a search stays in the order of its matches. Pure.
 */
import type { RecallAnswer, RecallCard } from "../../../../../stemcells/recall/card.ts";
import { clip, facts, LANDED } from "../needs/standing.ts";
import type { Proof } from "../needs/verdict.ts";

/** A local day and time as Aski passes them on: "2026-11-25" and "14:05". */
function dayOf(at: string): string {
  const date = new Date(at);
  const two = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

const when = (card: RecallCard) => card.landedAt ?? card.bornAt;

function lineOf(card: RecallCard, dated: boolean): string {
  const stage = card.flying ? "flying" : card.awake ? "awake" : "asleep";
  const landed = card.verdict === null || card.proof === null ? [] : [LANDED[card.proof as Proof]];
  const shown = facts({
    goal: null,
    changed: card.changed,
    checks: card.checks,
    pullRequest: card.pullRequest === null ? null : { ...card.pullRequest, conflicts: false },
  });
  const first = card.asked[0];
  const latest = card.asked.length > 1 ? card.asked.at(-1) : undefined;
  return [
    `${card.link} · ${card.project || card.projectId} · ${stage}${dated ? ` · ${dayOf(when(card))}` : ""}`,
    ...(first === undefined ? [] : [`  asked: ${clip(first)}`]),
    ...(latest === undefined ? [] : [`  asked last: ${clip(latest)}`]),
    `  came of it: ${[card.line === null ? "it wrote no close-out" : clip(card.line), ...landed, ...shown].join(" · ")}`,
  ].join("\n");
}

export function reportOf(answer: RecallAnswer): string {
  const { cards, more, read } = answer;
  const searched = [
    ...(read.words.length === 0 ? [] : [`words: ${read.words.join(" ")}`]),
    ...(read.project === null ? [] : [`project: ${read.project.title}`]),
    ...(read.from === null && read.to === null
      ? []
      : [
          `time: ${read.from === null ? "…" : dayOf(read.from)} to ${read.to === null ? "…" : dayOf(read.to)}`,
        ]),
  ].join(" · ");
  if (cards.length === 0) {
    return `No Cell matched (${searched || "nothing to search by: name a time, a project or a word"}).`;
  }
  const lines = [
    `${cards.length} ${cards.length === 1 ? "Cell" : "Cells"} matched (${searched})${more > 0 ? `, and ${more} more not shown` : ""}:`,
  ];
  if (read.widened) {
    lines.push("None matched in the time named; these matched at other times.");
  }
  if (read.words.length > 0) {
    for (const card of cards) lines.push(lineOf(card, true));
    return lines.join("\n");
  }
  let day = "";
  for (const card of [...cards].sort((a, b) => when(b).localeCompare(when(a)))) {
    if (dayOf(when(card)) !== day) {
      day = dayOf(when(card));
      lines.push("", `${day}:`);
    }
    lines.push(lineOf(card, false));
  }
  return lines.join("\n");
}
