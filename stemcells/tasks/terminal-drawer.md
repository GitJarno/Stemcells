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

## One motion

Opening the drawer, the composer rose with its edge and the words over it a
frame later (a glide later, while a Cell worked); with upstream's panel
motion off, its default, the drawer had no motion at all.

- [x] Measure it per painted frame (after layout, after the app's own
      observers): on main, opening with panel motion off, the composer
      covers the last 193px of words for a frame; at 200ms, 72px
- [x] Where upstream's list will keep the end on its next frame (it
      follows the end, within a screen of it), the pane keeps it before the
      frame is drawn (`tabs/keepEnd.ts`), read from where the transcript
      stood before the change; tests for each side of the rule, each failing
      when its side is broken
- [x] Our timeline marks when the list follows (live follow on, no sent
      message held at the top); a find bar or an app shown full holds it
- [x] The drawer opens and closes on the `keyboard` motion where upstream's
      panel motion is off (one seam in `ChatTerminalDrawers`), upstream's
      where the person set it; still with less motion, and as a chat comes
      back with its terminal open

## Review (one motion)

Measured in the dev app, a chat at its end, per painted frame: the last
line stands 23–24px above the composer in every frame of opening and
closing, six runs, with panel motion off (the drawer slides on `keyboard`,
about 350ms) and at 200ms (upstream's motion). On main the first frame
had the composer over 193px (off) or 72px (200ms) of the words. Loaded
with its terminal open, the drawer is at full height from its first frame;
with less motion it opens in one. Not measured: a Cell working (the dev
data runs no agents), where upstream's glide was the longest lag; the
pane's correction runs each frame regardless of it.

Review fixes (an independent read): the pane first trusted the last scroll
that found the transcript at its end, but a list that isn't following grows
under the reader without a scroll, so a later drawer would have thrown them
to the end. It now does exactly what upstream's list will do, from where
the transcript stood: a reader scrolled two screens up stays put (1882px
before and after). Two tests that could not fail now wait for the pane's
own observer before asserting. The drawer's duration is no longer read
under less motion, where the token is shorter.

