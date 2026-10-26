# The phone's home on the Cells' line

The column (`left-column-v3.md`) stands each Cell on one line: Needs you,
Working, Landed, Settled. The phone's home still sorts them its own way
(Asleep · Active · Working · Input, `phone-cells.md`), and its Input tab is
a list of rows, so an ask has to be opened to be answered. This brings the
column's line and its asks to the phone, in the phone's own shape.

Research (2026-10-26) settled where things come from:

- **Every act is already a T3 command.** An answer, a reply, Settle,
  Later and the plan's build each map to a thread command
  (`apps/web/src/stemcells/needs/actions.ts`), sent through client-runtime's
  thread atoms, which the phone already holds (`apps/mobile/src/state/
  threads.ts`). Nothing new crosses the wire for acting.
- **The asks come from each machine.** The server builds the cards and the
  three server stages (`GET /api/stemcells/needs`); Landed and Settled are
  the client's (`rail/moves.ts`). Each machine derives only its own Cells,
  so the phone reads every machine it holds, as Settings › Disk does. The
  phone calls our endpoints with the saved bearer token, as push does
  (`push/register.ts`). Stemcells never pairs through T3's relay, which has
  no bearer token; a machine reached that way, or one without the endpoint,
  keeps today's home.
- **The web's pure modules port.** `needs/wire.ts`, `card.ts`,
  `display.ts`, `actions.ts` and `rail/moves.ts` import no React and no
  live state, so the phone imports them as it imports the creature.
- **Motion is there.** Reanimated 4 already moves the Cells and Aski.

## Decisions

1. **The tabs become the line.** Needs you · Working · Landed · Settled,
   T3's segmented control with counts, as now. A Cell stands where the
   column stands it, so the Mac and the phone never disagree. Pinned stays
   T3's pinned shelf at the top of each list, not a fifth segment, since a
   phone's width has no room for one. A snoozed Cell is off the line until
   it wakes, as in the column, and Settled keeps T3's snoozed shelf under
   its Cells, so what Asleep held is still a tap away; the count is the
   settled Cells, as the column's is. Opens on Needs you when anything
   waits.
2. **Needs you is the column's asks, not rows.** The same card, phone
   sized: the Cell, who, project and tag on one row, the ask in full, its
   answers as one group of tap targets, and a foot with its age, Later,
   Settle and Open chat. One ask is open at a time; the rest say who asks
   and what, and answering one opens the next. Reply opens the chat on its
   composer.
3. **Tags take the column's five families** (decision 4 there), in T3
   mobile's own status colours.
4. **Fresh without a stream.** A machine's asks are read when the app comes
   to the front and whenever one of its threads changes in T3's live data,
   which the phone already receives. No server-sent-events reader on the
   phone.
5. **Your own act never waits.** The card leaves at once. An undo line at
   the list's foot says what happened, with Undo; an answer is sent when
   the line goes, as on the Mac.
6. **Only your own act hops.** The Cell hops from its card to its
   segment's count, which ticks up. Moves you didn't make only change the
   numbers. Under Reduce Motion it just leaves.
7. **Filters stay T3's.** The machine and project pickers are already the
   phone's. Asks never hide: Needs you counts the ones the filter leaves
   out, and says where.
8. **Where it doesn't apply, the home is today's.** Android, the iPad
   sidebar and search keep T3's home, as they do now; a machine without the
   needs endpoint keeps the shell-derived tabs.

## Steps

After the upstream sync merges (it brings T3's mobile changes) and once
the column's asks step has landed, so both read the same tags.

- [ ] The reader: each machine's asks over its bearer token, refetched on
      front and on its threads' changes; a contract test that the JSON the
      server sends is what `wire.ts` reads; machines without it fall back
- [ ] The line: the four segments from `moves.ts`'s stages, the counts,
      Pinned as T3's shelf, T3's snoozed shelf under Settled
- [ ] Asks: the card, the tags, one open at a time, the acts through
      `actions.ts` and T3's commands
- [ ] Your act leaves at once, with the undo line
- [ ] Hops for your own acts
- [ ] User docs: the phone section says what the four segments mean
- [ ] One pass on a simulator, with the person's go-ahead
