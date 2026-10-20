# No header in a chat: its chrome lives at the input

A pane wore two headers: ours (the Cell's mark, its title, the Look chip)
and upstream's breadcrumb (project / title). The title showed three times,
the project twice, and the headers took about 64 px of every pane. The
chrome moves to the input: the Cell, its name, project, where it runs and
what the chat is about on the line over the composer; the pane's buttons
float at its top-right while you're in it.

## Plan

- [x] Pane buttons: upstream's own panel toggles (thread details, terminal,
      right panel) leave the window's top-right for the pane's, as round
      glass buttons shown while the pointer or focus is in the pane; the
      Look chip leads them and a × closes the pane
- [x] Our pane header goes; upstream's chat header is hidden inside panes
      from our side (its element stays, as the thread panel's anchor);
      upstream's own routes keep theirs. Contract-pinned
- [x] A pane with no composer shows its Cell as a pill at its top-left
- [ ] The line takes the header's jobs: the name and the one-liner open
      upstream's thread menu, a double-click renames, the project starts a
      new chat in it, a fork names its parent
- [ ] Where the Cell runs, once sent: upstream's glyph and words, the label
      on hover; hidden while upstream's own context strip shows it
- [ ] The ladder, by the pane's width: words become marks, then the
      one-liner, the model's version and the attach button go; the Cell,
      its name, the field and send/stop never do
- [x] Light theme: the focused plate reads at a glance in a 2×2 (an
      ink-tinted rim, a deeper tighter shadow, the others further back);
      dark exactly as it is
- [ ] Prove it: the ladder at 720/480/360/300/240/160, working and your
      turn; a 720 px window with two Cells; the pane buttons; light 2×2
      with measured levels

## Decisions

- The toggles stay upstream's components with upstream's state, moved by
  CSS; the Look chip and × join their row through a portal, ordered by CSS.
- Env locks after the first send, so the line only shows it; choosing it
  stays in upstream's draft context strip.
- Two PRs: the pane's chrome and the light focus first, then the line's
  jobs, where the Cell runs, and the ladder. Until the second lands, a
  chat's menu and rename stay on its row in the wide left column.
- Where upstream draws the right panel as a sheet (a narrow window), its
  toggles go into the sheet with it; the pane keeps the Look chip and ×.
- Light focus, measured on a 2×2 (focused against unfocused, slate 252):
  rim 171 against 218 (was 235 against 235), shadow 2 px below the plate
  206 against 248 (was 207 against 233); fill 255 against 253. Dark's
  values are pinned in `:root.dark` and unchanged.
