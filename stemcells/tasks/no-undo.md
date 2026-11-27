# No undo for what's easy to take back

An undo line followed every answer, Sleep and Wake, and held each act back
until it went. The person never wants to undo these: a Cell slept by mistake
is one Wake away in Asleep, and an answer is followed by another word in the
chat. The line costs attention every time to save a rare slip that is cheap
to fix anyway.

## Decisions

1. **Act at once.** An answer (a card's button, Later, Nothing to do), Sleep,
   Sleep until… and Wake are sent the moment the person acts, with no undo
   line and no hold, on the phone and the Mac, from every place they're
   offered: rows, swipes, the chat's ask, Aski's room, menus, keys.
2. **Undo stays where it saves something.** Deleting a Cell, or anything
   that loses work, keeps its undo.
3. **Failure still speaks.** If a send fails, the place it came from says so
   (the ask's card, the row), as it does today.
4. **The motion is the feedback.** The row leaves and its Cell flies to its
   new stage's count (`sleep-motion.md`); that is the confirmation.

## Plan

- [x] Find every undo line, notice and toast: ours and T3's (archive,
      settle, snooze and their notices), on both clients
- [x] Act at once; remove the holds and lines that only served undo
- [x] Keep delete's undo; failure feedback in place
- [ ] Tests, docs, gates, pull request, merge

## Review

- Mac: the holds became `needs/answering.ts`, which sends at once and keeps
  what became of each answer for its card (a failed one says why; words read
  from Aski's composer still go back when nothing went). Our substitute of
  upstream's `useThreadActions` lets a settle's and a snooze's undo go as each
  lands, the way upstream drops one a later act supersedes, so no notice,
  announcement or ⌘Z stands. Upstream's own undo test of that hook keeps
  upstream's module. The two seams that added "Answered" to upstream's
  notice are gone.
- Phone: `line/answering.ts` sends at once; a failure shows on the chat's
  card. The `ThreadUndoNotice` substitute draws no notice for a settle or a
  snooze; T3's store still times it out unseen, since no phone surface
  undoes by key.
- Kept: unpin, archive and a discarded draft keep upstream's undo line and
  ⌘Z on the Mac and T3's notice on the phone; a hidden disk notice keeps its
  Undo (`line/takeBack.ts`). Deleting a Cell has no undo upstream, before or
  after. A slept Cell woken within ten seconds still returns to its pane.
