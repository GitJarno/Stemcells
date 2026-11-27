import { asBuilt } from "../../../../../stemcells/words/cells.ts";

/**
 * The title upstream gives a thread it has nothing to name it by: a draft
 * before it is sent, or a first message with no words in it. Pinned by
 * `titles.contract.test.ts`.
 */
export const UNTITLED_THREAD = "New thread";

/**
 * Whether `title` is that one, as upstream wrote it or as a build says it
 * ("New Cell", `stemcells/brand/cellWords.ts`): a Cell keeps the title it got.
 */
export const isUntitled = (title: string): boolean => asBuilt(title) === asBuilt(UNTITLED_THREAD);
