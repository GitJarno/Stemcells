# A stop with one cause is one line, not a card per Cell

Input is a promise: your answer, for this Cell, is what unblocks it
(`unblocking.md`, decision 1). A usage limit breaks that promise. It
stops every Cell on an account at once, no answer to any one of them
lifts it, and what does lift it (the clock, a sign-in) lifts them all.

## What the records showed (2026-11-10)

One limit stopped 10 Cells and 9 sub-tasks on one account in four
minutes, its reset a day away.

- The 10 Cells made no ask: each was armed to carry on at the reset. They
  read as Flying while nothing ran.
- Three asks did come, each for a sub-task its parent had cancelled, and
  each put its parent in Input.
- A sign-in seven minutes later carried the Cells on. Four sub-tasks
  stayed stopped and armed, their parents long past them.
- Before auto-resume was on by default, the same stop made a card per
  Cell.

## Decisions

1. **Sort a stop by what clears it.** A question, a permission, a plan, a
   step left to the person: the person, for that Cell, so a card. A usage
   limit, a signed-out account, an outage: one cause for many Cells, so
   one **condition**, shown once, with what ends it.
2. **A limit never makes an ask.** Not for a Cell, whatever its reset, and
   not for a sub-task: a sub-task's stop is its parent's to handle. The
   needs list carries `conditions` beside `needs`.
3. **A Cell under a condition holds.** It is neither Input nor Flying.
   The wire keeps its stage `working` and adds `holds`, the condition's
   key, so a reader from before shows what it showed. A reader that knows
   it says Holding and counts it out of Flying.
4. **A condition says what it waits on.** `reset`: a known reset, and
   Cells that carry on at it by themselves. `you`: no reset was stated, or
   it passed and they are still stopped, or none of them is armed. Its
   line names the account, the reset and how many hold, and lists them.
   One that waits on the person offers Continue now, which sends each of
   its Cells what its own banner's Continue sends. A Cell with an ask
   stands in Input and under no condition.
5. **One push a condition**, not one a Cell, and one line in Aski's
   report.
6. **The words name no way past a limit.** The line states the account,
   the reset and the count (`aski-room.md`, the limit banner's rule).
   Which account a Cell runs on stays the person's click
   (`account-switch.md`).

7. **The accounts are a list of their own.** Under the plans on the Usage
   page: every Claude and Codex account on this Mac's server, who is
   signed in, what flies and what holds on each, Sign in, Add an account,
   and on each account that can take them, Move N holding Cells here. The
   plan ring opens it and the command palette finds it. Of four places the
   person chose this one on 2026-11-10: the limit's own line stays silent
   about accounts, and the list is in the server's order and says nothing
   about which to pick. A move is the person's click, an account a Cell;
   nothing moves one by itself (`account-switch.md`).

## Slices

- [x] 1. Server: conditions for limits, `holds`, no limit ask, the report
      and the push. Web: Holding leads the board in Aski's room, and the
      Cells' column counts held Cells beside Flying and lists them under
      what holds them.
- [ ] 2. Resume: a sub-task carries on only while its parent still waits
      on it, and until then that parent reads Flying, which it isn't; a Cell that gets through shows the limit has lifted, so the
      rest follow, which covers a limit with no stated reset; the person's
      last-touched Cell goes first.
- [x] 3. The accounts list (decision 7): the Usage page's Accounts, the
      move of held Cells, the ring's click and the palette's words.
- [ ] 4. The phone: Holding and the line; switching between accounts
      already signed in.
- [ ] 5. The other shared causes as conditions: a signed-out account, an
      outage, the network.

## Review

- Slice 1 was seen in a lab with a limit put into the server's own list:
  the lab's Replay provider can't hit one. The needs service itself is
  held by tests: a limited Cell makes no ask, stands `working` with
  `holds`, and its condition crosses the wire as the phone reads it.
- The web keeps its limit card for a server from before conditions, which
  still asks per Cell.
- The phone shows no limit ask from a server with conditions, and a held
  Cell where its own tabs put it; Holding there is slice 4.
- `stemcells_standing` gains a Holding section in its report. Its
  description and schema are unchanged: they are text a model reads, and
  their evals cost money to run.
- Slice 3 was seen in a lab on the real Usage page. The lab's fake CLI
  can't say who is signed in, so the page alone read the two Claude
  accounts as signed in, and two of the server's Cells stood as held.
  Before the model check was added, the click sent each Cell "Continue
  where you left off." with the picked account and the guard of the run it
  continues, in one dispatch, as upstream's own Resume does after its
  picker; the server refused both, as it should for runs no limit stopped.
  With the check, the lab's Cells, whose model no Claude account offers,
  are refused before anything is sent. Not run: a held Cell carried on by
  a second real account, and the sign-in terminal from the list, which is
  `/login`'s own.
