/**
 * The Cells a question found as one line of Markdown: each its thread link, which a client
 * draws as the Cell's pill, then how many more matched. For a view that draws replies and
 * can't hold a row of its own (the phone's feed). Pure, and the phone runs it.
 */
import type { RecallAnswer } from "./card.ts";

export function pillsMarkdown(answer: RecallAnswer): string {
  if (answer.cards.length === 0) return "";
  const links = answer.cards.map((card) => card.link).join("  ");
  return answer.more > 0 ? `${links}  and ${answer.more} more` : links;
}
