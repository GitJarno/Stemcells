# Day and night

Input and Awake are day, Asleep is night. The sky stands behind the home's
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
every switch, and the turn lagged the switch. So there are two skies and
nothing between: Input lost its dawn, the turn is a quick crossfade that
answers in the switch's own frame, and the day is a clear sky, not a dusk. In
the same pass the sky got its visitors back (shooting stars, gone with the
night band) and the day got its own.

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
3. **Colour means the stage.** The book says no gradients for show; this one
   is the stage itself, said without a word. It stays restrained: no gradient
   anywhere else, no glow but the sun's and moon's own soft halo, nothing that
   moves while it stands.
4. **Day is a clear sky, quiet at the edge of the eye.** It stands beside
   the list all day, so it keeps near the ground (a blue noon drew the eye
   from every chat), but it reads as day, never evening: no plum, no coral.
   In the dark appearance a deep, quiet blue, paler toward the horizon; a
   warm-white sun in a wide, faint haze, where the moon stands at night; two
   soft clouds of a few lobes. In the light appearance a pale morning blue
   fading into the white screen.
5. **No dawn and no dusk.** A warm moment between day and night made every
   switch a little show. The two skies cross and nothing passes between them.
6. **Night is the night it was:** near-black indigo, stars in three groups by
   brightness, and the moon at tonight's real phase (`motion/moon.ts`). In the
   light appearance, night is a lavender dusk light enough that the dark title
   reads on it, with white stars and a white moon.
7. **The title, battery and folder read at every frame.** The header's ink
   keeps at least 4.5:1 against the sky behind the bar row through the whole
   axis, both appearances (`sky.test.ts`). The status bar keeps its style: the
   sky behind it is dark in the dark appearance and light in the light one.

## One axis

One progress, 0 day to 1 night, drives every layer: each reads its own span
of it (`SKY_SPANS`, `apps/web/src/stemcells/motion/sky.ts`), eased in and
out. Each stage holds the sky at an end of it (`skyAtStage`): Asleep 1, the
rest 0.

- **The night comes in before the day lifts**, so the two never stand
  half-faded together and the ground doesn't show through mid-turn. The sun
  is gone before the moon comes: one body at a time, each moving a few
  points as it goes or comes.
- **Timing** (`SKY_TURN`): the whole way takes 520 ms toward night and
  420 ms toward day, a partial turn its share, on one decelerating curve, so
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

## Visitors

Now and then something crosses the sky (`SKY_VISITS`): by night a shooting
star, by day a dandelion seed drifting on the air or three birds far off,
beating and gliding. The day's are the night's shooting star in daylight's
terms: seldom (night every 14–34 s, day every 30–75 s, the first sooner after
a turn), small, soft at both ends, slow enough that they reward a glance
without drawing one. A seed is the name said without a word.

- Each fades with its own sky, so a turn takes it away mid-crossing.
- They never meet the head's controls or the moon: a shooting star crosses a
  share of the sky's width and falls a share of the stars' reach.
- Only while the sky is on screen: the window visible on the Mac; the home in
  front and the app active on the phone. Never under Reduce Motion.

## Still and cheap

- Between visits nothing moves: no twinkle, nothing on a timer but the next
  visit's. Every layer is drawn once and only its opacity and position
  change, on the UI thread (Reanimated) or as one CSS transition (the Mac). A
  visitor is one compositor animation (the Mac) or one shared value (the
  phone). No React render per frame, and none at all during a turn.
- Reduce Motion: every turn is one 160 ms linear crossfade, and nothing
  moves: the sun and moon fade where they stand.

## Sizes

- The phone, folded or not: the sky's height is the bar's foot plus the
  stage's 8 pt and the tail, so it follows each bar. The sun and moon stand
  behind the folder's button, read from where it is (`home/skyAnchor.ts`),
  so they never meet the title or the battery; their halo shows round the
  button's glass. Until it is read, they stand in the bar row clear of two
  trailing buttons (`BODY_FROM_RIGHT`).
- The unfolded foldable and the iPad: the home is the native split's sidebar;
  the sky draws across the sidebar's width once measured.
- Android: T3's bar stands in flow over the body, opaque, so there is no room
  behind it. The sky isn't drawn there; the lists still start at the same
  height.

## The Mac

The column's head is the same sky: behind the window's controls, the search
and New Cell, fading out 20 px into what follows. Same palette, spans and
timings, from the same module. The column's sky sets the progress as one
registered CSS property (`--sky-night`, `cells.css`), and each layer's
opacity and offset is a `calc` of it written from the spans (`rail/Sky.tsx`).
A turn reads the value the browser shows now and transitions from there on
the turn's own length and curve (`skyTurn`), so it behaves as the phone's
does. The sky follows the stage the column is headed to (`aim`), so a
two-finger swipe turns it once it passes halfway, not frame by frame with the
fingers. The sun and moon stand at the titlebar's right, away from the
window's controls.

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
