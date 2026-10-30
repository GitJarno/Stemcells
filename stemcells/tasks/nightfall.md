# Night falls over Settled

On the phone's home, Settled draws a night sky behind Aski's header. It came
and went at once. The person asked for arriving at Settled to feel like night
falling, and leaving it like a quick dawn (2026-10-30).

## Choreography

Nightfall, from another tab to Settled: 1.1 s, every beat easing out, one
mover at a time.

| When (ms)      | Beat                                                                 | Why                                                                                                                          |
| -------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0–520          | The sky deepens in                                                   | It sets the stage. Its gradient is darkest at the top, so a plain fade already reads as dusk from above                      |
| Sky's midpoint | Aski's ink, the line's text and the eyes' ground turn to night       | They cross with the sky, so nothing lights up before the dark behind it, and the eyes stay cut out of the sky at every frame |
| 180–700        | The moon rises 8 pt into place as it comes out; its glow 320–880     | The first light in the dark; the glow blooms once the moon is there                                                          |
| 300–1100       | The stars, in three groups by brightness, each 200 ms after the last | The brightest come out first, as at dusk; three layers, not 46 movers                                                        |
| 560–1100       | Aski notices: one slow, content blink                                | The moon has settled; a cat's blink, eyes held shut a beat. Aski's only motion, ending as the night does                     |

No shooting star comes during the nightfall: the first comes on the usual
rhythm, nine seconds after it starts.

Dawn, from Settled to another tab: about 380 ms, quicker than arriving. The
same parts lift in reverse along one ease-out curve: the stars and moon are
gone by 180 ms, the sky lifts behind them, the colours return at its
midpoint, and the night unmounts.

Reduce Motion: a 200 ms crossfade of the whole night. Nothing moves or blinks.

## How it holds

- **One progress across mounts.** How far night has fallen, 0 day to 1 night,
  is a reanimated mutable in `home/useNight.ts`. Each tab's page mounts the
  header again, and the progress outlives it. A tab change turns it from
  where it stands, on the UI thread: night at its own steady pace, dawn
  carrying on along its curve from that point (`turn`, `home/nightfall.ts`).
  So a quick Landed, Settled, Landed reverses without a jump.
- **Every part reads its own span** of that progress (`shown`). One value
  drives the whole night, and every part stays continuous whichever way it
  turns. Dawn's ease-out lets the stars and moon go first.
- **Only a tab change animates.** The first home to show takes the night as
  it stands. Back from a chat the progress is already 1.
- **React sees three states**: day, turning, night. They change only when a
  turn starts and ends. A day tab mounts no night, and the night draws only
  the night's Aski and line.
- **Colours cross; they aren't interpolated.** While the night turns, the
  night's Aski and line lie over the day's at the sky's opacity. That is
  opacity only, on the UI thread: no SVG or text redraws per frame and no
  platform colours to parse. Android fades each view alone, so the layers
  that must fade as one picture are composited offscreen.
- **The top veil crosses too.** Where it fades into a colour rather than
  blurring (Android, or an iOS build without the blur), the night's veil
  lies over the day's the same way.

## Plan

- [x] The choreography as pure functions, spans, the ease and the turn,
      with a table test (`home/nightfall.ts`)
- [x] One progress across the header's mounts, turned on the UI thread
      (`home/useNight.ts`)
- [x] The night in layers: sky, three star groups, the moon with its glow
      (`home/Night.tsx`)
- [x] Aski and its line cross into night with the sky
      (`home/AskiHome.tsx`)
- [x] The slow blink: Aski's eyes take a cue from outside (`shut`,
      `aski/AskiFigure.tsx`)
- [x] The top veil crosses with the sky
      (`upstream/substitutes/NativeScrollViewMarker.tsx`)
- [x] Reduce Motion: one crossfade, no rise, no blink
- [x] The phone's tests, typecheck and lint
- [ ] On a phone: nightfall, dawn, a quick reversal, Reduce Motion, light and
      dark, an iPad and an open foldable

## Decisions

- **No top-down reveal.** A mask sweeping down the sky would make the eyes'
  ground and the line's colour follow a moving edge. The gradient's dark top
  gives the dusk from above without one.
- **In light appearance, Aski's ink inverts against the sky.** Crossing with
  it, Aski reads faintly for a moment at the midpoint. That moment is about
  50 ms and smooth, where switching at the midpoint would pop.
- **Eyes wearing a mood hold it**, so `^ ^` doesn't blink slowly either, as
  with every blink.
- **The home sets no status bar style**, so there is none to turn.

## Review

The choreography's test fails if a turn restarts from zero, if dawn waits
out its full length from partway, or if the stars and moon outlast the sky
at dawn. The phone's tests, typecheck and lint pass. The views can't load in
Node, so only a phone can show the timing, how smooth it is, and that
nothing in the header moves.
