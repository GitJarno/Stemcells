/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (recall.css), outside upstream's Tailwind entry. */
// The Cells a question about the past found, under the question in Aski's chat: each its pill,
// a link into its chat, there before Aski's own answer arrives (stemcells/tasks/
// aski-orchestrator.md, principle 7: evidence first, prose after).
import { createContext, use } from "react";

import { CellToken } from "../peers/CellToken";
import { useRecall } from "./recall";

import "./recall.css";

/** True inside Aski's pane: only a question put to Aski shows what it found. */
export const RecallScope = createContext(false);

/** A pill names its Cell by its chat's title, cut to a glance. */
const TITLE = 40;
const short = (title: string) =>
  title.length <= TITLE ? title : `${title.slice(0, TITLE - 1).trimEnd()}…`;

export function RecallPills(props: {
  readonly messageId: string;
  readonly text: string;
  /** When the question was sent, in epoch milliseconds. */
  readonly at: number;
}) {
  return use(RecallScope) ? <Pills {...props} /> : null;
}

function Pills(props: { readonly messageId: string; readonly text: string; readonly at: number }) {
  const answer = useRecall(props.messageId, props.text, props.at);
  if (answer === null || answer.cards.length === 0) return null;
  return (
    <div className="sc-recall" data-stemcells-recall="" aria-label="Cells this question found">
      {answer.cards.map((card) => (
        <CellToken
          key={card.threadId}
          environmentId={card.environmentId}
          threadId={card.threadId}
          label={short(card.title)}
        />
      ))}
      {answer.more > 0 ? <span className="sc-recall-more">and {answer.more} more</span> : null}
    </div>
  );
}
