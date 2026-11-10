# The word table (2026-11-10)

Stemcells says Cell where upstream says thread, Subcell for subagent or
agent, Flying for Working. Each of those was an edit inside one of
upstream's files, and two of upstream's tests were edited to expect them.
Every such line can conflict on any sync. The app's name had the same
problem and left the sources for a build-time transform keyed on content
(`stemcells/docs/fork.md`, The name transform). This moves the vocabulary
onto it.

## Plan

- [x] `stemcells/brand/wordTable.ts`: 66 entries over 27 files. Each names
      a file, upstream's exact words on one line, the part of them that
      changes, ours, and how many times the file says them. Our words come
      from `stemcells/words/` (`SUBCELL`, `CASUAL_CHAT`, `COPY_CELL`, and a
      new `cells.ts` for Cell and Flying).
- [x] The name transform applies it (`transformSource` in
      `nameTransform.ts`): the same `transform` hook in the web's, the
      server's and the desktop's builds, and the phone's Metro transformer.
      One source map carries the name's edits and the table's.
- [x] It can't drift silently. Every build checks every entry against the
      sources before it transforms anything, and each file again as it is
      bundled: words said fewer or more times than the entry says, a file
      that is gone, or two entries on the same words fail the build, naming
      the file and the words. The table refuses a key that spans lines, a
      file no build transforms, and ours that is code.
- [x] The phone's Metro cache key reads the transform's files from their
      own import lines, so a file the table starts reading is in it
      without being listed.
- [x] Word-only files are upstream's again, byte for byte (below).
- [x] Seam files that were mostly words lose their word hunks (below).
- [x] Upstream's two tests edited for our words are upstream's again, and
      off `stemcells/edited-tests.txt`:
      `threadAgentsPresentation.test.ts` (the phone's) and
      `ThreadRelationshipsControl.browser.test.tsx`.
- [x] Our contract tests read what a build makes of upstream's source
      (`transformSource`), so they still pin the words a person reads:
      the web's `subcells.contract.test.ts` and `casualChat.contract.test.ts`,
      the phone's `subcellWords.contract.test.ts` and
      `casualChatWords.contract.test.ts`. `wordTable.test.ts` holds every
      entry to its file, which is the contract "upstream still says these
      words here". `oneImport.contract.test.ts` lets go of
      `TimelineV2EventRow.tsx`, which imports nothing of ours now.
- [x] `seams.md` (rows, The word table, the budget), `fork.md`, `AGENTS.md`.
- [x] A web build and a server build pass; the web bundle says our words.

## What went back to upstream's text

Nineteen source files, whole:

- the phone, `apps/mobile/src/features/`:
  `connection/ConnectionsNewRouteScreen.tsx`, `home/ThreadUndoNotice.tsx`,
  and in `threads/`: `NewTaskDraftRouteScreen.tsx`, `NewTaskRouteScreen.tsx`,
  `ProviderSubagentBar.tsx`, `SubagentStopButton.tsx`,
  `ThreadAgentsSheet.tsx`, `ThreadBackgroundWorkSheet.tsx`,
  `ThreadRouteScreen.tsx`, `ThreadWorkflowGroup.tsx`,
  `floating-working-control.tsx`, `thread-workflow-opening.tsx`,
  `threadAgentsPresentation.ts`, `worktree-setup-card.tsx`
- the web, `apps/web/src/components/`: `NoProjectsHero.tsx`,
  `chat/DraftHeroHeadline.tsx`, `chat/ProviderSubagentBar.tsx`,
  `chat/ThreadLineageWorkflowRow.tsx`, `chat/ThreadRelationshipsControl.tsx`

The three that imported `CASUAL_CHAT` went back whole: the table says the
same words the constant held, so the import was the only thing left.

Eight seam files lost their word hunks and keep their other seams: the
phone's `HomeScreen.tsx`, `WorkspaceToolbar.tsx`, `NewTaskDraftScreen.tsx`,
`thread-list-v2-items.tsx`, `thread-subagent-group.tsx` and
`thread-work-log.tsx`; the web's `TimelineV2EventRow.tsx` (its import of
ours went with its last word) and `TimelineWorkEntryRow.tsx`.

## What stayed, and why

- `TimelineWorkGroupRows.tsx` and `MessagesTimeline.tsx`: the work verbs
  are components of ours (`CellWorkingWord`, `CellWorkedLabel`), not words.
- The swipe hint in `thread-list-v2-items.tsx`: upstream's three-line
  expression is one call of ours. Its first line is upstream's again.
- What upstream assembles at runtime, which the substitutes rewrite
  (`inSubcellWords`, `inFlyingWords`, `inSubcellCountWords`), and the
  phone's alerts (`cell/words.ts`).
- Upstream's own words we never changed: the no-projects hero's title, the
  project picker's "No project", a prompt link's "or start without a
  project".
- Name-class values and model names: out of scope.

## What it cost

- Two cold tsconfigs list the table's files, as a composite project must:
  five lines in the desktop's, two in the web's.
- `seams.md`'s table keeps its column widths, so the formatter rewrote no
  other row: the row "(words: see the word table)" lists the eight seam
  files that have entries, and is as wide as the widest row it replaced.

## Drift

`stemcells/scripts/drift --summary`, at main before this and here:

| Upstream files we change | origin/main | here |
| ------------------------ | ----------- | ---- |
| Files                    | 208         | 187  |
| Lines                    | 3320        | 3184 |
| Hunks                    | 704         | 637  |
| Hot files                | 16          | 16   |

| Hot file                                                | Lines, hunks (origin/main) | Lines, hunks (here) |
| ------------------------------------------------------- | -------------------------- | ------------------- |
| `apps/web/src/components/chat/TimelineV2EventRow.tsx`   | 4, 3                       | 1, 1                |
| `apps/web/src/components/chat/TimelineWorkEntryRow.tsx` | 7, 4                       | 3, 2                |

The other fourteen hot files are unchanged.

## Review

- The built web bundle says "Previous Subcells", "Open parent Cell",
  "Could not stop Subcell", "No Subcells yet", "Have a casual chat" and
  "Open Subcell" in its code, and upstream's words for them only in its
  source maps. Each table file's built text was compared with what its
  seam said before: the same lines, the constants now literals.
- A server build with one phone line reworded failed, naming
  `ThreadAgentsSheet.tsx` and "No agents in this turn.": every build holds
  every entry, also in files it doesn't bundle.
- The phone was proved through Metro's transformer in its own tests, not on
  a simulator.
- A route file can't be in the table: the router splits it into modules
  that each hold part of its text, so an entry's count would never fit.
  The build would fail loudly; none is there today.
