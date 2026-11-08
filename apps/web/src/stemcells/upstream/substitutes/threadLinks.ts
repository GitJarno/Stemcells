// Replaces `@t3tools/shared/threadLinks` (`plugin.ts`): Stemcells has no hosted app, so where
// upstream copies a link through T3's (`app.t3.codes`), a Cell's own `t3-thread://` link stands
// (`stemcells/words/copyCell.ts`). Pasted, it is the Cell's chip; a pasted T3 link still is too.
import * as Upstream from "@t3tools/shared/threadLinks";

export * from "@t3tools/shared/threadLinks";

/** A copied Cell's link: Copy link on a Cell's chip in a phone's message. */
export const hostedThreadLink: typeof Upstream.hostedThreadLink = (ref) =>
  Upstream.formatThreadLink(ref);

/** A copied Cell, its name and link: Copy on a Cell's chip in a message on the web. */
export const formatHostedThreadLink: typeof Upstream.formatHostedThreadLink = (ref, label) =>
  Upstream.formatThreadLink(ref, label);
