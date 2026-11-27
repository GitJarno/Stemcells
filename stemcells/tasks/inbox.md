# Input, the inbox

The person's goal is to get every blocked Cell going again with the least
thought, then get on with their day. Input becomes that place: a stage that
lists only the Cells waiting on the person, in the same rows as Awake and
Asleep. Going through it is a loop: read the ask, answer, next.

## Decisions

1. **Three stages, one row.** Input · Awake · Asleep. Input is a filter, not
   a new kind of list: the same row, the same light, the same status icon and
   time. An asking Cell is in Input and still in Awake, in its time slot.
2. **A queue, top first.** Input lists the longest waiting first, so the top
   row is always the next one, and the times read as how long each has
   waited.
3. **Entering Input opens the top.** Where the chat stands beside the list
   (the unfolded Duo, an iPad, the Mac), turning to Input opens the top Cell's
   chat. Where the list is the whole screen (the folded Duo, an iPhone),
   nothing opens on its own: the top row is the one to tap.
4. **The chat's ask is the summary.** The ask at the chat's end
   (`the-ask.md`) holds what's needed to decide, and the reply above
   highlights what it came from. Answering takes one act: a button on the
   card, or words in the composer.
5. **Answered, next.** An answer sends at once (`no-undo.md`). The Cell
   leaves Input, its row moving toward Awake with the lists' one motion
   (`sleep-motion.md`); the rows below move up; the new top's chat opens in
   place of the answered one, the composer focused on the Mac, so the next
   answer can start without a click. On the folded Duo and an iPhone the next
   chat replaces the answered one; Back returns to Input.
6. **Progress without words.** The Input count ticks down. The sky's dawn
   (`day-night.md`) brightens a step with each answer.
7. **All clear.** When the last ask is answered, the sun rises into day.
   Input's empty page says so in one line with what it did ("4 Cells flying
   again, in 6 minutes"), and one short fact about stem cells, a different
   one each time. Quiet, once, never in the way.
8. **Not now** puts an ask off as Later does: it leaves Input until its time.
9. **Between stages, only the list changes.** Turning between Input and
   Awake keeps the open chat (except decision 3). Rows in both stages move;
   rows in one enter or leave.
10. **Mac and phone alike.** The same stages, order, loop and moment on both.

## Plan

- [x] `no-undo.md`: answers, Sleep, Sleep until… and Wake act at once, with
      no undo line; deleting keeps its undo
- [x] Input back as a stage on the phone and the Mac, longest waiting first
- [x] Entering Input opens the top chat where a chat stands beside the list
- [x] The loop: answered, the row leaves Input, the next opens
- [x] Progress in the count; the all-clear moment and its facts. The dawn
      and sunrise wait for `day-night.md`, which reads `inbox/sky.ts`
- [x] Words, docs, tests; Aski's `stemcells_show` takes Input again
- [ ] Gates, pull request, merge, seen on the Duo, an iPhone and the Mac

## Review

- One loop for both clients (`apps/web/src/stemcells/inbox/loop.ts`): a Cell
  is answered when its ask leaves Input, however it was answered (a card's
  button, words, another device), so nothing advances twice. The loop opens
  the next only while the person stays on the chat it opened; another chat
  stops it. The Mac opens in the focused pane (a draft or Aski's tab keeps
  theirs, so the chat opens as any does); the phone replaces the chat.
- Refined: an answered row leaves Input with the lists' plain leave, with no
  flight to Awake: it never left Awake, and the column stays calm.
- "N Cells flying again" counts the Cells the clearing went through that
  are awake now; those put off or slept aren't flying.
- The sky (`day-night.md`) reads `useInboxSky()`: `progress` for the dawn's
  steps, `clears` growing for the sunrise. `allClear()` in `inbox/sky.ts` is
  where its `riseSky()` call goes.
