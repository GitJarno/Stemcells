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
- [x] The line takes the header's jobs: the name and the one-liner open
      upstream's thread menu, a double-click renames, the project starts a
      new chat in it, a fork names its parent
- [x] Where the Cell runs, once sent: upstream's glyph and words, the label
      on hover; hidden while upstream's own context strip shows it
- [x] The ladder, by the pane's width: words become marks, then the
      one-liner, the model's version and the attach button go; the Cell,
      its name, the field and send/stop never do
- [x] Light theme: the focused plate reads at a glance in a 2×2 (an
      ink-tinted rim, a deeper tighter shadow, the others further back);
      dark exactly as it is
- [x] Prove it: the ladder at 720/480/360/300/240/160, working and your
      turn; a 720 px window with two Cells; the pane buttons; light 2×2
      with measured levels
- [x] The pane's buttons stay one row: never wrap; where upstream splits
      its toggles (the right panel open), the header's row sits left of
      the root's; in a narrow pane upstream's toggles fold into a … menu
- [x] The chat's first message clears the buttons: the transcript opens
      below a band as tall as the buttons, and upstream's top fade runs
      under them when scrolled

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
- The line's jobs are upstream's own: `useThreadActionMenu` for the menu,
  `resolveRenameCommit` and `updateMetadata` for the rename, the new-thread
  handler for the project, the lineage for the parent; the header's click
  wait and blur rules are ported as they are (`upstream/chatHeader.ts`).
  The rename field sits in the composer's form, so Enter keeps the title
  and never sends.
- Where it runs shows only when it is news: another machine (or a project
  on several), or a worktree, with upstream's glyphs and words. A chat in
  the project's own checkout here shows nothing. A person who keeps
  upstream's context strip under every chat sees it there instead.
- The ladder's rungs, by the pane's width: at 480 the project becomes its
  mark; at 240 the one-liner, where it runs and the parent go, and the
  model shows its mark; at 200 the project, the model's chevron and the
  attach button go. Upstream folds its own controls (effort to an icon,
  the rest into its overflow) by its own measure in between.
- The pane's band is upstream's top fade: a pane sets
  `--workspace-titlebar-scroll-fade-height` to the button band, so
  upstream's spacer and fade both grow to it (contract-pinned). At 360
  and under, upstream's toggles fold into … with their own words and
  state, and a choice presses upstream's own button.

## Review

Two PRs. The first moved the pane's chrome and tuned light focus (levels
above). The second gave the line the header's jobs and the ladder; proven
in the dev app: the menu opens from the name and from the right-click, a
double-click renames and Enter keeps the title with a draft left unsent,
Escape keeps the old one, the project opens a new Cell in the pane, and
the ladder holds at 720/480/360/300/240/160 with a Cell idle, asking and
working (send or stop at every width). Left for the narrow-pane PR: at
160 the placeholder still wraps over the controls.

The buttons wrapped to two rows at some widths and sat over the first
message. Now one row at 930/480/300, dark and light, with the right panel
open (the toggles split) and without; the first message starts 80 px
below the pane's top, the buttons end at 36; at 300 the row is … and ×, and the …
menu toggles upstream's terminal on and back off.
