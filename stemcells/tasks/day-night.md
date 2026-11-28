# The night

Asleep is night; Input and Awake have no sky. The night stands behind the home's
header on the phone and behind the column's head on the Mac, and turns as the
stage turns. It replaces Asleep's night band (`nightfall.md`), which sat in
Asleep's list 80 pt below Awake's top, with a black band above its moon and a
bar of sky under the title.

The person's brief (2026-11-27): both lists start at the same height; the sky
moves up behind the title, battery and folder, from the screen's top edge,
and blends into the first row; Awake is daylight and Asleep night; it stays
smooth however fast the stages are toggled; and it stays clean, because this
is where people work.

Revised the same night: the sunset through a warm dawn read as a dance on
every switch, and the turn lagged the switch. So the turn became a quick
crossfade that answers in the switch's own frame, and the night got its
shooting stars back (gone with the night band).

Revised again (2026-11-28): the day sky went, and with it the sun, clouds,
seeds and birds. No day could be made as elegant as the night, so Input and
Awake show the plain ground, and only Asleep has a sky.

## Decisions

1. **One sky, behind the header, the same for every stage.** It is a screen
   layer drawn once over the stages' lists (`home/StagePages.tsx`), not part
   of any list, so every list rests at the same 8 pt under the bar. It starts
   at the screen's top edge and ends 20 pt past the first row's top
   (`SKY_SHAPE.tail`). It is the title row's ground and goes where the title
   goes (`home-head.md`): still behind it at rest, and as the list in front
   scrolls, up with the list, fading with the title until both have passed
   the bar. Rows move with it, so none ever scrolls under it; the edge it
   leaves is the veil every screen has.
2. **It fades out, it doesn't end.** The sky is whole for half the way down to
   the bar's foot, then its opacity falls along a curve with no visible start
   or end (`skyStops`, a smootherstep) to nothing at its foot. Its foot is the
   ground beneath, whatever the progress, so nothing draws a seam into the
   first row. Over the iOS blur veil, the sky is the header's ground; rows
   under its fade still blur.
3. **Night means Asleep.** The book says no gradients for show; this one is
   the stage itself, said without a word. It stays restrained: no gradient
   anywhere else, no glow but the moon's soft halo, nothing that moves while
   it stands but a rare shooting star.
4. **No day.** A day sky beside the list all day drew the eye or read as
   evening, and a dawn or dusk between made every switch a show; none was
   elegant. Input and Awake stand on the plain ground.
5. **Night is the night it was:** near-black indigo, stars in three groups by
   brightness, and the moon at tonight's real phase (`motion/moon.ts`). In the
   light appearance, night is a lavender dusk light enough that the dark title
   reads on it, with white stars and a white moon.
6. **The title, battery and folder read at every frame.** The header's ink
   keeps at least 4.5:1 against the night behind the bar row as it falls,
   both appearances (`sky.test.ts`). The status bar keeps its style: the
   sky behind it is dark in the dark appearance and light in the light one.

## One axis

One progress, 0 none to 1 night, drives every layer: each reads its own span
of it (`SKY_SPANS`, `apps/web/src/stemcells/motion/sky.ts`), eased in and
out. Each stage holds the sky at an end of it (`skyAtStage`): Asleep 1, the
rest 0.

- **The night comes first**, then the moon rises a few points into it and
  the stars come out, brightest first; lifting, the same backwards.
- **Timing** (`SKY_TURN`): the whole way takes 520 ms as night falls and
  420 ms as it lifts, a partial turn its share, on one decelerating curve, so
  the change shows in the switch's first frame and then settles.

## Interruptions

- A turn always starts from where the progress stands, never from an end,
  and replaces the turn running: nothing queues.
- Its length is its pace times the distance left (at least 120 ms), so a turn
  back halfway takes half the time.
- It sets off from rest on the same ease, so a reversal slows, turns and
  goes, rather than jumping.
- The first home to show takes the sky as it stands, unanimated. Back from a
  chat, the progress is where it was left.
- The tap's own frame starts the turn, with the list's switch, before React
  renders the stage.

## Shooting stars

Now and then a shooting star crosses the night (`SKY_VISITS`): seldom (every
14–34 s, the first sooner after night falls), small, soft at both ends, slow
enough that it rewards a glance without drawing one.

- It fades with the stars, so a turn takes one away mid-crossing.
- It never meets the head's controls or the moon: it crosses a share of the
  sky's width and falls a share of the stars' reach.
- Only by night and while the sky is on screen: the window visible on the
  Mac; the home in front and the app active on the phone. Never under Reduce
  Motion.

## Still and cheap

- Between shooting stars nothing moves: no twinkle, nothing on a timer but
  the next one's, and nothing at all without night. Every layer is drawn once and only its opacity and position
  change, on the UI thread (Reanimated) or as one CSS transition (the Mac). A
  shooting star is one compositor animation (the Mac) or one shared value (the
  phone). No React render per frame, and none at all during a turn.
- Reduce Motion: every turn is one 160 ms linear crossfade, and nothing
  moves: the moon fades where it stands.

## Sizes

- The phone, folded or not: the sky's height is the bar's foot plus the
  stage's 8 pt and the tail, so it follows each bar. The moon stands
  behind the folder's button, read from where it is (`home/skyAnchor.ts`),
  so it never meets the title or the battery; its halo shows round the
  button's glass. Until it is read, it stands in the bar row clear of two
  trailing buttons (`BODY_FROM_RIGHT`).
- The unfolded foldable and the iPad: the home is the native split's sidebar;
  the sky draws across the sidebar's width once measured.
- Android: T3's bar stands in flow over the body, opaque, so there is no room
  behind it. The sky isn't drawn there; the lists still start at the same
  height.

## The Mac

The column's head has the same night: behind the window's controls, the search
and New Cell, fading out 20 px into what follows. Same palette, spans and
timings, from the same module. The column's sky sets the progress as one
registered CSS property (`--sky-night`, `cells.css`), and each layer's
opacity and offset is a `calc` of it written from the spans (`rail/Sky.tsx`).
A turn reads the value the browser shows now and transitions from there on
the turn's own length and curve (`skyTurn`), so it behaves as the phone's
does. The sky follows the stage the column is headed to (`aim`), so a
two-finger swipe turns it once it passes halfway, not frame by frame with the
fingers. The moon stands at the titlebar's right, away from the window's
controls.

## Plan

- [x] The design (this file)
- [x] The shared module: palette, axis, spans, timings, stops, stars, with
      tests
- [x] Phone: one sky behind the header, every list at 8 pt, the turn from the
      tap's frame, Reduce Motion
- [x] Mac: the column's sky on the same module, its layers held to the
      progress in a browser test
- [x] A mock of the frames, drawn from the module
- [ ] Gates, pull request, merge
- [ ] Seen on a phone, the folded and unfolded Duo, an iPad and the Mac

## Review

Pending the pull request.
