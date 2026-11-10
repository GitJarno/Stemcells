/**
 * What a run shows, as the spans of one line: lines changed with their bar, then each fact
 * (`facts.ts`). The line around them is its caller's: an ask's card, the board's row, a reply's
 * close-out. A fact that can be seen somewhere is drawn by `renderLink`, else as its words.
 */
import type { ReactNode } from "react";

import type { BarCell, Fact } from "./facts";

export function RunFacts(props: {
  changed: { readonly bar: ReadonlyArray<BarCell>; readonly words: string } | null;
  facts: ReadonlyArray<Fact>;
  renderLink?: (text: string, href: string) => ReactNode;
}) {
  const { changed, facts, renderLink } = props;
  return (
    <>
      {changed === null ? null : (
        <span data-need-fact="">
          {changed.bar.length > 0 ? (
            <span data-need-bar="" aria-hidden="true">
              {changed.bar.map((cell, index) => (
                // oxlint-disable-next-line react/no-array-index-key -- Five cells in a fixed order.
                <i key={index} data-cell={cell} />
              ))}
            </span>
          ) : null}
          {changed.words}
        </span>
      )}
      {facts.map((fact) => (
        <span key={fact.id} data-need-fact="" data-tone={fact.tone}>
          {fact.href === null || renderLink === undefined
            ? fact.text
            : renderLink(fact.text, fact.href)}
        </span>
      ))}
    </>
  );
}
