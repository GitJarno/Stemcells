# Flying: the stage word for a Cell at work

A Cell is thrown at a problem. It flies an arc until it lands, or falls
short and needs the person; their word throws it again, until it sticks
the landing. The column already said Landed; the stage before it said
Working, upstream's word, which breaks the arc. A person now reads Flying.

## The rule

A word becomes Flying when it names a Cell's stage to the person: a
label, a count, an empty state, a line that counts Cells in the air.

| Where                                                 | Was                                   | Now                                  |
| ----------------------------------------------------- | ------------------------------------- | ------------------------------------ |
| Web column, stage row and list                        | Working                               | Flying                               |
| Web project tile's summary                            | 1 working                             | 1 flying                             |
| Web linked machines                                   | 3 at work in your repositories        | 3 flying in your repositories        |
| Web update banner                                     | 3 Cells are at work                   | 3 Cells are flying                   |
| Phone line's tab, and the tabs without the line       | Working                               | Flying                               |
| Phone empty tab                                       | No Cells working.                     | No Cells flying.                     |
| Aski's status line (persona and the phone's greeting) | N Cells at work. Your hands are free. | N Cells flying. Your hands are free. |
| Phone chat's timer, over the composer                 | Working 2m 50s, Working for 2m        | Flying 2m 50s, Flying for 2m         |
| Phone Subcells sheet, a running Subcell's status      | Working                               | Flying                               |

## Kept, and why

- **Code, wire values, tokens and fixtures** (`stage: "working"`,
  `--sc-working`, `ColumnStage`): nobody reads them, and the wire crosses
  server, web and phone.
- **Text only models read**: the roster an agent gets at a turn's start
  ("working", "at rest") and Aski's standing report ("At work (N)"). A
  model reads plain words more reliably than the metaphor; Aski's persona
  carries the word to the person.
- **The work verbs' row** ("Noodling for 12s"): what the Cell does inside
  its flight, a layer of its own. Its fallback stays upstream's "Working",
  as screen readers hear upstream's words.
- **Idioms that don't name the stage**: "Quiet means it's working." (it
  functions), "All hands busy. Except yours."
- **Upstream's strings in upstream's views**: its sidebar, the Working
  section setting, "Working…" on a busy button (the app is busy, not a
  Cell), and the thread rows and shelf header the phone's tabs list.

## Plan

- [x] The words above, and the tests that pin them
- [x] The rule in `stemcells/AGENTS.md`; the column's and the phone line's
      stage decisions say Flying
- [ ] Later, if wanted: the phone's thread rows and shelf header inside the
      Flying tab still say upstream's Working; each needs a seam in
      `features/threads/thread-list-v2-items.tsx`

## Review

Pending the pull request.
