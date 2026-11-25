# The phone's home on the iPhone Duo

T3's shell already follows the Duo: the split collapses when it folds, bars
move to the side, columns keep clear of the fold. What Stemcells adds on
top (Aski over the home, the stages, the Cells' copies, a Cell heading its
chat) was drawn for one phone screen, so on the Duo it fought the shell.

## What was wrong

1. **The home beside a chat thought it was hidden.** Unfolded (and on an
   iPad), the home stands in the left column while a chat is open on the
   right. Our home read "in front" from the navigator's focus, which the
   chat holds, so the column's Cells stood frozen, a new Cell never formed
   there, no copy of Aski flew, and the asks stopped refreshing each
   minute. T3's list already knows better: a presented sidebar is visible
   (`useHomeRouteVisible`), and it hands the home that as `visible`.
2. **A Cell's name ran under the Code button** in a chat beside the home:
   the title measured the window, not its column.
3. **Aski took a third of a short screen.** The header (Aski, its line,
   the stages) is about 250 points tall, on the folded Duo's short, wide
   display and in the unfolded column held sideways.
4. **Aski's Cells came from nowhere.** Ask Aski in its chat for several
   Cells with the home beside it, and the new cards just appeared; the
   copies only ever left from the home's own Aski.

## Decisions

1. The home is in front when T3 says its list is on screen.
2. The title fits the column it stands in.
3. A short window (under 760 points: the folded Duo, a window held
   sideways, the smallest iPhones) stands Aski beside its line instead of
   over it, smaller, so the list keeps about 100 points more. A tall one is
   as before.
4. With Aski's chat open beside the home, each Cell's copy buds off the
   Aski heading that chat and flies over the fold to its card, over both
   columns. Elsewhere it leaves the home's Aski as before.
5. A sideways swipe over Aski turns the stage, as two fingers do on the
   Mac's column: left to the next, right to the one before, a rubber band
   past either end.

## Steps

- [x] 1. In front from T3's `visible`; contract test on what it says in a column
- [x] 2. Title width from the column
- [x] 3. The short header
- [x] 4. Copies over the fold
- [x] 5. The swipe
- [x] Docs: interaction (the spawn, the swipe)
- [ ] Checks, pull request, merge
