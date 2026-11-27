# The ask, in the Cell's chat

A Cell that needs the person asks in its own chat: one bounded card at the
chat's end, with everything needed to decide and nothing more, and the words
of its reply it was built from marked where they stand. Step 1 docked the
card over the composer (#179); step 2 retired Input as a stage (#182); step
3 makes the card the chat's last element and the row's vocabulary its own.

## Decisions

1. **One card, the chat's last element.** The Cell's oldest open ask
   (`needs/inChat.ts`, `chatAskOf`) stands right under its last reply on
   the Mac and the phone and scrolls with the chat: a long ask has the room
   a message has, and the reply above is read by scrolling. It leaves when
   the ask does. The Mac draws it first in upstream's timeline footer, from
   our `MessagesTimeline` substitute, whose growth the list follows; the
   phone's feed hands its footer to `withAskAtEnd` (one seam in the hot
   `ThreadFeed.tsx`, raised in its budget), and a substitute of
   `threadFeedEndFollow` keeps the end as the footer grows. It appears as
   a message does, once, and nothing on it moves after.
2. **Upstream answers what it already answers.** A pending approval or
   question keeps upstream's own panels over the composer, so nothing is
   asked twice. The card carries what the chat had no place for: a reply's
   ask, a plan to build, a failure, a stall, a sign-in. A limit keeps
   upstream's own banner.
3. **What the card says.** A kicker in the row's own words: T3's status
   icon for the ask (the question bubble for Input, the shield for an
   approval should one reach the card) in T3's colour, then "Input · 8h" in
   muted ink, as the Cells column and the phone's rows say it
   (`STATUS_WORDS`). No amber. Then a headline in the Cell's words, at most
   three steps and what answering unblocks ("Then …"), and the card's own
   buttons from `cardOf`, the first primary. A step left to the person is
   **Done** ("All done" for several), in Aski's room too. No brief, no
   facts list: the reply above is the context.
4. **What it was built from, marked in the reply.** While the ask is open,
   the reply shows a quiet tint, Input's indigo, on exactly the passages
   the ask quotes (`askPassagesIn`, `askPlaceOf`): the person's steps and
   the asking sentence stronger, the Cell's own next step softer. Each line
   of the card shows its passage on a tap, through upstream's citation
   jump, and wears its tint while the pointer is on it. A line whose words
   the reply doesn't hold jumps nowhere, the headline to the reply's
   opening. The Mac paints with the CSS Custom Highlight API over the
   ranges upstream's citation finder resolves (`upstream/askCitation.ts`):
   upstream's DOM is untouched, the ranges are found once per ask and
   again only when the timeline remounts the reply, never per streamed
   word. The phone's markdown can paint `==marks==` only with its parser
   flag on for the whole reply, which would also mark any `==` a Cell
   writes, so a line there jumps to its reply, and nothing is tinted.
5. **Not now** is the existing Later. The composer still answers in words;
   the phone's placeholder says so (the Mac's lives in a hot upstream file).
6. **The folded Duo shows it whole.** At the chat's end the card takes no
   height from the chat, so it opens on every phone, as a message does.
7. **No key.** Return on an empty composer took the card's first button
   while the card stood over it. At the chat's end the card can be
   scrolled out of sight, and a key that answers what isn't seen is a
   surprise, so the composer's keys are its own again.
8. **The "?" over an asking Cell is gone.** The row's icon says it. Where
   the Cell is drawn with no row beside it (a tab, a pane's ledge or pill,
   the phone's chat header), the same icon in the same colour stands
   beside its name while it asks (`CellAskIcon`, `CellAskSymbol`).

## Plan

- [x] Shared model: `chatAskOf`, `askAnchorOf`, with tests
- [x] Mac: the docked card over `CellComposerLine`, jump and highlight, keys
- [x] Phone: the docked card over the composer, folded Duo's one line, jump
- [x] Gates, pull request, `check-local`, merge (#179)
- [x] Phone build on the Duo
- [x] Step 2: Input retires as a stage on the Mac, the phone and Aski's
      `stemcells_show`; Awake and Asleep remain. Finding asks: amber Awake
      rows, the app icon's count, "Next ask · N" in Aski's menu, and on the
      Mac Aski's room, which keeps every ask
- [x] Step 2: gates, pull request, merge (#182)
- [x] Step 3: shared model: the passages an ask quotes (`askPassagesIn`,
      `askPlaceOf`), with a table test
- [x] Step 3, Mac: the card at the timeline's end, highlights in the
      reply, lines that jump, the row's icon and words, no key
- [x] Step 3, phone: the card at the feed's end, lines that jump to the
      reply, the row's symbol and words, no fold
- [x] Step 3: the "?" retired on both; the row's icon in tabs, a pane's
      ledge and pill, and the phone's chat header
- [ ] Step 3: gates, pull request, merge
- [ ] Duo build of steps 2 and 3

## Review

- Step 1 shipped in #179. The lab found the card see-through and Escape
  swallowed by the editor; both fixed before merge, and Escape left to the
  composer, which already uses it on an empty draft. A review found two
  per-token costs (the anchor scan, the phone's re-reads); both now key on
  what moves when a turn starts or ends.
- Step 2 removes about 1,600 lines: the column's and the phone's Input
  pages, the queued card, the phone's ask cards beside the docked one, and
  their tests. The phone loses answering without opening a chat; its badge
  and Aski's "Next ask" lead to the chat, where the card answers.
