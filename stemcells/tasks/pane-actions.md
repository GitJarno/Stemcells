# The thread details card in a pane

A new Cell opened with upstream's thread details card showing (where the
chat runs, Open in, project scripts, Git), and the pane's floating buttons
sat over its top edge.

## Plan

- [x] Find what opens it: upstream's thread details card. Its visibility is
      kept per chat in the right panel store, and a chat with no entry
      counts as open (`DEFAULT_THREAD_PANEL_VISIBILITY`), so every chat
      wide enough for it shows the card inline at the canvas's top-right,
      12px in, under the pane's buttons.
- [x] Closed by default (`upstream/threadDetails.ts`): the first time the
      page shows a chat in a pane, Aski's included, its card closes,
      before the pane paints. Later showings leave it as the person set
      it; the pane's ≡ button opens it. Upstream keeps a closed card
      across reloads, an open one only until then.
- [x] Nothing under the buttons (`tabs/workspace.css`): the inline card,
      the find bar and the popover a narrow pane gets all hang from the
      buttons' band's foot, their right edges in line with the buttons'.
      The inline card's place is set on the element, so the pane's rule
      overrides it and lets the card shrink in its column to the room
      left; below the find bar, upstream's own measured place stands. The
      popover hangs from the header, which now sits at no height at the
      band's foot and no longer places its toggles.
- [x] Pinned: `threadDetails.contract.test.ts` (the default, the card's
      inline place, the find bar, the popover's anchor and offsets) and
      `threadDetails.test.ts` (first showing closes; the person's open
      stays).

## Review

No upstream file changed. In a pane shorter than about 290px the card
scrolls its last rows where upstream would have switched to its compact
rows: upstream picks the density from the room it thinks the card has.
