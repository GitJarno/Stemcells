# The close-out, drawn as a card

Every Cell ends a reply with a close-out: `**Done:** …`, or `**Left:**` with
a line per owner (`you`, `me`, `waiting`). The server already reads it to
place the Cell in a stage. The person still read it as bold text at the foot
of a long reply. It is state, not prose: where the work stands and who owns
the next step. State reads faster drawn.

## Decisions

1. **One reader.** The parser and its pre-read moved from the server to
   `stemcells/closeOut/`, and the server imports them from there, its tests
   unchanged. A view asks `writtenCloseOut(reply)`: every line of the
   close-out in the order written, the reply before its last line, what
   follows it, and the lines as the Cell wrote them. It reads none exactly
   where `readCloseOut` reads none, so a view and the server never disagree
   on whether a reply has one.
2. **Nothing is hidden.** The server ranks a close-out down to the step
   that matters most. The card ranks nothing away: a Done beside a Left,
   every owner's line, and a Left that says "nothing" all show. An offer of
   more work after the close-out stays the reply's own text under the card.
3. **Only a settled assistant reply.** Upstream's markdown view draws the
   person's messages, plans, work entries and need cards too, and is told
   neither a role nor a message. A substitute for
   `TimelineAssistantRows.tsx` puts a context round upstream's
   `AssistantTimelineRow` (the reply's settled text, its run, whether it is
   the run's last reply), and our markdown substitute draws a card only for
   the markdown whose text is that reply's and is not streaming. Anything
   else, and a reply the reader finds no close-out in, shows as written.
   That file is calm upstream (6 commits in 90 days); `ChatMarkdown.tsx` is
   hot and unchanged. No DOM is read to tell a reply.
4. **The Cell's word above, the records below.** On the Cell's latest reply
   alone, and only when the server sent them, a foot under a hairline says
   how it landed (`VERDICTS`) and what its run shows (`factsOf`, `barOf`,
   `changedWords`), in the room's own marks and inks. An older reply gets
   the card with no foot: the records describe the latest run only. The
   rule above the foot is the point: what the Cell says, then what shows it.
5. **The look.** The label sits in the card's hairline, as a field's does;
   no fill, no icons, the reply's own type. `you` takes the composer's
   warmth (the needs-you ink, a faint wash, the card's edge); a Left with no
   owner word does too, as the server makes it the person's. `me` is the
   reply's ink, `waiting` the dim one. Nothing animates. The owner's word
   keeps a margin of its own in a 370 px pane, the narrowest captured.
6. **Copied, it is the Cell's lines.** The reply's copy button copies the
   message, as before. A selection that takes in the card copies
   `**Done:** …` or `**Left:**` and its lines as written (upstream's
   `data-markdown-copy`); one inside a single line's words copies those
   words.
7. **Read once.** A transcript mounts a reply again each time it scrolls
   into view, so a reply's close-out is read once per text and kept for the
   last 256. Only the latest reply's foot listens to the server's list.

## The phone: not in this slice

Our substitute for `SelectableMarkdownText` is handed one segment of a
reply (a reply is split at folds and artifact cards), with no role, no
message and no word on whether it still streams. The one tell, that the
assistant's call site passes no `preserveSoftBreaks`, is a guess, and
"while it streams" has none at all. Knowing it needs a line in
`ThreadFeed.tsx`, which is hot. So the phone shows a close-out as it did.
The reader is shared and uses nothing a phone's engine lacks, so the
phone's card needs only that one fact.

## Slices

- [x] 1. One reader: the parser moves to `stemcells/closeOut/`, the server
      imports it from there, and it gains `writtenCloseOut` for a view.
- [x] 2. The Mac: a reply's close-out draws as a card.
- [x] 3. Captures, and the pull request.

## Verified

- `stemcells/closeOut/*.test.ts`: the server's cases, moved and unchanged,
  and the written read: every line kept, before and after, none where the
  server reads none.
- The server's suites that read it (`needs`, `ledger`, `arcs`, the
  close-out contract): unchanged and passing.
- `closeOut/reply.test.ts`: a card for a settled reply's own words; none
  while it streams, for other words, or on a parse miss; the foot for the
  latest run's last reply alone, and none from a server before the brief.
- `upstream/substitutes/ChatMarkdown.browser.test.tsx`: upstream's real
  `AssistantTimelineRow`, through both substitutes, draws the card with the
  reply's words before and after it, copies as written, shows the foot on
  the latest of two replies only, and stays text while streaming.
- `substitutes.contract.test.ts`: the new substitute exports what upstream's
  module does, and the timeline still imports its row from it.
- A headless lab on a scratch home with Replay Cells: a two-turn Cell (an
  older Done, then a Done with an offer after it) and a Cell that ends on a
  Left. Captured wide and in two 370 px panes, and once more with upstream's
  own row for the before. The lab can't open a pull request, so the list's
  pull request and lines changed were edited into the server's own JSON for
  that capture; the check fact and the cards are the lab's own.

## Next

- The phone's card, once the feed can say a segment is an assistant's
  settled reply.
