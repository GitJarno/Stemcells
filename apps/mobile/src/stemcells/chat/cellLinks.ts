// Another Cell named in a chat's words, on the phone (stemcells/tasks/cell-tokens.md): its name
// becomes upstream's thread link, which a tap already opens (pushed, or beside on a wide screen),
// drawn as a pill in the Cell tone.
import { linkCellNames } from "../../../../../stemcells/words/cellNames.ts";
import { WORKING } from "../tokens";

const PREFIX = "t3-thread://v2/";

/** Upstream's thread link to a chat on a server (`packages/shared/src/threadLinks.ts`). */
export function cellHref(environmentId: string, threadId: string): string {
  return `${PREFIX}${environmentId}/${threadId}`;
}

/** The words with each Cell in `names` written as its thread link. */
export function linkCells(
  markdown: string,
  environmentId: string,
  names: ReadonlyMap<string, string>,
): string {
  return linkCellNames(markdown, names, (threadId) => cellHref(environmentId, threadId));
}

/** A named Cell's pill: its name in the Cell tone. Undefined for any other link. */
export function cellPill(
  href: string,
  environmentId: string,
  names: ReadonlyMap<string, string>,
): { readonly label: string; readonly chip: { accent: string; tintsIcon: boolean } } | undefined {
  if (!href.startsWith(PREFIX)) return undefined;
  for (const [name, threadId] of names) {
    if (href === cellHref(environmentId, threadId))
      return { label: name, chip: { accent: WORKING, tintsIcon: true } };
  }
  return undefined;
}
