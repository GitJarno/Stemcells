# Subcells: a Cell's subagents as Cells

The transcript groups a turn's subagents in a card: "2 subagents · 2
working", the provider's logo for each. In Stemcells they are Subcells, and
each is a small Cell of its own: its critter in place of the logo, dealt by
its id as a Cell is, the status dot kept on it.

## Plan

- [x] Words: `stemcells/words/subcells.ts` says subagent as Subcell, for
      the substitutes on the web and the phone.
- [x] The critter: `SubcellMark`, the tab chip's figure (`CellFigure`)
      dealt by the Subcell's thread id (its subagent id when it has no
      thread), its face from its status, upstream's status dot on it, at the
      composer line's size (26 × 28 px, about the logo's 24).
- [x] Seams: `V2LifecycleRow.tsx` (cold) draws the critter where an avatar
      knows its Subcell; the hot files (`MessagesTimeline.tsx`,
      `ChatView.tsx`) import the words from `stemcells/words/subcells.ts`
      once each; literal words in cold files.
- [x] Substitutes: `TimelineSystemDivider`, and the existing
      `subagentDisplay` (an untitled one's title); the phone's
      `subagentDisplay`.
- [x] Upstream tests that pin the words: expectation seams.
- [x] Contract tests and `seams.md` rows.
- [x] Proof: two real runs with two Subcells each, dark and light, a narrow
      pane, Reduce Motion (`subcells-proof.png` beside the lookbook).

## Left out

- The subagent bar's screen-reader announcement: it sits inside the
  component the bar's substitute wraps.
- The phone has no Cell figure, so its card keeps the provider's logos; its
  words change. Drawing its Subcells is a follow-up.
- The buds on a Cell's line stay bare: one sprite of one or two small Cells.
  Dressing each as its Subcell is the line's work.

## Review

- Two real runs in the dev app, two Subcells each. Each Subcell wore its own
  look, and its tab, opened from the card, wore the same one. The divider
  over its thread said "Subcell of". Working, they thought; done, they stood
  awake with upstream's green dot. Under Reduce Motion their frames held.
- At the tab's size (13 × 14 px) upstream's dot hid most of a Subcell, and
  two in the header ran together as one. Drawn as the composer's line draws
  a Cell, they are the logo's size, and the dot sits on a corner.
- The Stemcells theme is dark only; light was proven on upstream's own
  theme, where the pale pieces are keylined.
- Upstream's `deriveAgentSpawnSummary` says "subagents" but nothing renders
  it, so it keeps its words.
- Mixed words were what the person flagged, so the hot files' last two strings
  (the notification row's button, a spawn's screen-reader label) take the
  word from our module too. In the dev app the Cell's page, every label and
  text a person or a screen reader meets, says Subcell; "subagent" is left
  only in the prompt and the model's own prose.
