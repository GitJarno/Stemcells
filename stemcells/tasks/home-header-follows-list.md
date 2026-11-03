# The home's header follows the list in front

The person's report (2026-11-03), two phone screenshots: now and then, as the app opened, Aski's
header stood over the first card of Landed; going on to Flying, it slid lower still, over both
of Flying's cards. A scroll put it back.

## Cause

Since one header stands over all four stages' lists (`home/StagePages.tsx`), it is placed from
how far the list in front is scrolled past its rest. That number was kept, not read: each scroll
event wrote `offset - rest`, with `rest` a second value the JS thread handed the UI thread after
each render. A stage's list has two rests: T3's list sits under UIKit's inset (minus the safe
area), the page of an empty stage, the asks or "Connecting…" under padding of its own (0). Every
time a stage swapped one for the other (Connecting… to the Cells as the app opens; "No Cells
flying." to the Cells when the first one takes off, which a stage out of sight only renders as
it is chosen), the new list's first events could reach the UI thread before its rest did. They
were read against the old rest, and nothing read them again, so the header stood a safe area
off its room until the next scroll. A switch then carried the wrong number on.

## Plan

- [x] One inset for every stage's scroll view: the marker's substitute sets UIKit's `automatic`
      inset on each, as T3's list has it; the page drops its own top padding
- [x] Each stage keeps only its scroll view's raw offset, as the view last said; the header
      stands at minus that, with no rest to fall out of step
- [x] The switch carries raw offsets (`carriedOffset` takes the rest it clamps to)
- [x] Tests, typecheck, lint, drift

## Review

The phone suite (361 tests), typecheck and lint pass; `carriedOffset`'s cases now run on raw
offsets. No unit test can show the race itself: it lives between UIKit's events and the JS
thread. With one inset and one number, the header can only disagree with the list in front if
the list moved without saying so. The phone is the check: open the app a few times, from cold
too, and switch into a stage whose Cells changed while it was out of sight.
