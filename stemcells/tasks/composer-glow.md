# The composer glows in its provider's colour while the Cell works

A Cell's composer says what the Cell is doing on its own glass: it fills
with the provider's colour while the Cell works, a band of light crossing
it, and clears when it is your turn, the light gathering back into the send
button with one small bloom. Blocked on you, the tint turns warm and
breathes. The working row's word is lit by the same wave, and the
provider's mark sits faded in the glass's corner. Ported from the Swift app:
the same numbers, curves and beats.

## Plan

- [x] Tokens: the field's pass (`--sc-timing-glow-pass`) and the providers'
      brands (`--sc-provider-claude`, `--sc-provider-codex`) in
      `stemcells.css`; every other provider wears the accent
- [x] The light as numbers (`glow/light.ts`): state from upstream's status,
      the band, wash and bloom colours, the band's strength set by the words
      over it, the iris, the beat; tested
- [x] The glass (`glow/CellComposerGlass.tsx`, `glow/motion.ts`): the
      arrive, exhale and bloom, the sweep, drift and breath, on the wall
      clock; behind the composer's words, over its glass
- [x] The imprint: the provider's mark faded into the glass's corner, only
      when it clears the send button
- [x] The sheen: the working row's word lit by the same band on the same
      beat (`glow/WorkingSheen.tsx`, worn by `CellWorkingWord`)
- [x] One seam in `ChatComposer.tsx`, listed in `seams.md`, pinned by a
      contract test with the markers the glass reads
- [x] Prove it in the dev app: working, needs-you and idle, dark and light

## Decisions

- Working is upstream's Working, Connecting and Waiting (a turn in flight or
  background work holding it); needs you is Pending Approval, Awaiting Input
  and Plan Ready; anything else is plain glass.
- The band's strength keeps the Swift rule on dark glass (its core adds
  0.015 to the glass's luminance) and, on light glass, takes the same share
  of the words' contrast, so it is a band you find in either theme.
- Motion is the Web Animations API, set once per state change, like the
  Swift app's Core Animation: transforms and opacity only while it loops.
  The wash's drift is a cross-fade between its two ends rather than a moving
  gradient, so it never repaints.

## Review

- Proved in the dev app (a Codex Cell in a scratch project, real turns):
  the colour washes out from the send button as a turn starts, the band
  sweeps on the beat, the working word lights as the band passes it, an
  approval turns the glass warm and breathing, and the end gathers the light
  into the send button with one bloom. Dark (Stemcells) and light (T3 Code)
  themes; under reduced motion the glass fades in and breathes, with no
  sweep, drift or sheen.
- One seam (`ChatComposer.tsx`: an import and one line).
  `glass.contract.test.ts` pins where the glass sits, the glass colour it
  reads, the send button it anchors to and the drivers upstream draws marks
  for.
- Left as the Swift app has it: on light glass the warm tint is faint, since
  the wash lifts toward white; the imprint draws on a draft too, and a
  provider without a mark wears the Cell's silhouette.
- Not ported: "news" (a glass lit once by good news) has no surface here
  yet, and the Swift app's "motion rests" (low power) has no web signal.

## Follow-up: a readable mark, one wave (2026-10-21)

Asked for: the provider's mark "almost invisible", make it readable at a
glance, quieter than the placeholder (the Swift app's reference: large,
faint, cropped at the bottom right); the composer's wave smoother; and the
work word's sheen, upstream's "Thinking" shimmer and the composer's wave
one wave.

- [x] Measure first (headless Chrome, a real Codex turn): frame timing,
      what is composited, what repaints, what restarts on a re-render
- [x] The mark's strength is a token by role, relative to the composer's
      own glass; crops at three strengths, dark and light, both marks
- [x] One clock and one sweep: the crest crosses the same x of the pane at
      the same moment in every lit surface, on the beat's wall clock
- [x] Upstream's Thinking shimmer joins the wave from our side (CSS in our
      panes, its overlay swept by us); a contract test pins its shape
- [x] Reduced motion: every wave still
- [x] Tests: the token, and no endless animation of a paint-heavy property
- [x] Prove it: frame timings before and after, a frame strip with each
      surface's crest, a re-mount mid-period

### Review

- The jerk was upstream's, beside ours. The glass band and the work word
  were already transforms on the compositor, on the wall clock, and no
  re-render restarted them. Upstream's live rows ran `steps(30)` over
  2.2 s on their own clock from mount: the overlay's crest stood still on
  200 of 259 frames, and a shining "Thinking" label moved its background
  on the main thread (paints 9.3/s, 2 dropped frames in one period).
- Now one crest crosses the pane on the beat. The glass, the word and
  upstream's overlays slide by transform from it (worst gap 0.00 px over a
  period, and for a row mounted mid-beat). A shining label holds off its
  words and repaints only the ~12 frames the crest is over it. Upstream's
  own animations are off inside our panes, through the
  `visibleAnimation` substitute and `glow.css`; a contract test pins the
  shapes the wave measures.
- The mark is the words' ink at `--sc-composer-mark` (12%) over the
  composer's glass: 1.36:1 dark, 1.26:1 light (was 1.01 and 1.05; the
  placeholder is 3.24 and 2.99). Stronger than the Swift app's 8%, which
  read faint on this glass, and still well under the placeholder.
