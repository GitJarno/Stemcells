# The home's title goes up with its list

The person's report (2026-11-27): on the unfolded foldable the home is a
sidebar beside a chat, and its header row, the app's name, the disk battery
and the projects button, stood still while rows passed straight through the
name and the battery, with no edge under them. They want the name and the
battery to go up with the list once it is long enough to scroll, the folder
may stay, and above all one behaviour in every posture.

## Decisions

1. **The title row belongs to the list.** On every home posture (the phone,
   the folded and unfolded foldable, the iPad), the name and the battery go
   up with the list in front as it scrolls, as iOS's large title does, and
   fade out as they pass the bar (`headShown`). One header layer reads the
   list in front's offset on the UI thread (`home/head.ts`, `StagePages.tsx`);
   no list carries a title of its own.
2. **A list too short to scroll never moves it.** The lift is how far the
   list stands past its rest, never past where it can scroll to
   (`headLift`), so a short list's bounce and a pull past either end leave
   the title put.
3. **A switch glides it.** Turning to another stage takes the title from
   where it stood to the new list's place over the switch's 200 ms, never
   sideways and never by a fade of its own; a list at its top brings it
   back. Under Reduce Motion the switch is at once; the title still scrolls
   with the content, which is scrolling, not motion.
4. **The folder stays,** a glass button in the header's trailing toolbar,
   where it was.
5. **One top edge.** Every posture draws the same veil over the stages'
   lists (`edge/ScreenVeils.tsx`), the sidebar's too, which had none; T3's
   own home there (searching) takes it as well. The sidebar's foot stays as
   it was.
6. **The sky goes with the title.** It is the title row's ground
   (`day-night.md`, decision 1): still at rest, then up with the list and
   fading with the title. The rows move with it, so none ever reads through
   it; once both are gone the edge is the veil on the ground, as in a chat.
   Idle, nothing moves and no JS runs per frame.

The title is upstream's native header title; a substitute of
`WorkspaceConnectionTitle` wraps it in the lifted layer, so its status
("Connecting…") goes up with it too. Android's home is T3's and never lifts.

## Plan

- [x] The lift and its fade, pure, with tests (`home/state.ts`)
- [x] Each stage's scroll view reports its lift on the UI thread (the
      marker's substitute, `useStageScrollView`)
- [x] The title (substitute) and the sky follow it; a switch glides it
- [x] The sidebar's top veil
- [x] Typecheck, the phone's stemcells suite, drift, `check:changed`
- [ ] Seen on the phone, the folded and unfolded foldable and an iPad

## Review

The phone's stemcells suite, typecheck, `check:changed` and drift pass;
`headLift` and `headShown` are tested in `state.test.ts`. The scroll
listener lives in `home/stageScroll.ts`, so the marker every scroll view
goes through imports no home views. Not yet seen running: the iPad
simulator's installed dev client predates this checkout, and its home list
drew no rows with or without this change, so the lift, the glide, the
title in the native header (clipping as it rises) and the sidebar's veil
wait for a fresh dev client or the phone.
