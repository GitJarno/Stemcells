# Pane polish: drafts at the foot, the slate's edges, a file carried in

Three things about the panes on the slate, each ported from what the Mac
app shows. Each lands as its own pull request.

## Plan

- [x] Drafts at the foot. Upstream centres an unsent chat's composer under
      a big "What should we build in …?". In a pane it sits at the foot, as
      a sent chat's does, so a tab's composers line up along the bottom.
      The Mac app opens a chat on its composer with one small line over it,
      so the headline stays, as a quiet line at the chat's text size: it
      carries upstream's project picker, and dropping it would leave a
      draft no way to choose its project. Done from `workspace.css`;
      `upstream/draft.contract.test.ts` pins the hooks.
- [ ] No focus ring. The focused pane wears a square ring, which the
      slate's rounded corners cut off and which doubles the hairline beside
      it. The Mac app shows focus by the chat's composer coming forward,
      never a ring. Its removal is its own pull request (#30), held
      until the composer's glass lands: without the ring or the glass,
      nothing marks the focused pane among several.
- [x] Every edge on the slate checked at 4× pixels, on Stemcells' theme
      and with the slate's own edge drawn: the hairlines between columns
      and stacks reach the slate's edge and stop there, meeting it in one
      colour; the workbench's edge, open and maximized; Look's rail and
      workbench edges, and the T where a pane header's rule meets them; a
      pane painted solid follows the slate's curve at all four corners.
      Nothing besides the ring is cut off or doubled.
- [x] A file carried over a chat: its own pull request (#26),
      planned in `pane-drop.md`.

## Review

- Checked headless in the dev app on three Cells (a sent one on the left,
  two drafts stacked on the right, the bottom one focused): the sent
  chat's composer and the bottom draft's end on the same row, measured,
  and the quiet line reads on one line in a wide window (1024 px and up)
  and as two short lines below it.
- Removing the ring leaves the focused pane unmarked among several until
  the composer's glass lands: upstream's composer looks the same focused
  or not, and the panel toggles, the only per-focus mark, draw at the
  slate's top right wherever the focused pane is (the pane header work
  moves them into each pane). So the removal waits for the glass.
- A draft in a pane shorter than its composer and line (a short stack
  with the terminal open) still runs the line over the chat header, as
  upstream's centred hero does there, only more.
