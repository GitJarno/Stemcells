# The ask, in the Cell's chat

A Cell that needs the person asks in its own chat: one bounded card docked above
the composer, with everything needed to decide and nothing more. This is step 1
of two. Step 2 folds the stages to Awake and Asleep with one-line rows and
retires the Input tab; until then the card stands beside it.

## Decisions

1. **One card, docked.** The Cell's oldest open ask (`needs/inChat.ts`,
   `chatAskOf`) sits between the chat and the composer on the Mac and the
   phone. It is not a message in the feed: it stays put while the chat
   scrolls, and leaves when the ask does.
2. **Upstream answers what it already answers.** A pending approval or
   question keeps upstream's own panels over the composer, so nothing is
   asked twice. The card carries what the chat had no place for: a reply's
   ask, a plan to build, a failure, a stall, a limit, a sign-in.
3. **What the card says.** A kicker (needs you · age), a headline in the
   Cell's words, at most the steps and what answering unblocks, then the
   card's own buttons from `cardOf`, the first one primary. No brief, no
   facts list: the chat above is the context.
4. **Where it asked.** A chip jumps to the words the ask quotes
   (`askAnchorOf`) and highlights them: the Mac's citation highlight, the
   phone's message jump. A plan, failure or stall points at the last reply.
5. **Not now** is the existing Later. The composer still answers in words:
   its placeholder says so.
6. **The folded Duo** rests the card as one line (kicker and headline) that
   opens on a tap, so the chat keeps its height. Everywhere else it opens.
7. **The Mac's keys.** With the card shown and the composer empty, Return
   takes the first button and Escape takes Not now.

## Plan

- [x] Shared model: `chatAskOf`, `askAnchorOf`, with tests
- [ ] Mac: the docked card over `CellComposerLine`, jump and highlight, keys
- [ ] Phone: the docked card over the composer, folded Duo's one line, jump
- [ ] Gates, pull request, `check-local`, merge
- [ ] Phone build on the Duo

## Review
