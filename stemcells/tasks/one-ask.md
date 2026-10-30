# One ask at a time in Aski's room

Aski's room showed every ask open on the right, and with five or more it
read as a wall: each with its headline, two lines and its buttons, all at
once. The person asked for one decision at a time, with clean motion.
Approved 2026-10-29 after a clickable mock, with every seat change on
foot as the person asked.

It replaces `aski-asks.md` decision 3 (every ask open). The ask's look
(decision 4), its options (5), the tail (6) and the undo line (7) stand.

## Decisions

1. **One ask in front.** The room shows one ask whole; the others wait as
   a line of their Cells along the bottom of the half, with "N more". A
   Cell's number stays on its ask, so words in Aski's composer still
   answer any of them by number or name ("2, go"; "Floof, done").
2. **The line is the index.** Hovering or focusing a Cell in the line
   says its number, who it is and what it asks, in one quiet line under
   it; a click brings that ask to the front.
3. **What stops a Cell goes first.** An ask that blocks a running turn
   (`need.blocks`) stands ahead of steps left to the person, then the
   list's own order. The ask in front never changes under the person: a
   new ask joins the line, however urgent.
4. **Every seat change on foot.** Answered, the Cell in front bows and
   hops up and away, to work, and its words lift away; the line's
   first Cell walks off the line's left edge and in at the ask's, and its
   words rise in as it arrives; the rest step up a seat each, front first.
   Later, it walks back off the left. A Cell new to the line walks in from
   the right. Each walk is a few short steps, once, never a loop; with
   reduced motion, the words fade and nobody walks. The edges are the
   half's own: a Cell walks off the hairline between the halves.
5. **Later stays a snooze, and waits in sight.** It snoozes the Cell for an
   hour as before (`actions.ts`). The server sends what a snoozed Cell
   would ask as its own list, `later`, soonest back first, each keeping its
   number for when it is back. The room seats them dimmed after the count;
   the peek says when each is back, and a click brings it to the front at
   once, through upstream's unsnooze. A Later still on the undo line is
   simply taken back. Put off, the Cell walks off the ask's left edge and
   in at the line's right, to the end.

## Steps

- [x] Who stands in front, and the line's order: `front.ts`, with tests
- [x] The room shows one ask and the line (decisions 1 to 3)
- [x] The walks (decision 4), checked in the desktop lab
- [x] Later's asks dimmed at the end of the line, to pull back (decision 5)

## Review

Steps 1 to 3 landed together; step 4 followed, with the server listing
snoozed asks.

- **The answered Cell hops instead of walking right.** In the lab, walking
  right took it across the next ask's name as that ask rose in; a hop up
  keeps it clear and is the column's own move to Flying.
- **An allow waits from when its ask reaches the front,** not from when the
  page first saw it: with one ask at a time, every answer puts a new ask
  under the pointer.
- **The keyboard follows the line.** An answer from the keyboard, or a
  click on the column's index, lands the focus on the ask that walks in.
- **Checked** with `front.test.ts` and `walk.browser.test.ts`, and in the
  desktop lab on a fixture list, frame by frame: the leaving card first
  faded in and out at once (the room's arrival fade ran on it too), fixed.
- **Step 4 in the lab:** Later put the Cell dimmed at the end at once,
  before the server said so, and a click on it brought its ask in front
  with the line in order, wide and narrow. Composer words still address
  only the asks in front of the person: a put-off ask shows no number.
