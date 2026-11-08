// Replaces `@t3tools/client-runtime/thread-reference` (`substitutes.cjs`): Copy Cell, from a Cell's
// card and a hardware keyboard's shortcut, copies the Cell's name and its own link, never
// a link through T3's hosted app, and says so in Cell words (`stemcells/words/copyCell.ts`). A
// Cell with a pull request still copies the pull request's link.
import * as Upstream from "@t3tools/client-runtime/thread-reference";
import { formatThreadLink } from "@t3tools/shared/threadLinks";

import { COPY_CELL } from "../../../../../../stemcells/words/copyCell.ts";

export * from "@t3tools/client-runtime/thread-reference";

export const threadChipCopyTarget: typeof Upstream.threadChipCopyTarget = (threadRef, title) => ({
  ...Upstream.threadChipCopyTarget(threadRef, title),
  value: formatThreadLink(threadRef, title),
  clipboardTarget: COPY_CELL.target,
  successTitle: COPY_CELL.copied,
  failureTitle: COPY_CELL.failed,
});

export const resolveThreadReferenceCopyTarget: typeof Upstream.resolveThreadReferenceCopyTarget = (
  input,
) => {
  const target = Upstream.resolveThreadReferenceCopyTarget(input);
  return target?.kind === "thread" ? threadChipCopyTarget(input.threadRef, input.title) : target;
};
