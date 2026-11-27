# Dawn, day and night

Input is dawn, Awake is day, Asleep is night. The sky stands behind the
home's header on the phone and behind the column's head on the Mac, and
turns as the stage turns. It replaces Asleep's night band (`nightfall.md`),
which sat in Asleep's list 80 pt below Awake's top, with a black band above
its moon and a bar of sky under the title.

The person's brief (2026-11-27): both lists start at the same height; the sky
moves up behind the title, battery and folder, from the screen's top edge,
and blends into the first row; Awake is daylight and Asleep night; the turn
between them is a real sunrise or sunset that stays smooth however fast the
stages are toggled; and it stays clean, because this is where people work.
Later that day: Input comes back as a third stage, an inbox of the Cells
waiting on the person, and its sky is first light: the day hasn't started
until they're unblocked.

## Decisions

1. **One sky, behind the header, the same for every stage.** It is a screen
   layer drawn once over the stages' lists (`home/StagePages.tsx`), not part
   of any list, so every list rests at the same 8 pt under the bar. It starts
   at the screen's top edge and ends 20 pt past the first row's top
   (`SKY_SHAPE.tail`). It doesn't scroll: it is the header's sky, and rows
   scroll under it as they scroll under the header.
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
4. **Day is a clear morning seen from a dark room.** In the dark appearance,
   a deep steel blue (`#173553`) lightening toward the horizon, never a bright
   sky over a dark list. A sun disc, warm white, with a faint halo, where the
   moon stands at night, and two faint wisps of cloud. In the light
   appearance, a pale morning blue fading into the white screen.
5. **Dawn is the sun at the horizon:** low and faint, the horizon at its
   warmest, the brightest stars the last ones out, the sky between night and
   day. It is the same moment a sunset passes through, so dawn is a point on
   the one axis, not a third sky.
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
out. Each stage holds the sky at a point on it (`SKY_AT`, `skyAtStage`):
Awake 0, Input 0.4, Asleep 1. So Awake to Asleep is a sunset through dawn's
warm moment; Input to Awake is the sun rising; Input to Asleep, the sun
dipping and the night coming. The pill's order (Input, Awake, Asleep) is the
person's; the sky's is the sun's, and a path that went through full day
between dawn and night would read wrong.

| Span of the progress | Layer                                                      |
| -------------------- | ---------------------------------------------------------- |
| 0 – 0.50             | The sun sinks 14 pt toward the horizon, going from 0.2     |
| 0 – 0.30             | Its light warms, white to coral                            |
| 0.05 – 0.75          | The horizon's warmth: rises and goes, at its height at 0.4 |
| 0.10 – 0.70          | The night's sky deepens in                                 |
| 0.15 – 0.60          | The clouds go; they catch the horizon's warmth as they go  |
| 0.25 – 0.90          | The day's sky lifts, once the night is mostly in           |
| 0.25 – 0.60          | The brightest stars                                        |
| 0.50 – 1             | The other stars, two groups                                |
| 0.55 – 0.90          | The moon rises 12 pt into place, there from 0.55 to 0.75   |

- **Timing** (`SKY_TURN`): the whole way takes 1100 ms toward night and 800 ms
  toward day; a turn takes its share (dawn to day 320 ms, dawn to night
  660 ms), on one ease in and out. The sun is gone before the moon comes: one
  body at a time.
- **The rise.** Each answer lifts Input's dawn a step, half of its way to
  day across the clearing; when the person answers the last ask, the rest
  rises into day at its own slower pace (`SKY_TURN.rise`). Input with
  nothing waiting stands by day. Where it stands is `skyOver` in
  `inbox/sky.ts`; the rise is `riseSky(reduced)` on the phone
  (`home/StagePages.tsx`) and `ColumnSky`'s `rises` on the Mac. A later
  stage change to Awake finds the sky there already and does nothing.
- **The warmth is a bump, not a colour mix.** The day and night skies cross
  by opacity, never by interpolated colour per frame; the warm band's opacity
  is `sin(π t)` over its span, at its height at dawn and gone by day and
  night. It is coral and rose, never Input's amber, even though dawn is
  Input's sky.
- **The day lifts later than the night deepens**, so the two never stand
  half-faded together and the ground doesn't show through mid-turn.

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

## Still and cheap

- Idle is static: no shooting star, no twinkle, nothing on a timer. Every
  layer is drawn once and only its opacity and position change, on the UI
  thread (Reanimated) or as one CSS transition (the Mac). No React render per
  frame, and none at all during a turn.
- Reduce Motion: every turn is one 200 ms linear crossfade, and nothing moves:
  the sun and moon fade where they stand. Each stage still shows its own sky,
  dawn's warmth included.

## Sizes

- The phone, folded or not: the sky's height is the bar's foot plus the
  stage's 8 pt and the tail, so it follows each bar. The sun and moon stand
  in the bar row, clear of two trailing buttons (`BODY_FROM_RIGHT`), never
  nearer the title than 55% across.
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
      tap's frame, no shooting star, Reduce Motion, `riseSky`
- [x] Mac: the column's sky on the same module, its layers held to the
      progress in a browser test
- [x] A mock of the frames, drawn from the module
- [ ] Gates, pull request, merge
- [ ] Seen on a phone, the folded and unfolded Duo, an iPad and the Mac

## Review

Pending the pull request.
