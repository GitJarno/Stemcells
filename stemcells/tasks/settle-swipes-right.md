# A Cell's card swipes the way the stages run

The person's ask (2026-11-03): on Landed, a swipe left settled a Cell. Settled is the next stage, to
the right, so a swipe right should settle. But many people expect a swipe left to open a row's
options. What's the best experience?

## Thinking

- The home lays its stages out left to right: Input, Flying, Landed, Settled. A switch already
  brings a list in from the side it lies on. A gesture that moves a card the way the Cell is
  going reads as the move itself, and the tabs teach it.
- iOS's own split agrees. A row's leading edge, a swipe right, holds a quick change of state
  (Mail's Read). The trailing edge, a swipe left, holds the options and the way out.
- So the direction says where a Cell goes, and the left keeps its options:
  - **Swipe right, settle.** On Flying and Landed, a full swipe settles, and the card leaves to
    the right, toward Settled.
  - **Swipe left, options or back.** On Flying and Landed, Snooze's menu of times; never a full
    swipe, since a snooze needs a time. On Settled, Un-settle and Wake, back toward Landed,
    which a full swipe does, as before.
- Not chosen: Settle on both edges. It keeps the old habit, but a swipe left would then mean
  settle on Landed and un-settle on Settled, and the direction would say nothing.

## Plan

- [x] `ThreadSwipeable` takes `primaryEdge` (a seam, an extension point upstream could take):
      the primary on the leading edge, the secondary alone on the trailing one; the buttons mirror
- [x] The row asks our `swipeEdgeOf` which edge, and says its swipes aloud from `swipeHint`
- [x] A contract test pins the T3 action names the edge goes by
- [x] seams.md, typecheck, lint, tests, drift

## Review

Typecheck, lint and drift pass. The phone tests pass, apart from a compiler-coverage case for
`chat/useClosesOnReturn.ts` that fails on main too. The contract test pins `settle` to a swipe
right and `unsettle`/`unsnooze` to a swipe left. An independent review found three problems,
all fixed. Snooze's icon had a NaN transform, and Snooze trailed a long pull: the trailing edge
no longer overshoots. A dismissal from the long-press menu slid right: now only a row swiped
right leaves to the right. A swipe is a gesture, so the phone is the check:
a card on Landed settles with a swipe right and leaves to the right; a swipe left shows Snooze;
Settled's rows still un-settle with a swipe left.
