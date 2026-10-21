# Interaction

How things move when the person moves them, or when work arrives: one
vocabulary of motion across the app. Durations and springs are the motion
tokens in `apps/web/src/stemcells/tokens/stemcells.css`; nothing names a
time of its own.

## The spawn

Words become Cells: they pour into Aski, Aski sends one stream to each
Cell's pane, and in each pane the stream condenses into the Cell. Three
owners play one sequence: the words and the streams (`words/`), Aski
(`aski/`), and the Cell forming (`cell/`).

| Beat   | What moves                                                                                                                       | Owner       | Timing                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| In     | Aski fades in and looks down at the composer; the sent words leave as letters and pour into Aski                                 | Aski, words | Aski on `fade`; letters `letter-stagger` apart, all within `letters-span`, each on `travel`                           |
| Around | The letters orbit Aski while it plans, its eyes riding the orbit; the panes open                                                 | words, Aski | one `orbit-turn` at least, clockwise from the top; panes on `settle`                                                  |
| Out    | Aski sends one stream to each pane, nearest first, and pulses once a stream (a row's squash, sprung back), its eyes on that pane | Aski, words | the first stream at once; streams `spawn-stagger` apart, at most 4 in flight, each on `travel`; each pulse on `flick` |
| Glyphs | In the pane, the stream condenses over the Cell's box: `. : + # @`                                                               | words       | one glyph a `form-step`                                                                                               |
| Blocks | The glyphs become the Cell's outline in blocks: `░ ▒ ▓ █`                                                                        | Cell        | one block a `form-step`                                                                                               |
| Hop    | The Cell's own pixels, a crouch, and a hop onto its line                                                                         | Cell        | four `form-step`s, then its mood                                                                                      |

- **One Cell from a draft** plays only the last three beats, in its own
  pane, starting on Enter.
- **The hand-off** is one call, `formAt(threadId, at)` (`cell/forming.ts`),
  with `at` a `performance.now()` time: before `at` the Cell's box is the
  stream's, and from `at` the Cell plays its blocks and its hop. Call it as
  soon as the thread is known (a draft's, on Enter, as its line appears); a
  Cell already standing leaves its box until `at`. `cellBoxOf(threadId)` is
  where the box stands on the pane's composer line (null until it is
  drawn), for the glyphs to condense into; the blocks then fill the Cell's
  own outline in its body's colour.
- **Nothing waits on it.** The composer takes typing from the first frame,
  and the Cell's first message shows as it comes. A call that never comes
  leaves the Cell standing, and a hand-off is held to 3 s ahead at most, so
  the box is never empty longer.
- **Aski** is otherwise still. After the last stream its eyes go `^ ^`,
  and once the spawn is done it fades out on `fade`.
- **Reduce Motion** plays none of it: Aski doesn't appear, the panes
  appear and each Cell stands.
- `form-step` is one beat of the sprite clock (12 a second), so the glyphs,
  the blocks and the Cell's own frames keep one rhythm.
