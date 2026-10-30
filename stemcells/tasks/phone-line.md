# The phone's home on the Cells' line

The column (`left-column-v3.md`) stands each Cell on one line: Input,
Flying, Landed, Settled. The phone's home still sorts them its own way
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
  `actions.ts`, `byHand.ts`, `rail/moves.ts` and `rail/filter.ts` import no
  React and no live state, so the phone imports them as it imports the
  creature.
- **Motion is there.** Reanimated 4 already moves the Cells and Aski.

## Decisions

1. **The tabs become the line.** Input · Flying · Landed · Settled,
   T3's segmented control with counts, as now. A Cell stands where the
   column stands it, so the Mac and the phone never disagree. Pinned stays
   T3's: a pinned Cell heads its own segment's list, as T3 lists pins, not
   a fifth segment, since a phone's width has no room for one. A snoozed
   Cell is off the line until it wakes, as in the column, and Settled
   holds T3's snoozed shelf, closed until tapped, so what Asleep held is
   still a tap away; the count is the settled Cells, as the column's is.
   Opens on Input when anything waits.
2. **An ask is a message**, as `aski-asks.md` decisions 4 to 6 set it, with
   no tags. A quiet line with the Cell's sprite and name, the project and
   the age; the question, the largest words; at most two lines of what you
   need to decide, with More showing the Cell's own words in place; then the
   options as rows. The Cell's own words on each choice always show; our
   line on what an option does shows on the lit row only, and a permission
   lights none. Reply… is the last row. One ask is open at a time; the rest
   say who asks and what, and answering one opens the next. Later, Settle
   and Open chat stay at the open ask's foot; Settle stops a Cell at work
   first, as the column's does.
3. **Fresh without a stream.** A machine's asks are read when the home
   comes to the front, whenever one of its threads changes in T3's live
   data, which the phone already receives, and each minute, as a stuck
   Cell or a limit's reset asks by the clock. A Cell streams many changes a
   second, so a machine is read at most every second and a half. No
   server-sent-events reader on the phone.
4. **Your own act never waits.** The ask leaves at once. An undo line at
   the list's foot, T3's own notice, says what happened, with Undo; an
   answer is sent when the line goes, as on the Mac, and only if its
   machine still asks it. One line at a time: a newer act, or T3's notice
   for a settle, lets the one before go.
5. **Only your own act hops.** The Cell hops along the segments, from its
   old one to its new one, whose count ticks up: an answer once it is sent
   and the Cell is at work, a settle or its undo at once. Moves you didn't
   make only change the numbers. Under Reduce Motion it just leaves.
   **Removed (2026-10-30):** the person found a miniature Cell flying
   between the segments inelegant, so the phone's hop is gone and every
   move, yours too, only changes the counts. The Mac's column keeps its
   hops.
6. **Filters stay T3's.** The phone keeps T3's machine and project
   pickers. Asks never hide: Input counts every ask, and the list ends
   with where the ones the pickers leave out are, in the Mac column's words
   (`rail/filter.ts`): "Also 2 in Harbor", or "Also 2 in A, 1 in B and 1
   elsewhere". A tap there clears the pickers.
7. **Where it doesn't apply, the home is today's.** Android, the iPad
   sidebar and search keep T3's home, as they do now. The home is the line
   when the machines in view read it; with a machine in view that has no
   needs endpoint, it keeps the shell-derived tabs, and the machine picker
   narrows to the ones that do.

## Steps

After the upstream sync merges (it brings T3's mobile changes) and once
the column's asks step has landed, so both read the same asks.

- [x] The reader: each machine's asks over its bearer token, refetched on
      front, on its threads' changes and each minute; a contract test that
      the JSON the server sends is what `wire.ts` reads; machines without it
      fall back
- [x] The line: the four segments from `moves.ts`'s stages, the counts,
      pins at the top of T3's lists, T3's snoozed shelf in Settled
- [x] Asks: the message, one open at a time, the acts through `actions.ts`
      and T3's commands, and where the filtered-out asks are
- [x] Your act leaves at once, with the undo line
- [x] Hops for your own acts (removed 2026-10-30, decision 5)
- [x] User docs: the phone section says what the four segments mean
- [ ] One pass on a device: the person looks at it on their phone (this
      Mac has no iOS simulator runtime, and its disk had no room for one)

## Built (2026-10-27)

One pull request for steps 1 to 6. The phone's code is in
`apps/mobile/src/stemcells/line/`; the home's substitute picks the line or
the tabs, and no upstream file changed.

- **Not on the phone:** the flag, "Not enough to decide" (its measure is
  kept on the Mac), number keys, and "Open provider setup" for a sign-in;
  Open chat reaches it.
- **Not yet seen:** checked by tests and the type check only. The
  person looks at it on their phone (step 7).
- **An independent review** found three things, fixed before merging: a
  machine not yet read (asleep, say) dropped its Cells off the line, so
  they now stand where their own records do, and its asking Cells show
  under the asks as chats to open; a Settle whose Cell wouldn't stop
  failed silently, and now says so; and a reading that brought an older
  ask opened it in place of the one under the person's finger.
