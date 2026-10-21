# A chat reads at 300 px

Panes split a window, so a chat often lives in 300 px or less. Measured at
300 (and 160), five things broke; code wrapping and the right panel's
sheet stay upstream's.

## Plan

- [x] Narrowing a pane keeps a chat that was at its end at its end
- [x] The Scroll-to-end pill sits above the band the Cell and its line
      stand in
- [x] At 160 the composer's placeholder stays one line, ending in an
      ellipsis
- [x] Tables hint that they scroll sideways
- [x] Tool rows show the file's name first, its folder after
- [x] Prove it: each at 300 (the placeholder at 160), before and after

## Decisions

- The end: upstream's list keeps its end only through growth within one
  screen (`maintainScrollAtEndThreshold={1}`), and narrowing a long chat
  grows it by many screens in one layout; window resizing loses it too.
  Each pane remembers whether its transcript was at its end at its last
  width and holds the end for 600 ms after a width change, until the
  reader scrolls, clicks or types (`tabs/keepEnd.ts`). A chat scrolled up
  stays where upstream keeps it.
- The pill already clears the whole composer overlay, the Cell included,
  and since the transcript fades out across the band (#44) it sits on the
  text just above it: 19 px over the Cell's head at 720, 300 and 160.
  Nothing changed; the contract is pinned.
- Tables: upstream's edge fade reaches 3.5rem instead of 1.5rem in a pane,
  and the sideways scrollbar stays shown while the table has more to see.
  No sticky first column: at 300 px the first column alone takes most of
  the width, leaving the scrolled columns a sliver.
- Tool rows: a label that is one path (a verb before it and "+N more"
  after may stay) reads name first, folder after and quieter, so a cut
  row keeps the name. Commands read as typed; a row's accessible name,
  where it has one, stays upstream's (`transcript/ToolRowLabel.tsx`, one
  seam).

## Review

Measured in the dev app. A long chat (27 screens) narrowed from 720 to 300 ended
16,469 px short of its end; now 0 px at every step, after a fast drag, and
across window resizes (600 px: 2,196 then, 0 now). At 160 the field reads
"Ask anything, …" on one line beside the model's mark, the overflow and
send. A 742 px table in a 268 px lane shows its scrollbar and a deeper
fade. "update /Users/…/notes.md" reads "update notes.md /Users/…".
