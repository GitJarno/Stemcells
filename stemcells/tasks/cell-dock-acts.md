# The Cell's acts for the dock

The dock (`composer-layout.md`) puts T3's banners on the composer box and
the Cell's line above them. A banner says the fact in words; the Cell
beside it shows the feeling with no words. This is the kit's side: which
banner states already have an act, and the ones it lacks. Wiring a state to
its act stays with the dock.

## Audit

| Banner / state                        | Act                                                         | In the kit                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Environment reconnecting or offline   | **peering**: waits, its eyes on the banner below            | **No.** Connecting draws plain `awake`. New, posed from the rig                                                                     |
| Approval panel                        | **needsApproval**: the original's `alert`, a lean and a "!" | **Unused.** The original played `alert` for a pending permission and `waiting` for a question; we play `waiting` for both. New mood |
| Question panel                        | `needsYou`: `waiting`, a hand up, with the "?"              | Yes                                                                                                                                 |
| Plan follow-up                        | `needsYou`                                                  | Yes                                                                                                                                 |
| Thread error, a run failed on a limit | `crashed`: `x x`, a wavy mouth, held                        | Yes                                                                                                                                 |
| Provider down                         | `peering`: the same feeling, waiting on a line that's down  | With peering                                                                                                                        |
| Prompt too long                       | None: it's about the person's own text                      | —                                                                                                                                   |

## The acts

- **peering**: the Cell leans a little toward the banner below and right of
  it, its face turned that way and its eyes down on it. It blinks, and now
  and then cranes up for a better look. Slow (3 a second, like `idle`), and
  Reduce Motion holds the peer. Drawn from the rig's own pose fields, no new
  art. The lean stays under a hero cell: a whole cell moves the miniature's
  crown over, which carried a weld mask and claws off its canvas.
- **needsApproval**: the kit's `alert` as exported, with the "?" and the
  plea's blink, as a question has.
- `asksYou(mood)` says whether a mood waits on the person (both asks), so a
  surface that counts asks keeps counting approvals once they draw `alert`.

## Plan

- [x] `peering` in `art/moves/dock.json`, inside the box at both sizes.
- [x] Moods `peering` and `needsApproval`, cast to their scenes;
      `asksYou`; the "?" and the plea for both asks.
- [x] Tests: each mood plays its scene, Reduce Motion's frame, the box.
- [x] A lookbook strip of each at 2x, dark and light, in the pages folder
      (`cell-dock-acts.png`).
- [ ] Mapping agreed with the dock's owner.
