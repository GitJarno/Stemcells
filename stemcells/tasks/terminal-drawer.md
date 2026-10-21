# The terminal drawer's height and buttons

A chat's terminal drawer opened at upstream's 280px, a third of a tall pane
and half of a short one, pushing the composer up. Its buttons floated over
the terminal's top-right, so a long prompt or line of output ran under them.

## Plan

- [x] Where the height comes from: upstream's `DEFAULT_THREAD_TERMINAL_HEIGHT`
      (280). The terminal store copies it into a chat's entry when the
      drawer first opens and persists it, so a chat that never dragged has
      280 stored. Only a drag stores another. The drawer reads the height
      it is given when it mounts and keeps it.
- [x] Opening height (`terminal/drawerHeight.ts`): ten rows, at most 30% of
      the pane, at least six rows. A row is the terminal's own cell height
      for the person's font (`upstream/terminal.ts`). The drawer's edge,
      the buttons' row and the grid's padding are added.
- [x] The substitute (`upstream/substitutes/ThreadTerminalDrawer.tsx`)
      measures the pane once, before the drawer first draws, and hands
      upstream's drawer that height wherever 280 is stored. A dragged
      height passes through, stored and restored as upstream does.
- [x] The buttons' row (`terminal/terminal.css`): the drawer pads its top
      by a pane button's height, on the terminal's ground, and the buttons
      sit in it.
- [x] Pinned: `upstream/terminal.contract.test.ts` and the substitutes'
      contract; `terminal/drawerHeight.test.ts` tests the default and the
      clamp.

## Review

No upstream file changed. A tall pane (856px) opens the drawer at 217px,
ten rows, 25% of the pane (was 280px). A short pane (428px) opens it at
180px: upstream's drawer never goes below 180px, its floor for drags too,
which beats the six-row floor (145px) there. A dragged 319px came back
after a reload.
