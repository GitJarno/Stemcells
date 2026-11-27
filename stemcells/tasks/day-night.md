# Day and night

Awake is day, Asleep is night. The sky stands behind the home's header on
the phone and behind the column's head on the Mac, and turns as the stage
turns: a sunset into Asleep, a sunrise back to Awake. It replaces Asleep's
night band (`nightfall.md`), which sat in Asleep's list 80 pt below Awake's
top, with a black band above its moon and a bar of sky under the title.

The person's brief (2026-11-27): both lists start at the same height; the sky
moves up behind the title, battery and folder, from the screen's top edge,
and blends into the first row; Awake is daylight and Asleep night; the turn
between them is a real sunrise or sunset that stays smooth however fast the
stages are toggled; and it stays clean, because this is where people work.

## Decisions

1. **One sky, behind the header, the same for both stages.** It is a screen
   layer drawn once over the stages' lists (`home/StagePages.tsx`), not part
   of either list, so both lists rest at the same 8 pt under the bar. It
   starts at the screen's top edge and ends 20 pt past the first row's top
   (`SKY_SHAPE.tail`). It doesn't scroll: it is the header's sky, and rows
   scroll under it as they scroll under the header.
2. **It fades out, it doesn't end.** The sky is whole over the status bar,
   then its opacity falls along a curve with no visible start or end
   (`skyStops`, a smootherstep) to nothing at its foot. Its foot is the ground
   beneath, whatever the progress, so nothing draws a seam into the first row.
   Over the iOS blur veil, the sky is the header's ground; rows under its
   fade still blur.
3. **Colour means the stage.** The book says no gradients for show; this one
   is the stage itself, said without a word: day means awake, night asleep.
   It stays restrained: no gradient anywhere else, no glow but the sun's and
   moon's own soft halo, nothing that moves while it stands.
4. **Day is a clear morning seen from a dark room.** In the dark appearance,
   a deep steel blue (`#173553`) lightening toward the horizon, never a bright
   sky over a dark list. A sun disc, warm white, with a faint halo, where the
   moon stands at night, and two faint wisps of cloud. In the light
   appearance, a pale morning blue fading into the white screen.
5. **Night is the night it was:** near-black indigo, stars in three groups by
   brightness, and the moon at tonight's real phase (`moon.ts`). In the light
   appearance, night is a lavender dusk light enough that the dark title
   reads on it, with white stars and a white moon.
6. **The title, battery and folder read at every frame.** The header's ink
   keeps at least 4.5:1 against the sky behind the bar row, day and night,
   both appearances (`sky.test.ts`). The status bar keeps its style: the sky
   behind it is dark in the dark appearance and light in the light one.

## The turn

One progress, 0 day to 1 night, drives every layer: each reads its own span
of it (`SKY_SPANS`, `apps/web/src/stemcells/motion/sky.ts`), eased in and
out. A sunrise is the sunset played back, so the stars go first, the moon
sets, the sky lightens and the sun rises last.

| Span of the progress | Layer                                                       |
| -------------------- | ----------------------------------------------------------- |
| 0 – 0.45             | The sun sinks 14 pt toward the horizon, going from 0.2      |
| 0 – 0.30             | Its light warms, white to coral                             |
| 0.05 – 0.80          | The horizon's warmth: rises and goes, at its height at 0.43 |
| 0.10 – 0.70          | The night's sky deepens in                                  |
| 0.15 – 0.60          | The clouds go; they catch the horizon's warmth as they go   |
| 0.25 – 0.90          | The day's sky lifts, once the night is mostly in            |
| 0.45 – 0.85          | The moon rises 12 pt into place, there from 0.45 to 0.65    |
| 0.55 – 1             | The stars, three groups, brightest first                    |

- **Timing** (`SKY_TURN`): nightfall 1100 ms, daybreak 800 ms, each the time
  for the whole way, on one ease in and out. The sun leaves just as the moon
  comes (0.45): one body at a time.
- **The warmth is a bump, not a colour mix.** The day and night skies cross
  by opacity, never by interpolated colour per frame; the warm band's opacity
  is `sin(π t)` over its span, so it peaks mid-turn and is gone at both ends.
  It is coral and rose, never Input's amber.
- **The day lifts later than the night deepens**, so the two never stand
  half-faded together and the ground doesn't show through mid-turn.

## Interruptions

- A turn always starts from where the progress stands, never from an end,
  and replaces the turn running: nothing queues.
- Its length is the whole way's times the distance left (at least 120 ms),
  so a turn back halfway takes half the time.
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
- Reduce Motion: one 200 ms crossfade, linear. Every layer reads the progress
  itself, nothing moves, and the warmth never shows.

## Sizes

- The phone, folded or not: the sky's height is the bar's foot plus the
  stage's 8 pt and the tail, so it follows each bar. The sun and moon stand
  in the bar row, clear of two trailing buttons (`BODY_FROM_RIGHT`), never
  nearer the title than 55% across.
- The unfolded foldable and the iPad: the home is the native split's sidebar;
  the sky draws across the sidebar's width once measured.
- Android: T3's bar stands in flow over the body, opaque, so there is no room
  behind it. The sky isn't drawn there; both lists still start at the same
  height.

## The Mac

The column's head is the same sky: behind the window's controls, the search
and New Cell, fading out 20 px into what follows. Same palette, same spans,
same timings, from the same module: the column sets the progress as one
registered CSS property (`--sky-night`), transitioned on the turn's timings,
and each layer's opacity and offset is a `calc` of it written from the spans
(`rail/Sky.tsx`). A transition interrupted midway turns back from where it
stands, shortened as far as it had gone. The sky follows the stage the
column is headed to (`aim`), so a two-finger swipe turns it once it passes
halfway, not frame by frame with the fingers. The sun and moon stand at the
titlebar's right, away from the window's controls.

## Plan

- [x] The design (this file)
- [x] The shared module: palette, spans, timings, stops, stars, with tests
- [x] Phone: one sky behind the header, both lists at 8 pt, the turn from
      the tap's frame, no shooting star, Reduce Motion
- [x] Mac: the column's sky on the same module
- [x] A mock of the frames, drawn from the module
- [ ] Gates, pull request, merge
- [ ] Seen on a phone, the folded and unfolded Duo, an iPad and the Mac

## Review

Pending the pull request.
