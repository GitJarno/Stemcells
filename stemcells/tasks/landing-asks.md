# An ask gets its Cell to Landed

A Cell's life runs Flying, Needs you, Landed, Settled. The person settles
in Landed, one after another. An ask in Needs you is a detour on that road:
it exists only to get its Cell to Landed, and it's good when one visit does
it. This follows `unblocking.md` and replaces its decision 3 and the links
under an ask in its decision 4.

What the steps Cells left the person in the last two weeks say (353, all
from Claude Cells):

- About 1 in 5 is a choice ("decide whether…", "say whether…"), written
  as a step though the close-out says a step is never a choice. The card
  can only offer Done it and Reply… for it.
- About 1 in 8, at least, is a follow-up that blocks nothing: rebuild the
  app when it suits you, send a screenshot the next time the bug shows.
  The work is delivered, yet the Cell waits in Needs you instead of
  Landed.
- About 1 in 5 happens on a web page (a registrar, an admin console, a
  pull request), and 3% of steps carry a link.
- The rest are local: unlock the phone, run the uninstaller, press ⌘R.
  These have no page, and a rule asking every step for a link would make
  Cells invent one.

## Decisions

1. **A step left to the person is what keeps the work from landing.** The
   close-out asks for a link to the exact page when the step happens on
   one, a choice through the question tool, and a follow-up that can wait
   in **Done:**, so its Cell lands.
2. **Done it lands the Cell.** It always tells the Cell to carry on: the
   Cell checks what it can and closes with **Done:**, so it reaches
   Landed with its own line, and the person settles it there. Settling
   from the ask skipped Landed.
3. **An ask links only what its words name.** The row of the reply's other
   links goes: it guessed, and most of what it showed wasn't the step's.
   A step's own links and bare addresses stay links, and "#123" links to
   that pull request or issue in the Cell's repository on GitHub.
4. **A step that asks for a decision takes the person's words.** "Decide
   whether…", "say whether I should…", "merge it or tell me": Done it
   answered none of them, and a "no" typed to Aski settled the Cell. Such
   a step offers Reply… and Nothing to do, and a yes or a no to it is the
   person's answer.

## Steps

- [x] Eval: close-out cases (`stemcells/evals/`), failing on the old text
- [x] Close-out text; the cases pass
- [x] Done it carries on
- [x] The links row out; "#123" linked on the web and the phone
- [x] Tests, drift, check-local, merge
- [x] A step that asks for a decision takes the person's words

## Review

- **The text moved what the evals said it would.** On Opus 5.5, a step on a
  web page carried a link in 0 of 4 runs on the old text and 3 of 3 on the
  new; a delivered fix with a rebuild left for later landed with **Done:**
  in 0 of 3 and 3 of 3. Choices kept going through the question tool, and
  a step with no page got no invented link (`stemcells/evals/README.md`).
- **Choices left as steps are decisions a Cell parks.** Given a plain
  choice, Opus asks through its tool on the old text too. The real ones
  weren't long runs (a median of 17 items), and in 54 of 63 the run asked
  nothing through the tool: mostly a yes or no the Cell set aside while it
  went on, listed again each turn. So the card takes words for them
  (decision 4). Whether the close-out should send a parked decision
  through the tool as well stays open, behind an eval of its own.
- **Seen in tests only:** the card and the phone, no captures; the close-out
  text in the eval, not yet in a real Cell.
