// Another Cell named in a chat's words becomes a link upstream's markdown keeps,
// `[Manatee](t3-context://v1/stemcells-cell/<thread id>)`, which our renderer draws as
// its token (`CellToken.tsx`). Rewriting the text, not the parsed tree, keeps upstream's
// incremental parse while a reply streams. The rules are the phone's too.
import { linkCellNames as linkWith } from "../../../../../stemcells/words/cellNames.ts";

export {
  type MentionChat,
  namesFor,
  signatureOf,
} from "../../../../../stemcells/words/cellNames.ts";

/** The context link's kind for another Cell: `t3-context://v1/stemcells-cell/<threadId>`. */
export const CELL_LINK_KIND = "stemcells-cell";

/** The text with each name in `names` outside code and links written as its Cell's link. */
export function linkCellNames(text: string, names: ReadonlyMap<string, string>): string {
  return linkWith(text, names, (threadId) => `t3-context://v1/${CELL_LINK_KIND}/${threadId}`);
}
