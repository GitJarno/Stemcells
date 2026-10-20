# Look: one Cell and its workbench take the slate

Watch is the slate as it is: the tab's Cells in their grid, no workbench
showing. When the focused Cell opens its workbench (a surface in its right
panel), the tab goes into Look: that Cell and its workbench take the slate
half and half, and the tab's other Cells fold into a rail of marks. Sending
from the Cell, Esc, the workbench's × or a mark on the rail go back to
Watch; the Cell keeps a chip naming its last surface, which opens Look
again.

## Plan

- [x] Read the approved prototype, the workbench (#14), upstream's right
      panel store and its Esc handlers
- [x] Look as plain data (`workbench/look.ts`): when a tab is in Look, the
      rail's Cells, what ending does, what a send is, when Esc is free
- [x] The adapter (`upstream/workbench.ts`): a Cell's panel open or not,
      its last surface's name, close and reopen through upstream's store,
      the inline breakpoint, what holds Esc; `useCellLastSent` in
      `upstream/chat.tsx`
- [x] Contract test (`upstream/workbench.contract.test.ts`): close keeps the
      surfaces and show reopens the same one, a draft's panel is its
      thread's, the sheet breakpoint, the shell's last user message, the DOM
      the stylesheet and Esc read
- [x] The rail, the ×, the chip and the endings (`workbench/LookFrame.tsx`),
      their layout (`workbench/look.css`)
- [x] Wire into the pager's pages after the tab swipe (#16) landed: `Look`
      first on each `TabPage`, `LookChip` in the pane header
- [x] Prove it headless: three Cells with one stacked, Look on the stacked
      one, each ending, the chip, tab memory across a tab switch and a
      reload, the narrow window
- [x] Off stage, a page in Look lays out as Look: the rail, the Cell at
      half, and a stand-in naming the surface in the workbench half, so
      nothing jumps as a swipe brings the page on or takes it off
- [x] The × moves into the workbench once chat headers went (#45)

## Decisions

- **Look is not stored.** It is the focused Cell's panel, open, in a wide
  window, on a tab of two Cells or more. Upstream keeps each thread's panel
  and the tab keeps its focused pane, so each tab remembers Look and its
  Cell with nothing of ours to keep, across tab switches and reloads.
- **A tab of one Cell stays upstream's thread view** (`slate.md`, Design):
  no rail to fold into, and sending keeps the panel open as upstream does.
- **Half and half, always.** In Look the panel ignores the width it was
  dragged to beside a single chat, and its resize handle hides. Upstream
  caps the panel against the chat column it sits beside, which on our slate
  is a pane, so its width would chase itself.
- **The × is the workbench's own**, at its top right, in the room the
  panel's tab bar keeps there, always shown, round glass like the pane's
  buttons. Nothing of Look's rides a chat's header or the pane's floating
  buttons: those are the pane's (its × closes the pane), and upstream's
  right-panel toggle among them stays as it is, lit while the panel is open.
- **A send is read from the thread**: the shell's last user-authored
  message moving past what Look first saw. Any way of sending counts; a
  chat whose history arrives after Look began (a reload) doesn't.
- **Esc** ends Look when it reaches the window unstopped and nothing held
  it when pressed: no open menu, dialog, sheet, popover, select, palette,
  context menu, find bar or full-screen app view, no focus in a terminal, a
  browser's page or a form field. Focus elsewhere in the workbench (a
  surface tab, a file, the diff) doesn't hold it. The composer's editor marks every Esc handled, so that mark
  is ignored there; when the composer uses Esc it stops it too.
- **The chip** shows on any Cell whose panel is closed but remembers a
  surface. It leads the pane's floating buttons (`tabs/PaneButtons.tsx`).
- **Off stage, a stand-in, not the surfaces.** Only the page on stage
  holds its Cell's surfaces (one browser, one terminal per thread). Every
  page in Look keeps a quiet stand-in under them naming the surface, so a
  page off stage keeps Look's geometry and the surfaces arrive and leave
  inside a box already there.

## Later

- The PR surface led by Merge; phone, tablet and desktop browser sizes;
  marking up what's wrong; the auto-open chip for dev servers; thumbnails.

## Review

Built in new files, plus three lines in `CellWorkspace.tsx` and one hook in
`upstream/chat.tsx`; no upstream file changed (`drift`). Proved headless in
the dev server with Playwright: Watch with three Cells (one stacked), Look
on the stacked Cell from Go to file, Esc with a menu open (closes the menu
only), Esc with find open (closes find only), Esc in the composer and in
the workbench, the chip, a rail mark (focuses that Cell,
Watch), the ×, a send (Look ends, the chip names `README.md`), Look kept
across a tab switch and a reload, and none below 980 px. The asking dot
wasn't seen live: no Cell asked during the run.

The stand-in, proved the same way: a swipe held mid-slide shows the
arriving page in Look with its stand-in naming `README.md`, its halves the
widths they keep once it lands; the leaving page keeps Look too, and the
surfaces are in the workbench when the slide settles.
