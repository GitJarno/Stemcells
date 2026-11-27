# Input · Awake · Asleep

> Superseded in part by `the-ask.md`, step 2: Input is no longer a stage.
> An asking Cell keeps its Awake row in amber and is answered in its chat;
> Awake and Asleep are the stages.

Four stages (Input, Flying, Landed, Settled) become three. Flying and Landed
split what the person keeps in play by what the agent happens to be doing,
so Cells changed tabs on their own as they landed, and keeping up with many
meant watching two lists reshuffle. The tabs now answer the person's
questions; the agent's state shows inside the row.

| Stage  | Asks                 | Holds                                          | Order                                               |
| ------ | -------------------- | ---------------------------------------------- | --------------------------------------------------- |
| Input  | What needs me now?   | Every ask, answerable in place                 | A queue: longest waiting first                      |
| Awake  | What's in play?      | Every Cell not asleep, flying or landed        | By the time each row shows, latest first            |
| Asleep | What did I put away? | Cells slept by hand or by time, and timed ones | Latest asleep first; timed ones show when they wake |

## Decisions

1. **Awake reads in time order.** Each row stands by the time it shows
   (flying, landed or asking since), latest first, so a Cell woken from
   Asleep that landed a day ago stands among the day-old rows, not at the
   top. The person asked for this on 2026-11-27, over the first version's
   rows that moved only when the person acted (`byRecent`,
   `apps/web/src/stemcells/rail/awake.ts`). Pinned Cells stay first.
2. **Input is a lens, not a partition.** A Cell asking something keeps its
   place in Awake and wears Input's amber; Input lists the asks. Taking it
   out of Awake would be an agent moving a row.
3. **A flying Cell's row is lit; its hue says the provider.**
   One line per Cell, as Asleep's rows are: the Cell, its project's mark
   and title, a time. While the Cell flies, the composer's light
   (`glow/Wave.tsx`, `apps/web/src/stemcells/glow/`) fills its row as a
   field in the provider's tone (Claude's orange, Codex's green), and the
   band crosses the row on the wall clock's beat, slowly, over the row
   alone. It is the felt sense of work going on; the status icon and the
   time's colour already say the state, so asking, landed and asleep rows
   wear no light. The field is the row's own shape, standing a little in
   from its top and bottom, so two lit rows never touch (2026-11-27: a lamp
   round the Cell read as a sliver, not a field). A landing lets the light
   come to rest and go out. No provider
   name or icon in text, and no coloured edge. The time means "how long
   it's been like this": flying for, landed for, waiting for, asleep for.
4. **The verb is Sleep; its reverse is Wake.** It pairs with the stages and
   is what the Mac says of itself. Never "put to sleep": Cells are
   creatures. **Snooze** stays, a sleep with an alarm (2026-11-27: "Sleep
   until…" didn't fit a swipe and said less); its
   wake time shows on the row. Wake already undoes a snooze upstream, and
   now undoes any sleep.
5. **Words.** Flying and Landed stay the words for an awake Cell's state
   (the chat's "Flying 2m 50s", accessibility labels, "N landed while you
   were out"). Settle, Settled and Unsettle leave what a person reads in our
   layer. Code and wire values keep `working`, `needs-you`, `done`,
   `settled`, `settledOverride` and upstream's `thread.settle` commands.
6. **The face's cold-cache mood isn't "asleep".** An awake Cell never shows
   the sleeping face; only Asleep's Cells sleep. The mood once the prompt
   cache goes cold (`apps/web/src/stemcells/tabs/cellMood.ts`) becomes a
   doze that reads apart from sleep, or shows awake where the art has none.
7. **The Mac's Pinned stage goes**: pins lead Awake, as on the phone.
   A remembered stage maps working, landed and pinned to Awake, settled to
   Asleep.

## Moments

- A Cell lands: the band finishes its pass and the light comes to rest; the
  row doesn't move.
- Sleep: the Cell closes its eyes, its light fades, its row folds away, and
  Asleep's count takes it.
- Wake: the Cell opens its eyes and its row stands at Awake's top.
- Launch: a word from rest lifts the row to the top and its band starts.
- Asleep is night and Awake day, behind the header (`day-night.md`).

## Plan

- [x] `launchedAt` and `byLaunch`, with their table of cases
- [ ] Words: `stemcells/words/awake.ts`; the word table's upstream verbs
- [ ] Phone: three stages, Awake's one-line rows with the light, Sleep on a
      swipe right, Snooze and Wake to the left, Asleep's night
- [ ] Mac: the column's three stages, the same rows and light, Sleep in the
      composer's line and on a closed landed pane, undo notices
- [ ] Aski: `stemcells_show` stages, the standing tool's words, the persona
- [ ] The cold-cache mood
- [ ] Docs: `stemcells/AGENTS.md` Words, `stemcells/docs/interaction.md`,
      `stemcells/docs/install.md`; this file supersedes `flying.md`'s stages
- [ ] Seen on the Duo, an iPhone and the Mac

## Later

- The site's stage scenes and their screenshots (`stemcells/site/`).
- Feats and marks that say settled ("Ten settled").
- Aski's room board (holding, landed, flying).
- Project marks as one system: a project's own logo in one silhouette, and
  a made mark (a hue from the palette, a glyph) where it has none; our own
  projects in Stemcells' hue.

## Review

Pending the pull request.
