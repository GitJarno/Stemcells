# The left column: one line to Settled

The left column shows what needs the person, and every Cell travels one
line from Working to Settled. It never follows the tabs, and opening a
Cell from it never takes another Cell's pane. Agreed on 2026-10-26 over an
interactive draft in the chat that asked for it.

## Decisions

1. **One line of stages: Needs you, Working, Landed, Settled.** Every Cell
   is in exactly one. Needs you, Working and Landed are the stages
   `stage.ts` reads (`needs-you`, `working`, `done`); Settled is upstream's
   `settledAt`. Settled is not a second axis: upstream refuses to settle a
   thread that runs or asks, and a new message un-settles one, so the only
   settled Cell is one that stopped and was put away.
2. **One verb, Settle, from any stage.** On a landed Cell it settles; on a
   Cell still working or asking it stops it first. Writing to any Cell,
   a settled one too, sends it back to Working.
3. **Landed is the Cell's word, Settled the person's.** Closing a landed
   Cell's pane settles it, with Undo; this reverses `useLeavesWhenSettled`'s
   "closing never settles". Upstream's auto-settle on a merged pull request
   goes off by default, since Cells merge their own and would skip Landed;
   three idle days stays.
4. **Pinned is a bookmark, not a stage.** It keeps a Cell one click away and
   out of auto-settle (upstream's per-thread "Auto-settle behavior:
   Disabled"); the Cell still makes the trip.
5. **The column:** search and New Cell on top; the open stage's list; the
   stages' rows at the bottom, each with its count and a few sprites,
   Pinned set apart. Needs you is open by default, and there is no filter
   at the top: the rows are the only switch. A sprite takes only its own
   line, so text runs the column's full width and the column stays narrow.
6. **Asks are a queue cleared in the column.** A card says who asks and
   what; open, it shows the context and each option with what it causes,
   the recommended one first. Answering rolls the card up into its Cell,
   which hops into Working, and the next card opens.
7. **Motion:** every move is a hop down one stage; the only jump up is a
   Cell that falls short. No animation runs on its own: the asking blink
   plays when a Cell arrives, then stops. Reduced motion moves nothing.
8. **The column never follows the tabs.** Upstream's list follows the open
   chat: it slips that chat into a collapsed shelf (`routeThreadOnly`),
   widens its project filter and scrolls to it, so swiping across tabs
   reshuffles it. Ours changes only when a Cell changes stage.
9. **Opening a Cell never replaces another.** A pane showing it takes focus;
   an empty focused pane takes it; otherwise it lands as a new Cell does
   (`tabs/landing.ts`: its project's tab used last with room, else a new tab
   after the project's tabs, never Aski's) and comes to the front. A thread
   chip still opens its chat beside the link.
10. **Snooze and archive aren't shown.** A Cell waiting out a plan limit
    stays in Working, dimmed.
11. **Asks live in one place.** Once the column ships, Aski's room keeps the
    conversation, and its decision column and roster go.

## Plan

- [ ] Opening never replaces (decision 9): `showRoute` lands a chat no pane
      shows instead of putting it over the focused pane's; Aski's pane needs
      no rule of its own then
- [ ] The column (5, 8): our view in `LeftColumn`'s wide slot, from
      `useNeeds` and upstream's shells (settled, pinned); never reads the
      route. Upstream's list stays one click away for what only it does
      (projects, environments)
- [ ] Asks in the column (6): `NeedCard` in Needs you, the next opening as
      one is answered
- [ ] Motion (7): roll-up, hops, a stage taking a Cell in
- [ ] Settling (2, 3, 4): closing a landed pane settles it; Settle from any
      stage; a pin turns auto-settle off; merge auto-settle off by default
- [ ] Aski's room (11): the decision column and roster go
- [ ] Docs: `left-rail.md` and the user guides that describe the column
- [ ] The phone's home (#298) follows the same line: a plan of its own

## Review
