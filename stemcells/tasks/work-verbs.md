# Work verbs: a playful word on the working row

A Cell's working row says a playful verb where upstream said "Working":
"Noodling for 12s" while it works, "Noodled for 3m 12s" once it is done.
Ported from the Swift app: the same table, the same picker, the same rules.

## Plan

- [x] Port the table as data: `apps/web/src/stemcells/verbs/workVerbs.json`,
      generated line for line from the Swift table (present, past, span,
      topics, favourite, topic-only), and the topic keywords
- [x] Port the picker (`workVerbs.ts`): earliest keyword in the first 400
      characters picks the topic, FNV-1a + SplitMix64 roll weighted by
      favourites, a chat never repeats the verb before; its tests, with the
      banned-stem guard
- [x] Read upstream's timeline (`upstream/workVerbs.ts`): which entries start
      a turn; a contract test pins it, and the labels the verbs swap a word in
- [x] One seam in `MessagesTimeline.tsx`: the working row's word and the turn
      fold's label; upstream keeps its row, timer and layout
- [x] Prove it in the dev app: a working row and a finished one
- [ ] Light the word with the composer's sheen on its beat, once that port
      lands (no second clock)

## Decisions

- A turn's seed is its prompt's id. The app makes it before the send and the
  server keeps it, so the word never changes between the echo and the
  settled turn. The Swift app seeded by the chat and the prompt before,
  because its ids changed when a send landed; these don't.
- A turn starts where upstream's does: the person's words, unless they steer
  the running turn, or a notification (general pool).
- Failed turns read plain: upstream folds no failed turn, so there is no
  label to swap. A stopped turn keeps upstream's "You stopped after 3m".
- Screen readers hear upstream's words; the verb is `aria-hidden`.
- No setting yet: upstream's settings would take seams in its schema and its
  panels. It ships on.

## Review

Pending the pull request.
