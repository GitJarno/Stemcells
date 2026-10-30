// Another Cell named in a chat's words, on the phone (stemcells/tasks/cell-tokens.md): its name
// becomes upstream's thread link, which a tap already opens (pushed, or beside on a wide screen),
// drawn as a pill: the Cell held still, then its name in the Cell tone.
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

/** The thread ids of the Cells in `names` the (linked) `markdown` links to. */
export function cellsLinked(
  markdown: string,
  environmentId: string,
  names: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  return new Set(
    [...names.values()].filter((threadId) =>
      markdown.includes(`(${cellHref(environmentId, threadId)})`),
    ),
  );
}

/** A named Cell's pill: its still (`stills`, by thread id) and its name. Undefined for any other link. */
export function cellPill(
  href: string,
  environmentId: string,
  names: ReadonlyMap<string, string>,
  stills: ReadonlyMap<string, string>,
):
  | {
      readonly label: string;
      readonly icon?: { readonly uri: string };
      readonly chip: { accent: string; tintsIcon: boolean };
    }
  | undefined {
  if (!href.startsWith(PREFIX)) return undefined;
  for (const [name, threadId] of names) {
    if (href !== cellHref(environmentId, threadId)) continue;
    const still = stills.get(threadId);
    return {
      label: name,
      ...(still === undefined ? {} : { icon: { uri: still } }),
      chip: { accent: WORKING, tintsIcon: false },
    };
  }
  return undefined;
}
