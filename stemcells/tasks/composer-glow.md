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
